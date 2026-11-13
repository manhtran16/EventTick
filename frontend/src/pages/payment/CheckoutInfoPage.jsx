import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Calendar, MapPin, Clock, Loader2, ClipboardList, X } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { PATHS } from '../../routes/paths';
import FormField, { firstMissingRequired } from '../../components/FormField';
import { VIETNAMESE_BANKS } from '../../data/vietnameseBanks';

const money = (n) => `${Number(n || 0).toLocaleString('vi-VN')} ₫`;
const fmt = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
const fmtTime = (d) =>
  d
    ? new Date(d).toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '';

/**
 * /checkout/:orderId — bước giữa "giữ ghế" và "thanh toán": khách trả lời câu hỏi của nhà tổ chức.
 * Ghế / vé đã được giữ 10 phút từ lúc đặt. Không có câu hỏi nào thì chuyển thẳng sang thanh toán.
 */
export default function CheckoutInfoPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [refundBankInfo, setRefundBankInfo] = useState({ bankName: '', accountNo: '', accountHolder: '' });
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    let alive = true;
    api
      .get(`/booking/orders/auth/${orderId}`)
      .then((res) => {
        if (!alive) return;
        if (res.status === 'CONFIRMED') {
          navigate(`${PATHS.PAYMENT_DONE}?order=${orderId}`, { replace: true });
          return;
        }
        if (res.status === 'EXPIRED' || res.status === 'CANCELLED') {
          setError(res.status === 'EXPIRED' ? 'Đơn hàng đã hết hạn giữ chỗ. Vui lòng đặt lại.' : 'Đơn hàng đã bị huỷ.');
          setData(res);
          return;
        }
        setData(res);
        setAnswers(res.attendeeFormAnswers || {});
        const savedBankInfo = res.refundBankInfo || res.order?.refund_bank_info || res.order?.refundBankInfo || {};
        setRefundBankInfo({
          bankName: savedBankInfo.bank_name || savedBankInfo.bankName || '',
          accountNo: savedBankInfo.account_no || savedBankInfo.accountNo || '',
          accountHolder: savedBankInfo.account_holder || savedBankInfo.accountHolder || '',
        });
      })
      .catch((err) => {
        if (!alive) return;
        if (err.status === 401) navigate(PATHS.LOGIN);
        else setError(err.status === 404 ? 'Không tìm thấy đơn hàng.' : err.message || 'Không tải được đơn hàng.');
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [orderId, navigate]);

  const expiresAt = data?.order?.expiresAt || data?.order?.lock_expires_at;
  useEffect(() => {
    if (!expiresAt) return undefined;
    const tick = () => setTimeLeft(Math.max(0, Math.round((new Date(expiresAt) - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  const schema = data?.formSchema || [];
  const expired = timeLeft === 0;

  const submit = async (e) => {
    e.preventDefault();
    const missing = firstMissingRequired(schema, answers);
    if (missing) {
      showToast(`Vui lòng trả lời: "${missing}"`);
      return;
    }
    if (!agree) {
      showToast('Vui lòng đồng ý với quy định của sự kiện');
      return;
    }
    if (!refundBankInfo.bankName.trim()) {
      showToast('Vui lòng nhập tên ngân hàng nhận tiền');
      return;
    }
    if (!/^[0-9]{6,20}$/.test(refundBankInfo.accountNo.trim())) {
      showToast('Số tài khoản phải gồm 6–20 chữ số');
      return;
    }
    if (!refundBankInfo.accountHolder.trim()) {
      showToast('Vui lòng nhập tên chủ tài khoản');
      return;
    }
    setSubmitting(true);
    try {
      await api.put(`/booking/orders/${orderId}/checkout-info`, {
        attendeeFormAnswers: answers,
        refundBankInfo,
      });
      navigate(`/payment/${orderId}`);
    } catch (err) {
      showToast(err.message || 'Không lưu được câu trả lời');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelOrder = () => setCancelConfirm(true);

  const confirmCancelOrder = async () => {
    setCancelConfirm(false);
    setCancelling(true);
    try {
      await api.post(`/booking/orders/${orderId}/cancel`);
      showToast('Đã huỷ đơn hàng');
      navigate(data?.order?.event_id ? `/events/${data.order.event_id}` : PATHS.HOME);
    } catch (err) {
      showToast(err.message || 'Không huỷ được đơn hàng');
    } finally {
      setCancelling(false);
    }
  };

  if (loading)
    return (
      <div className='tb-container py-16 text-[#71717a] flex items-center gap-2'>
        <Loader2 size={16} className='animate-spin' /> Đang tải đơn hàng...
      </div>
    );

  if (error)
    return (
      <div className='tb-container py-12 max-w-xl'>
        <div className='p-5 bg-red-50 border border-red-200 rounded-xl space-y-3'>
          <p className='text-sm text-red-700'>{error}</p>
          <Link to={data?.order?.event_id ? `/events/${data.order.event_id}` : PATHS.HOME} className='tb-btn tb-btn-solid'>
            Quay lại sự kiện
          </Link>
        </div>
      </div>
    );

  const order = data?.order;

  return (
    <div className='tb-container py-10'>
      <div className='flex flex-wrap items-end justify-between gap-3 mb-6'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight flex items-center gap-2'>
            <ClipboardList size={22} /> Thông tin đặt vé
          </h1>
          <p className='text-sm text-[#71717a] mt-1'>Bước 2/3: Trả lời câu hỏi của ban tổ chức, sau đó thanh toán.</p>
        </div>
        <div
          className={`flex items-center gap-2 text-sm px-3.5 py-2 rounded-full border ${
            timeLeft !== null && timeLeft <= 60 ? 'border-red-300 text-red-600 bg-red-50' : 'border-[#e4e4e7] text-[#52525b] bg-white'
          }`}>
          <Clock size={15} /> Ghế được giữ còn <strong>{fmt(timeLeft ?? 0)}</strong>
        </div>
      </div>

      {expired && (
        <div className='mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg'>
          Đã hết thời gian giữ chỗ. Vui lòng quay lại sự kiện và đặt lại.
        </div>
      )}

      <div className='grid gap-6 lg:grid-cols-[1fr_360px]'>
        <form onSubmit={submit} className='bg-white border border-[#e4e4e7] rounded-2xl p-6 space-y-5'>
          <h2 className='font-bold'>Vui lòng điền số tài khoản nhận tiền trong trường hợp sự kiện bị hủy</h2>
          <p className='text-sm text-[#71717a]'>Thông tin này chỉ được sử dụng để hoàn tiền nếu sự kiện bị hủy.</p>
          <div className='grid gap-3 sm:grid-cols-2'>
            <label className='block sm:col-span-2'>
              <span className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>Ngân hàng <span className='text-red-600'>*</span></span>
              <select
                required
                value={refundBankInfo.bankName}
                onChange={(e) => setRefundBankInfo((p) => ({ ...p, bankName: e.target.value }))}
                className='w-full border border-[#e4e4e7] rounded-lg px-3 py-2.5 text-sm'
              >
                <option value=''>Chọn ngân hàng</option>
                {VIETNAMESE_BANKS.map((bank) => <option key={bank.code} value={bank.name}>{bank.name}</option>)}
              </select>
            </label>
            <label className='block'>
              <span className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>Số tài khoản <span className='text-red-600'>*</span></span>
              <input
                required
                inputMode='numeric'
                value={refundBankInfo.accountNo}
                onChange={(e) => setRefundBankInfo((p) => ({ ...p, accountNo: e.target.value.replace(/\D/g, '') }))}
                placeholder='6–20 chữ số'
                className='w-full border border-[#e4e4e7] rounded-lg px-3 py-2.5 text-sm'
              />
            </label>
            <label className='block'>
              <span className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>Tên chủ tài khoản <span className='text-red-600'>*</span></span>
              <input
                required
                value={refundBankInfo.accountHolder}
                onChange={(e) => setRefundBankInfo((p) => ({ ...p, accountHolder: e.target.value.toUpperCase() }))}
                placeholder='NGUYEN VAN A'
                className='w-full border border-[#e4e4e7] rounded-lg px-3 py-2.5 text-sm uppercase'
              />
            </label>
          </div>
          {schema.length > 0 && <h2 className='font-bold pt-2'>Câu hỏi của ban tổ chức</h2>}
          {schema.map((f) => (
            <div key={f.key}>
              <label htmlFor={`f-${f.key}`} className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>
                {f.label} {f.required && <span className='text-red-600'>*</span>}
              </label>
              <FormField field={f} value={answers[f.key]} onChange={(v) => setAnswers((p) => ({ ...p, [f.key]: v }))} />
            </div>
          ))}

          <label className='flex items-start gap-2.5 text-sm text-[#52525b] cursor-pointer'>
            <input type='checkbox' className='w-4 h-4 mt-0.5 accent-[#09090b]' checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>Tôi đã kiểm tra thông tin và đồng ý với quy định của sự kiện.</span>
          </label>

          <div className='flex flex-wrap gap-3 pt-2'>
            <button type='submit' disabled={submitting || expired} className='tb-btn tb-btn-solid' style={{ height: 44, padding: '0 24px' }}>
              {submitting ? 'Đang lưu...' : 'Tiếp tục thanh toán'}
            </button>
            <button type='button' disabled={cancelling} onClick={cancelOrder} className='tb-btn tb-btn-outline'>
              {cancelling ? 'Đang huỷ...' : 'Huỷ đơn hàng'}
            </button>
          </div>
        </form>

        <aside className='bg-white border border-[#e4e4e7] rounded-2xl p-6 h-fit space-y-4'>
          <div className='flex gap-3'>
            {data?.event?.bannerUrl && <img src={data.event.bannerUrl} alt='' className='w-20 h-20 rounded-lg object-cover shrink-0' />}
            <div className='min-w-0'>
              <h3 className='font-bold leading-snug'>{data?.event?.title}</h3>
              {data?.session && (
                <p className='text-xs text-[#52525b] flex items-center gap-1.5 mt-1'>
                  <Calendar size={12} /> {data.session.name} · {fmtTime(data.session.startTime)}
                </p>
              )}
              {data?.event && (
                <p className='text-xs text-[#52525b] flex items-center gap-1.5'>
                  <MapPin size={12} /> {[data.event.venueName, data.event.city].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </div>

          <div className='border-t border-[#f4f4f6] pt-3 space-y-2 text-sm'>
            {(order?.items_snapshot || []).map((it, i) => (
              <div key={`${it.tier_id}-${i}`} className='flex justify-between gap-3'>
                <span>
                  {it.tier_name} × {it.quantity}
                </span>
                <span className='font-semibold'>{money(it.unit_price * it.quantity)}</span>
              </div>
            ))}
            {order?.discount_amount > 0 && (
              <div className='flex justify-between text-[#52525b]'>
                <span>Giảm giá</span>
                <span>-{money(order.discount_amount)}</span>
              </div>
            )}
          </div>
          <div className='border-t border-[#e4e4e7] pt-3 flex justify-between font-bold text-lg'>
            <span>Tổng cộng</span>
            <span>{money(order?.total_amount ?? order?.totalAmount)}</span>
          </div>
        </aside>
      </div>
      {cancelConfirm && (
        <div className='fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4' onClick={() => setCancelConfirm(false)}>
          <div className='relative bg-white rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl' onClick={(e) => e.stopPropagation()}>
            <button type='button' onClick={() => setCancelConfirm(false)} className='absolute top-4 right-4 text-[#71717a] hover:text-[#09090b]' aria-label='Đóng'>
              <X size={18} />
            </button>
            <h2 className='text-xl font-bold text-center'>Hủy đơn hàng?</h2>
            <p className='text-sm text-center text-[#52525b]'>Ghế / vé đã giữ sẽ được trả lại. Bạn có chắc muốn hủy đơn hàng này không?</p>
            <div className='flex gap-3'>
              <button type='button' className='tb-btn w-full' onClick={() => setCancelConfirm(false)}>Không</button>
              <button type='button' className='tb-btn tb-btn-solid w-full' onClick={confirmCancelOrder}>Hủy đơn hàng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
