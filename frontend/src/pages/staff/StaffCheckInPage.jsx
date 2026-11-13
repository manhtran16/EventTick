import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import {
  CheckCircle2,
  XCircle,
  Camera,
  CameraOff,
  Volume2,
  VolumeX,
  BarChart3,
  Keyboard,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../api/client';
import { PATHS } from '../../routes/paths';
import { inputCls } from '../../components/FormField';

const READER_ID = 'qr-reader';
const COOLDOWN_MS = 2500; // bỏ qua cùng một mã quét lại liên tục

/** UC35: soát vé bằng camera hoặc nhập / máy quét cầm tay. Backend kiểm tra chữ ký HMAC, phân công sự kiện và chặn quét trùng. */
export default function StaffCheckInPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryEventId = searchParams.get('eventId') || '';

  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [gate, setGate] = useState('Cổng chính');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [camStarting, setCamStarting] = useState(false);
  const [camError, setCamError] = useState('');
  const [sound, setSound] = useState(true);
  const [last, setLast] = useState(null);
  const [recent, setRecent] = useState([]);

  const inputRef = useRef(null);
  const scannerRef = useRef(null);
  const lastRef = useRef({ code: '', at: 0 });
  const soundRef = useRef(sound);
  const busyRef = useRef(false);
  const selectedEventIdRef = useRef('');
  soundRef.current = sound;
  selectedEventIdRef.current = selectedEventId;

  useEffect(() => {
    api
      .get('/booking/staff/my-events')
      .then((r) => {
        const list = r.events || [];
        setEvents(list);
        if (list.length > 0) {
          const match = queryEventId && list.find((e) => e.id === queryEventId);
          const chosen = match || list[0];
          setSelectedEventId(chosen.id);
          if (chosen.assignedGate) setGate(chosen.assignedGate);
          if (chosen.id !== queryEventId) {
            setSearchParams({ eventId: chosen.id }, { replace: true });
          }
        } else {
          setSelectedEventId('');
        }
      })
      .catch(() => {});
  }, [queryEventId, setSearchParams]);

  const handleEventChange = (newId) => {
    setSelectedEventId(newId);
    setSearchParams(newId ? { eventId: newId } : {});
    const target = events.find((e) => e.id === newId);
    if (target?.assignedGate) {
      setGate(target.assignedGate);
    }
    setLast(null);
  };

  const beep = useCallback((ok) => {
    if (!soundRef.current) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = ok ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(ok ? 880 : 220, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      /* trình duyệt chặn âm thanh trước khi có thao tác */
    }
  }, []);

  const verify = useCallback(
    async (raw) => {
      const text = String(raw || '').trim();
      if (!text) return;

      const activeEventId = selectedEventIdRef.current;
      const time = new Date().toLocaleTimeString('vi-VN');

      if (!activeEventId) {
        const item = {
          ok: false,
          code: text,
          event: '',
          zone: '',
          time,
          message: 'Bạn chưa được phân công sự kiện nào để soát vé.',
        };
        setLast(item);
        setRecent((p) => [item, ...p].slice(0, 12));
        beep(false);
        return;
      }

      const now = Date.now();
      if (lastRef.current.code === text && now - lastRef.current.at < COOLDOWN_MS) return;
      if (busyRef.current) return;
      lastRef.current = { code: text, at: now };
      busyRef.current = true;
      setBusy(true);

      // QR của hệ thống: "<mã vé>.<chữ ký>"
      const isJson = text.startsWith('{');
      const [rawCode, hash] = !isJson && text.includes('.') ? text.split('.') : [text, ''];
      const code = isJson ? rawCode : rawCode.replace(/^[#\s]+/, '').trim().toUpperCase();
      try {
        const res = await api.post('/booking/check-in', {
          ticketCode: code,
          qrHash: hash || undefined,
          gate,
          eventId: activeEventId,
        });
        const item = {
          ok: true,
          code: res.ticket?.ticketCode || code,
          event: res.ticket?.eventName || '',
          zone: res.ticket?.zoneName || '',
          time,
          message: res.message || 'Check-in thành công',
        };
        setLast(item);
        setRecent((p) => [item, ...p].slice(0, 12));
        beep(true);
      } catch (err) {
        const item = { ok: false, code, event: '', zone: '', time, message: err.message || 'Vé không hợp lệ' };
        setLast(item);
        setRecent((p) => [item, ...p].slice(0, 12));
        beep(false);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [gate, beep],
  );

  const verifyRef = useRef(verify);
  verifyRef.current = verify;

  const stopCamera = useCallback(async () => {
    const sc = scannerRef.current;
    scannerRef.current = null;
    if (sc) {
      try {
        if (sc.isScanning) await sc.stop();
        sc.clear();
      } catch {
        /* đã dừng */
      }
    }
    setCamStarting(false);
    setCamOn(false);
  }, []);

  const startCamera = async () => {
    setCamError('');
    if (
      typeof window !== 'undefined' &&
      !window.isSecureContext &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      setCamError(
        'Trình duyệt trên điện thoại yêu cầu kết nối HTTPS (hoặc localhost) để mở camera. Hãy dùng HTTPS hoặc nhập mã bên dưới.',
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError('Trình duyệt của bạn không hỗ trợ camera hoặc đang chặn quyền truy cập.');
      return;
    }

    // Hiện khung trước để container không bị display: none (clientWidth = 0 làm lỗi video trên mobile)
    setCamOn(true);
    setCamStarting(true);

    try {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) await scannerRef.current.stop();
          scannerRef.current.clear();
        } catch {
          /* đã dừng */
        }
      }

      const sc = new Html5Qrcode(READER_ID);
      scannerRef.current = sc;
      const qrConfig = {
        fps: 10,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const size = Math.min(250, Math.max(120, Math.floor(minEdge * 0.72)));
          return { width: size, height: size };
        },
      };

      try {
        await sc.start(
          { facingMode: 'environment' },
          qrConfig,
          (text) => verifyRef.current(text),
          () => {},
        );
      } catch {
        const cameras = await Html5Qrcode.getCameras().catch(() => []);
        if (cameras?.length) {
          const backCam =
            cameras.find((c) => /back|rear|sau|environment/i.test(c.label)) || cameras[cameras.length - 1];
          await sc.start(
            backCam.id,
            qrConfig,
            (text) => verifyRef.current(text),
            () => {},
          );
        } else {
          await sc.start(
            { facingMode: 'user' },
            qrConfig,
            (text) => verifyRef.current(text),
            () => {},
          );
        }
      }
    } catch (err) {
      scannerRef.current = null;
      setCamOn(false);
      const msg = String(err?.message || err);
      setCamError(
        /Permission|NotAllowed|denied/i.test(msg)
          ? 'Trình duyệt chưa được cấp quyền camera. Hãy cho phép camera trong cài đặt hoặc dùng ô nhập mã bên dưới.'
          : 'Không mở được camera (cần HTTPS hoặc localhost). Hãy dùng ô nhập mã bên dưới.',
      );
    } finally {
      setCamStarting(false);
    }
  };

  useEffect(() => () => void stopCamera(), [stopCamera]);

  const submitManual = async (e) => {
    e.preventDefault();
    const v = input;
    setInput('');
    await verify(v);
    inputRef.current?.focus();
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  return (
    <div className='max-w-3xl mx-auto space-y-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Soát vé tại cổng</h1>
          <p className='text-sm text-[#71717a] mt-1'>
            {events.length
              ? `Bạn đang được phân công ${events.length} sự kiện. Chỉ soát vé cho sự kiện được chọn.`
              : 'Bạn chưa được phân công sự kiện nào, chỉ soát được vé của sự kiện được giao.'}
          </p>
        </div>
        <div className='flex gap-2'>
          <button
            type='button'
            className='tb-btn tb-btn-outline tb-btn-sm'
            onClick={() => setSound((v) => !v)}
            aria-label='Bật tắt âm thanh'>
            {sound ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>
          <Link
            to={`${PATHS.STAFF_STATS}${selectedEventId ? `?eventId=${selectedEventId}` : ''}`}
            className='tb-btn tb-btn-outline tb-btn-sm'>
            <BarChart3 size={14} /> Thống kê
          </Link>
        </div>
      </div>

      {events.length === 0 ? (
        <div className='bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-8 text-center space-y-3'>
          <AlertTriangle size={36} className='mx-auto text-amber-600' />
          <h2 className='text-base font-bold'>Chưa có sự kiện nào được phân công</h2>
          <p className='text-sm text-amber-700 max-w-md mx-auto'>
            Bạn chỉ có thể soát vé và xem thống kê của các sự kiện mà người tổ chức đã phân công bạn vào danh sách nhân
            viên.
          </p>
        </div>
      ) : (
        <div className='bg-white border border-[#e4e4e7] rounded-2xl p-5 space-y-4'>
          <div className='grid gap-3 sm:grid-cols-2'>
            <label className='flex flex-col gap-1 text-sm'>
              <span className='text-xs font-semibold uppercase tracking-wider text-[#52525b]'>
                Sự kiện đang soát vé
              </span>
              <select
                aria-label='Sự kiện đang soát vé'
                className={inputCls}
                value={selectedEventId}
                onChange={(e) => handleEventChange(e.target.value)}>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
            </label>

            <label className='flex flex-col gap-1 text-sm'>
              <span className='text-xs font-semibold uppercase tracking-wider text-[#52525b]'>Cổng soát vé</span>
              <input
                className={inputCls}
                value={gate}
                onChange={(e) => setGate(e.target.value)}
                maxLength={40}
                placeholder='Cổng chính, Cổng VIP...'
              />
            </label>
          </div>

          <div className='flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#f4f4f6]'>
            <span className='text-xs text-[#71717a]'>
              Đang soát cho: <strong className='text-[#09090b]'>{selectedEvent?.title || '—'}</strong>
            </span>
            {camOn ? (
              <button type='button' className='tb-btn tb-btn-outline' onClick={stopCamera}>
                <CameraOff size={15} /> Tắt camera
              </button>
            ) : (
              <button type='button' className='tb-btn tb-btn-solid' onClick={startCamera}>
                <Camera size={15} /> Bật camera quét QR
              </button>
            )}
          </div>
          <div
            className={
              camOn ? 'relative rounded-xl overflow-hidden border border-[#e4e4e7] bg-black' : 'h-0 overflow-hidden'
            }>
            {camStarting && (
              <div className='flex items-center justify-center h-64 text-sm text-white/80'>
                Đang khởi động camera...
              </div>
            )}
            <div id={READER_ID} className='w-full' />
          </div>
          {camError && (
            <p className='text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2'>{camError}</p>
          )}

          <form onSubmit={submitManual} className='flex gap-2'>
            <div className='relative flex-1'>
              <Keyboard size={16} className='absolute left-3.5 top-3 text-[#71717a]' />
              <input
                ref={inputRef}
                className={`${inputCls} pl-10! font-mono`}
                placeholder='Nhập hoặc quét mã vé (TK-...)'
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoFocus
                autoComplete='off'
              />
            </div>
            <button type='submit' disabled={busy || !input.trim()} className='tb-btn tb-btn-solid'>
              {busy ? 'Đang kiểm tra...' : 'Soát vé'}
            </button>
          </form>
          <p className='text-xs text-[#71717a]'>
            Máy quét cầm tay hoạt động như bàn phím: bấm vào ô nhập rồi quét, vé tự được gửi đi.
          </p>
        </div>
      )}

      {last && (
        <div
          className={`rounded-2xl border p-5 flex items-start gap-4 ${last.ok ? 'bg-[#09090b] text-white border-[#09090b]' : 'bg-red-50 text-red-800 border-red-200'}`}
          role='status'
          aria-live='polite'>
          {last.ok ? <CheckCircle2 size={36} className='shrink-0' /> : <XCircle size={36} className='shrink-0' />}
          <div className='min-w-0'>
            <div className='text-lg font-bold'>{last.ok ? 'HỢP LỆ' : 'KHÔNG HỢP LỆ'}</div>
            <div className='text-sm mt-0.5'>{last.message}</div>
            <div className='text-xs mt-2 opacity-80 font-mono break-all'>{last.code}</div>
            {last.ok && (
              <div className='text-xs mt-1 opacity-80'>
                {last.event} · {last.zone}
              </div>
            )}
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div className='bg-white border border-[#e4e4e7] rounded-2xl'>
          <div className='px-5 py-3 border-b border-[#f4f4f6] text-sm font-bold'>Lượt quét gần đây</div>
          <ul className='divide-y divide-[#f4f4f6]'>
            {recent.map((r, i) => (
              <li key={`${r.time}-${i}`} className='px-5 py-2.5 flex items-center justify-between gap-3 text-sm'>
                <span className='flex items-center gap-2 min-w-0'>
                  {r.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} className='text-red-600' />}
                  <span className='font-mono text-xs truncate'>{r.code}</span>
                </span>
                <span className='text-xs text-[#71717a] shrink-0'>
                  {r.ok ? r.zone : r.message} · {r.time}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
