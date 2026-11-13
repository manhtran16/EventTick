import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusCircle, Calendar, MapPin, BarChart3, Tag, Pencil, Send, Undo2, XCircle, Loader2 } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { inputCls } from '../../components/FormField';
import { PATHS } from '../../routes/paths';

const STATUS = {
  DRAFT: { label: 'Bản nháp', cls: 'bg-[#f4f4f6] text-[#52525b] border-[#e4e4e7]' },
  PENDING: { label: 'Chờ duyệt', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  APPROVED: { label: 'Chờ ký hợp đồng', cls: 'bg-blue-50 text-blue-800 border-blue-200' },
  PUBLISHED: { label: 'Đang mở bán', cls: 'bg-[#09090b] text-white border-[#09090b]' },
  CANCELLED: { label: 'Đã huỷ', cls: 'bg-red-50 text-red-700 border-red-200' },
  ENDED: { label: 'Đã kết thúc', cls: 'bg-[#f4f4f6] text-[#71717a] border-[#e4e4e7]' },
};
const fmt = (d) => (d ? new Date(d).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '');
const money = (n) => `${Number(n || 0).toLocaleString('vi-VN')} ₫`;

/** Danh sách sự kiện của nhà tổ chức + các thao tác theo trạng thái (gửi duyệt, rút lại, huỷ). */
export default function OrganizerEventsPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingEvent, setSubmittingEvent] = useState(null);
  const [cancellingEvent, setCancellingEvent] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await api.get('/organizer/events');
      setEvents(r.events || []);
    } catch (err) {
      showToast(err.message || 'Không tải được danh sách sự kiện');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (e, action, confirmMsg, body) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(`${e._id}:${action}`);
    try {
      const r = await api.post(`/organizer/events/${e._id}/${action}`, body || {});
      showToast(r.message || 'Thành công');
      await load();
      return true;
    } catch (err) {
      showToast(err.message || 'Không thực hiện được');
      return false;
    } finally {
      setBusy('');
    }
  };

  const submitEvent = async () => {
    if (!submittingEvent) return;
    const submitted = await act(submittingEvent, 'submit', null);
    if (submitted) setSubmittingEvent(null);
  };

  const cancelEvent = async () => {
    if (!cancelReason.trim()) return showToast('Vui lòng nhập lý do huỷ');
    const cancelled = await act(cancellingEvent, 'cancel', null, { reason: cancelReason.trim() });
    if (cancelled) {
      setCancellingEvent(null);
      setCancelReason('');
    }
  };

  return (
    <div className='space-y-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Sự kiện của tôi</h1>
          <p className='text-sm text-[#71717a] mt-1'>{events.length} sự kiện</p>
        </div>
        <Link to={PATHS.ORGANIZER_CREATE_EVENT} className='tb-btn tb-btn-solid'>
          <PlusCircle size={15} /> Tạo sự kiện mới
        </Link>
      </div>

      {loading ? (
        <div className='text-[#71717a] flex items-center gap-2'>
          <Loader2 size={16} className='animate-spin' /> Đang tải...
        </div>
      ) : events.length === 0 ? (
        <div className='bg-white border border-[#e4e4e7] rounded-2xl p-12 text-center space-y-3'>
          <p className='font-bold'>Bạn chưa có sự kiện nào</p>
          <Link to={PATHS.ORGANIZER_CREATE_EVENT} className='tb-btn tb-btn-solid'>
            Tạo sự kiện đầu tiên
          </Link>
        </div>
      ) : (
        <div className='grid gap-4'>
          {events.map((e) => {
            const st = STATUS[e.status] || { label: e.status, cls: 'bg-[#f4f4f6] border-[#e4e4e7]' };
            const b = (a) => busy === `${e._id}:${a}`;
            return (
              <div key={e._id} className='bg-white border border-[#e4e4e7] rounded-2xl p-4 flex flex-col sm:flex-row gap-4'>
                <img
                  src={e.banner_url}
                  alt=''
                  className='w-full sm:w-44 h-28 rounded-xl object-cover bg-[#f4f4f6] shrink-0'
                  onError={(ev) => {
                    ev.currentTarget.src = '/assets/banners/hero_0.jpg';
                  }}
                />
                <div className='flex-1 min-w-0 space-y-2'>
                  <div className='flex flex-wrap items-center gap-2'>
                    <h2 className='font-bold truncate'>{e.title}</h2>
                    <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className='text-xs text-[#52525b] flex flex-wrap gap-x-4 gap-y-1'>
                    <span className='flex items-center gap-1.5'>
                      <Calendar size={12} /> {fmt(e.start_time)}
                    </span>
                    <span className='flex items-center gap-1.5'>
                      <MapPin size={12} /> {e.venue_name}, {e.city}
                    </span>
                    <span>Từ {money(e.lowest_price)}</span>
                  </div>
                  {['DRAFT', 'PENDING'].includes(e.status) && e.rejection_reason && (
                    <p className='text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2'>
                      {e.status === 'PENDING' ? 'Ghi chú' : 'Admin từ chối'}: {e.rejection_reason}
                    </p>
                  )}

                  <div className='flex flex-wrap gap-2 pt-1'>
                    <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' onClick={() => navigate(`/organizer/events/${e._id}`)}>
                      <BarChart3 size={13} /> Quản lý
                    </button>
                    {!['CANCELLED', 'ENDED'].includes(e.status) && (
                      <Link to={`/organizer/events/${e._id}/edit`} className='tb-btn tb-btn-outline tb-btn-sm'>
                        <Pencil size={13} /> Chỉnh sửa
                      </Link>
                    )}
                    <Link to={`/organizer/events/${e._id}/vouchers`} className='tb-btn tb-btn-outline tb-btn-sm'>
                      <Tag size={13} /> Voucher
                    </Link>
                    {e.status === 'DRAFT' && (
                      <button type='button' disabled={b('submit')} className='tb-btn tb-btn-solid tb-btn-sm' onClick={() => setSubmittingEvent(e)}>
                        <Send size={13} /> {b('submit') ? 'Đang gửi...' : 'Gửi duyệt'}
                      </button>
                    )}
                    {e.status === 'PENDING' && (
                      <button type='button' disabled={b('withdraw')} className='tb-btn tb-btn-outline tb-btn-sm' onClick={() => act(e, 'withdraw', 'Rút lại để chỉnh sửa? Sự kiện sẽ về bản nháp.')}>
                        <Undo2 size={13} /> Rút lại
                      </button>
                    )}
                    {e.status === 'APPROVED' && (
                      <Link to={PATHS.ORGANIZER_CONTRACTS} className='tb-btn tb-btn-solid tb-btn-sm'>
                        Ký hợp đồng
                      </Link>
                    )}
                    {['PUBLISHED', 'APPROVED'].includes(e.status) && (
                      <button type='button' disabled={b('cancel')} className='tb-btn tb-btn-outline tb-btn-sm text-red-700' onClick={() => { setCancellingEvent(e); setCancelReason(''); }}>
                        <XCircle size={13} /> Huỷ sự kiện
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cancellingEvent && (
        <div className='fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50' onClick={() => setCancellingEvent(null)}>
          <div className='bg-white rounded-2xl w-full max-w-md p-6 space-y-4' onClick={(event) => event.stopPropagation()}>
            <h3 className='font-bold'>Huỷ sự kiện &quot;{cancellingEvent.title}&quot;?</h3>
            <p className='text-sm text-[#52525b]'>Khách đã mua vé sẽ được hoàn tiền. Vui lòng nhập lý do huỷ để Admin và khách hàng được thông báo.</p>
            <div>
              <label htmlFor='cancel-reason' className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>Lý do huỷ (bắt buộc)</label>
              <textarea id='cancel-reason' rows={4} maxLength={1000} className={inputCls} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
            </div>
            <div className='flex gap-3'>
              <button type='button' className='tb-btn tb-btn-solid' disabled={busy === `${cancellingEvent._id}:cancel`} onClick={cancelEvent}>
                Xác nhận huỷ
              </button>
              <button type='button' className='tb-btn tb-btn-outline' disabled={busy === `${cancellingEvent._id}:cancel`} onClick={() => setCancellingEvent(null)}>
                Huỷ bỏ
              </button>
            </div>
          </div>
        </div>
      )}

      {submittingEvent && (
        <div className='fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50' onClick={() => setSubmittingEvent(null)}>
          <div className='bg-white rounded-2xl w-full max-w-md p-6 space-y-4' onClick={(event) => event.stopPropagation()}>
            <h3 className='font-bold'>Gửi sự kiện &quot;{submittingEvent.title}&quot; để duyệt?</h3>
            <p className='text-sm text-[#52525b]'>Sự kiện sẽ được chuyển đến Admin kiểm tra. Bạn có thể rút lại để chỉnh sửa nếu cần.</p>
            <div className='flex gap-3'>
              <button type='button' className='tb-btn tb-btn-solid' disabled={busy === `${submittingEvent._id}:submit`} onClick={submitEvent}>
                Xác nhận gửi duyệt
              </button>
              <button type='button' className='tb-btn tb-btn-outline' disabled={busy === `${submittingEvent._id}:submit`} onClick={() => setSubmittingEvent(null)}>
                Huỷ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
