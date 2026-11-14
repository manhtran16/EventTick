import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, RefreshCw, ScanLine, AlertTriangle } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { PATHS } from '../../routes/paths';
import { inputCls } from '../../components/FormField';

const REFRESH_MS = 6000;
const fmt = (d) => (d ? new Date(d).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—');

/** UC36: lượng khách đã vào cổng theo thời gian thực (tự làm mới 6 giây), phân theo hạng vé. Chỉ xem được sự kiện được phân công. */
export default function StaffTrafficPage() {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryEventId = searchParams.get('eventId') || '';

  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    api
      .get('/booking/staff/my-events')
      .then((r) => {
        const list = r.events || [];
        setEvents(list);
        if (list.length > 0) {
          const match = queryEventId && list.find((e) => e.id === queryEventId);
          const chosen = match || list[0];
          setEventId(chosen.id);
          if (chosen.id !== queryEventId) {
            setSearchParams({ eventId: chosen.id }, { replace: true });
          }
        } else {
          setEventId('');
          setLoading(false);
        }
      })
      .catch((err) => {
        showToast(err.message || 'Không tải được danh sách sự kiện');
        setLoading(false);
      });
  }, [queryEventId, setSearchParams, showToast]);

  const handleEventChange = (newId) => {
    setEventId(newId);
    setSessionId('');
    setSearchParams(newId ? { eventId: newId } : {});
    setStats(null);
  };

  const load = useCallback(
    async (silent) => {
      if (!eventId) return;
      if (!silent) setLoading(true);
      try {
        const q = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
        const r = await api.get(`/booking/staff/events/${eventId}/check-in-stats${q}`);
        setStats(r.stats);
        setUpdatedAt(new Date());
      } catch (err) {
        setStats(null);
        if (!silent) showToast(err.message || 'Không tải được thống kê');
      } finally {
        setLoading(false);
      }
    },
    [eventId, sessionId, showToast],
  );

  useEffect(() => {
    load(false);
    if (!auto || !eventId) return undefined;
    const t = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(t);
  }, [load, auto, eventId]);

  const selectedEvent = events.find((e) => e.id === eventId);

  return (
    <div className='max-w-4xl mx-auto space-y-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Lưu lượng vào cổng</h1>
          <p className='text-sm text-[#71717a] mt-1'>Cập nhật lúc {updatedAt ? updatedAt.toLocaleTimeString('vi-VN') : '—'}</p>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <select
            aria-label='Sự kiện'
            className={`${inputCls} !w-64`}
            value={eventId}
            onChange={(e) => handleEventChange(e.target.value)}
            disabled={events.length === 0}
          >
            {events.length === 0 && <option value=''>Chưa có sự kiện được phân công</option>}
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title}
              </option>
            ))}
          </select>
          {Boolean(selectedEvent?.sessions?.length) && (
            <select
              aria-label='Ca / Suất diễn'
              className={`${inputCls} !w-44`}
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            >
              <option value=''>Tất cả ca diễn</option>
              {selectedEvent.sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <label className='flex items-center gap-1.5 text-xs cursor-pointer'>
            <input type='checkbox' className='w-4 h-4 accent-[#09090b]' checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Tự làm mới
          </label>
          <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' onClick={() => load(false)} aria-label='Làm mới'>
            <RefreshCw size={13} />
          </button>
          <Link
            to={`${PATHS.STAFF_CHECKIN}${eventId ? `?eventId=${eventId}` : ''}`}
            className='tb-btn tb-btn-solid tb-btn-sm'
          >
            <ScanLine size={13} /> Soát vé
          </Link>
        </div>
      </div>

      {loading && !stats && (
        <div className='text-[#71717a] flex items-center gap-2'>
          <Loader2 size={16} className='animate-spin' /> Đang tải...
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className='bg-white border border-[#e4e4e7] rounded-2xl p-12 text-center text-sm text-[#71717a] space-y-2'>
          <AlertTriangle size={32} className='mx-auto text-amber-500' />
          <p className='font-semibold text-[#09090b]'>Bạn chưa được phân công sự kiện nào.</p>
          <p>Nhân viên chỉ có thể xem thống kê của những sự kiện mà nhà tổ chức đã phân công bạn.</p>
        </div>
      )}

      {stats && (
        <>
          <div className='grid gap-4 sm:grid-cols-3'>
            {[
              ['Đã vào cổng', stats.checkedInCount],
              ['Còn lại', stats.remainingCount],
              ['Tổng vé hợp lệ', stats.totalTickets],
            ].map(([k, v]) => (
              <div key={k} className='bg-white border border-[#e4e4e7] rounded-2xl p-5'>
                <div className='text-[11px] uppercase tracking-wider font-semibold text-[#71717a]'>{k}</div>
                <div className='text-3xl font-extrabold tracking-tight mt-1'>{v}</div>
              </div>
            ))}
          </div>

          <div className='bg-white border border-[#e4e4e7] rounded-2xl p-5'>
            <div className='flex justify-between text-sm font-semibold mb-2'>
              <span>Tỷ lệ vào cổng</span>
              <span>{stats.checkInRatePct}%</span>
            </div>
            <div className='h-3 bg-[#f4f4f6] rounded-full overflow-hidden' role='progressbar' aria-valuenow={stats.checkInRatePct} aria-valuemin={0} aria-valuemax={100}>
              <div className='h-full bg-[#09090b] rounded-full transition-all' style={{ width: `${Math.min(100, stats.checkInRatePct)}%` }} />
            </div>
          </div>

          <div className='grid gap-6 lg:grid-cols-2'>
            <div className='bg-white border border-[#e4e4e7] rounded-2xl'>
              <div className='px-5 py-3 border-b border-[#f4f4f6] text-sm font-bold'>Theo hạng vé</div>
              <ul className='divide-y divide-[#f4f4f6]'>
                {(stats.tierStats || []).map((t) => {
                  const pct = t.totalTickets ? Math.round((t.checkedIn / t.totalTickets) * 100) : 0;
                  return (
                    <li key={t.tierId} className='px-5 py-3 text-sm'>
                      <div className='flex justify-between'>
                        <span className='font-semibold'>{t.tierName}</span>
                        <span className='text-[#52525b]'>
                          {t.checkedIn}/{t.totalTickets}
                        </span>
                      </div>
                      <div className='h-1.5 bg-[#f4f4f6] rounded-full mt-2 overflow-hidden'>
                        <div className='h-full bg-[#09090b]' style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className='bg-white border border-[#e4e4e7] rounded-2xl'>
              <div className='px-5 py-3 border-b border-[#f4f4f6] text-sm font-bold'>10 lượt vào gần nhất</div>
              {(stats.recentCheckIns || []).length === 0 ? (
                <div className='p-6 text-center text-sm text-[#71717a]'>Chưa có lượt vào cổng nào.</div>
              ) : (
                <ul className='divide-y divide-[#f4f4f6]'>
                  {stats.recentCheckIns.map((c) => (
                    <li key={c.ticketCode} className='px-5 py-2.5 flex justify-between gap-3 text-sm'>
                      <span className='min-w-0'>
                        <span className='font-mono text-xs block truncate'>{c.ticketCode}</span>
                        <span className='text-xs text-[#71717a]'>
                          {c.tierName}
                          {c.checkedInBy ? ` · ${c.checkedInBy}` : ''}
                        </span>
                      </span>
                      <span className='text-xs text-[#52525b] shrink-0'>{fmt(c.checkedInAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
