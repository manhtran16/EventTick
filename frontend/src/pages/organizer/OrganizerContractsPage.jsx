import { useCallback, useEffect, useRef, useState } from 'react';
import { FileSignature, Download, Eraser, X, Loader2, Percent } from 'lucide-react';
import DOMPurify from 'dompurify';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/v1';
const STATUS = {
  WAITING_SIGN: { label: 'Chờ ký', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  SIGNED: { label: 'Đã ký', cls: 'bg-[#09090b] text-white border-[#09090b]' },
  REJECTED: { label: 'Đã từ chối', cls: 'bg-red-50 text-red-700 border-red-200' },
};
const fmt = (d) => (d ? new Date(d).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—');

/** Khung vẽ chữ ký bằng chuột / cảm ứng. Trả về PNG data URL qua ref. */
function SignaturePad({ padRef, onChange }) {
  const canvas = useRef(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  const pos = (e) => {
    const r = canvas.current.getBoundingClientRect();
    const t = e.touches?.[0] || e;
    return { x: ((t.clientX - r.left) * canvas.current.width) / r.width, y: ((t.clientY - r.top) * canvas.current.height) / r.height };
  };
  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    const c = canvas.current.getContext('2d');
    const { x, y } = pos(e);
    c.beginPath();
    c.moveTo(x, y);
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const c = canvas.current.getContext('2d');
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.strokeStyle = '#09090b';
    const { x, y } = pos(e);
    c.lineTo(x, y);
    c.stroke();
    if (!dirty.current) {
      dirty.current = true;
      onChange(true);
    }
  };
  const end = () => (drawing.current = false);

  useEffect(() => {
    padRef.current = {
      clear: () => {
        canvas.current.getContext('2d').clearRect(0, 0, canvas.current.width, canvas.current.height);
        dirty.current = false;
        onChange(false);
      },
      toDataUrl: () => (dirty.current ? canvas.current.toDataURL('image/png') : null),
    };
  }, [padRef, onChange]);

  return (
    <canvas
      ref={canvas}
      width={560}
      height={180}
      className='w-full h-44 bg-[#f9f9fb] border-2 border-dashed border-[#d4d4d8] rounded-xl touch-none cursor-crosshair'
      onMouseDown={start}
      onMouseMove={move}
      onMouseUp={end}
      onMouseLeave={end}
      onTouchStart={start}
      onTouchMove={move}
      onTouchEnd={end}
    />
  );
}

/** UC27: xem điều khoản, ký trên canvas, tải PDF hợp đồng. */
export default function OrganizerContractsPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);
  const [agree, setAgree] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const [signing, setSigning] = useState(false);
  const [opening, setOpening] = useState('');
  const padRef = useRef(null);
  const onSigChange = useCallback((v) => setHasSig(v), []);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/organizer/contracts');
      setItems(r.contracts || r.items || []);
    } catch (err) {
      showToast(err.message || 'Không tải được danh sách hợp đồng');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const open = async (c) => {
    setOpening(c.id);
    try {
      const r = await api.get(`/organizer/contracts/${c.id}`);
      setActive(r.contract || r.item);
      setAgree(false);
      setHasSig(false);
    } catch (err) {
      showToast(err.message || 'Không mở được hợp đồng');
    } finally {
      setOpening('');
    }
  };

  const sign = async () => {
    const sig = padRef.current?.toDataUrl();
    if (!sig) return showToast('Vui lòng ký vào khung chữ ký');
    if (!agree) return showToast('Vui lòng đồng ý với điều khoản hợp đồng');
    setSigning(true);
    try {
      await api.post(`/organizer/contracts/${active.id}/sign`, { signature: sig, agree: true });
      showToast('Ký hợp đồng thành công. Sự kiện đã được xuất bản.');
      setActive(null);
      await load();
    } catch (err) {
      showToast(err.message || 'Không ký được hợp đồng');
      if (err.status === 409) {
        setActive(null);
        load();
      }
    } finally {
      setSigning(false);
    }
  };

  const reject = async () => {
    const reason = window.prompt('Lý do không đồng ý ký (ví dụ mức hoa hồng bạn mong muốn). Admin sẽ thấy lý do này để chỉnh hợp đồng:');
    if (reason === null) return;
    if (!reason.trim()) return showToast('Vui lòng nhập lý do từ chối ký');
    try {
      await api.put(`/organizer/contracts/${active.id}/reject`, { reason: reason.trim() });
      showToast('Đã gửi lý do cho Admin, sự kiện quay lại hàng chờ duyệt');
      setActive(null);
      await load();
    } catch (err) {
      showToast(err.message || 'Không thực hiện được');
    }
  };

  const downloadPdf = (c) => window.open(`${BASE}/organizer/contracts/${c.id}/pdf`, '_blank', 'noopener');

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Hợp đồng điện tử</h1>
        <p className='text-sm text-[#71717a] mt-1'>Sau khi Admin duyệt sự kiện, bạn ký hợp đồng để sự kiện được mở bán.</p>
      </div>

      {loading ? (
        <div className='text-[#71717a] flex items-center gap-2'>
          <Loader2 size={16} className='animate-spin' /> Đang tải...
        </div>
      ) : items.length === 0 ? (
        <div className='bg-white border border-[#e4e4e7] rounded-2xl p-12 text-center text-sm text-[#71717a]'>
          Chưa có hợp đồng nào. Hợp đồng được tạo khi Admin duyệt sự kiện của bạn.
        </div>
      ) : (
        <div className='bg-white border border-[#e4e4e7] rounded-2xl overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-left text-[11px] uppercase tracking-wider text-[#71717a] border-b border-[#e4e4e7]'>
                <th className='p-4'>Số hợp đồng</th>
                <th>Sự kiện</th>
                <th>Hoa hồng</th>
                <th>Trạng thái</th>
                <th>Ngày ký</th>
                <th className='text-right pr-4'>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const st = STATUS[c.status] || { label: c.status, cls: 'bg-[#f4f4f6] border-[#e4e4e7]' };
                return (
                  <tr key={c.id} className='border-b border-[#f4f4f6] last:border-0'>
                    <td className='p-4 font-mono text-xs'>{c.contractNumber}</td>
                    <td className='font-semibold'>{c.eventTitle || '—'}</td>
                    <td>
                      <span className='inline-flex items-center gap-1'>
                        {c.commissionRatePct}
                        <Percent size={12} />
                      </span>
                    </td>
                    <td>
                      <span className={`px-2.5 py-1 rounded-full border text-xs font-semibold ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className='text-[#52525b]'>{fmt(c.signedAt)}</td>
                    <td className='text-right pr-4'>
                      {c.status === 'WAITING_SIGN' && (
                        <button type='button' className='tb-btn tb-btn-solid tb-btn-sm' disabled={opening === c.id} onClick={() => open(c)}>
                          <FileSignature size={14} /> {opening === c.id ? 'Đang mở...' : 'Xem & ký'}
                        </button>
                      )}
                      {c.status === 'REJECTED' && c.rejectionReason && <span className='text-xs text-[#71717a] block max-w-xs ml-auto'>Lý do bạn từ chối: {c.rejectionReason}</span>}
                      {c.status === 'SIGNED' && (
                        <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' onClick={() => downloadPdf(c)}>
                          <Download size={14} /> Tải PDF
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {active && (
        <div className='fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50' onClick={() => !signing && setActive(null)}>
          <div className='bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 space-y-4' onClick={(e) => e.stopPropagation()}>
            <div className='flex items-center justify-between'>
              <h2 className='text-lg font-bold'>Hợp đồng {active.contractNumber}</h2>
              <button type='button' onClick={() => setActive(null)} className='text-[#71717a] hover:text-[#09090b]' aria-label='Đóng'>
                <X size={18} />
              </button>
            </div>
            <div className='border border-[#e4e4e7] rounded-xl p-4 max-h-72 overflow-y-auto text-sm leading-relaxed bg-[#f9f9fb]'>
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(active.termsHtml || '') }} />
            </div>
            <div className='grid gap-6 sm:grid-cols-2'>
              <div className='border border-[#e4e4e7] rounded-xl p-4 min-h-44'>
                <h3 className='text-xs font-semibold uppercase tracking-wider text-[#52525b]'>Đại diện bên A (Sàn EventTick)</h3>
                <p className='mt-8 text-2xl italic'>Dương</p>
                <p className='text-sm mt-2'>Bùi Tuấn Dương</p>
              </div>
              <div>
                <div className='flex items-center justify-between mb-2'>
                  <span className='text-xs font-semibold uppercase tracking-wider text-[#52525b]'>Đại diện bên B (Nhà tổ chức)</span>
                  <button type='button' onClick={() => padRef.current?.clear()} className='text-xs underline text-[#71717a] hover:text-[#09090b] flex items-center gap-1'>
                    <Eraser size={12} /> Xóa, ký lại
                  </button>
                </div>
                <SignaturePad padRef={padRef} onChange={onSigChange} />
              </div>
            </div>
            <label className='flex items-start gap-2.5 text-sm text-[#52525b] cursor-pointer'>
              <input type='checkbox' className='w-4 h-4 mt-0.5 accent-[#09090b]' checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>Tôi đã đọc và đồng ý với toàn bộ điều khoản, bao gồm tỷ lệ hoa hồng {active.commissionRatePct}%.</span>
            </label>
            <div className='flex flex-wrap gap-3'>
              <button type='button' disabled={signing || !hasSig || !agree} onClick={sign} className='tb-btn tb-btn-solid' style={{ height: 44, padding: '0 24px' }}>
                {signing ? 'Đang ký...' : 'Ký xác nhận'}
              </button>
              <button type='button' disabled={signing} onClick={reject} className='tb-btn tb-btn-outline'>
                Từ chối ký
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
