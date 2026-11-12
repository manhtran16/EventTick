import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Calendar, MapPin, Clock, Loader2, ClipboardList, Receipt, UserCheck } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { PATHS } from '../../routes/paths';
import FormField, { firstMissingRequired } from '../../components/FormField';

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
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [agree, setAgree] = useState(false);
  const [requestVat, setRequestVat] = useState(false);
  const [vatInfo, setVatInfo] = useState({
    company_name: '',
    tax_code: '',
    company_address: '',
    invoice_email: '',
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
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
        if (res.order?.vat_invoice_info?.company_name) {
          setRequestVat(true);
          setVatInfo({
            company_name: res.order.vat_invoice_info.company_name || '',
            tax_code: res.order.vat_invoice_info.tax_code || '',
            company_address: res.order.vat_invoice_info.company_address || '',
            invoice_email: res.order.vat_invoice_info.invoice_email || user?.email || '',
          });
        } else if (user?.email) {
          setVatInfo((prev) => ({ ...prev, invoice_email: user.email }));
        }
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
  }, [orderId, navigate, user?.email]);

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

    if (requestVat) {
      if (!vatInfo.company_name.trim()) return showToast('Vui lòng nhập tên công ty/đơn vị nhận hóa đơn');
      if (!vatInfo.tax_code.trim()) return showToast('Vui lòng nhập mã số thuế');
      if (!/^\d{10}(-?\d{3})?$/.test(vatInfo.tax_code.trim())) return showToast('Mã số thuế phải gồm 10 hoặc 13 chữ số');
      if (!vatInfo.company_address.trim()) return showToast('Vui lòng nhập địa chỉ công ty');
      if (!vatInfo.invoice_email.trim()) return showToast('Vui lòng nhập email nhận hóa đơn');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vatInfo.invoice_email.trim())) return showToast('Email nhận hóa đơn không hợp lệ');
    }

    if (!agree) {
      showToast('Vui lòng đồng ý với quy định của sự kiện');
      return;
    }
    setSubmitting(true);
    try {
      await api.put(`/booking/orders/${orderId}/checkout-info`, {
        attendeeFormAnswers: answers,
        vatInvoiceInfo: requestVat
          ? {
              company_name: vatInfo.company_name.trim(),
              tax_code: vatInfo.tax_code.trim(),
              company_address: vatInfo.company_address.trim(),
              invoice_email: vatInfo.invoice_email.trim(),
            }
          : null,
      });
      navigate(`/payment/${orderId}`);
    } catch (err) {
      showToast(err.message || 'Không lưu được câu trả lời');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelOrder = async () => {
    if (!window.confirm('Huỷ đơn hàng này? Ghế / vé đã giữ sẽ được trả lại.')) return;
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
        <form onSubmit={submit} className='bg-white border border-[#e4e4e7] rounded-2xl p-6 space-y-6'>
          {/* Thông tin người nhận vé (UC21) */}
          <div className='space-y-3'>
            <h2 className='font-bold flex items-center gap-2 text-sm text-[#09090b]'>
              <UserCheck size={16} /> Thông tin người nhận vé
            </h2>
            <div className='grid sm:grid-cols-3 gap-3 p-3.5 bg-[#f9f9fb] border border-[#e4e4e7] rounded-xl text-xs'>
              <div>
                <span className='text-[#71717a] block text-[11px]'>Họ và tên</span>
                <span className='font-semibold text-[#09090b]'>{user?.fullName || user?.username || '—'}</span>
              </div>
              <div>
                <span className='text-[#71717a] block text-[11px]'>Email nhận vé</span>
                <span className='font-semibold text-[#09090b] truncate block'>{user?.email || '—'}</span>
              </div>
              <div>
                <span className='text-[#71717a] block text-[11px]'>Số điện thoại</span>
                <span className='font-semibold text-[#09090b]'>{user?.phone || '—'}</span>
              </div>
            </div>
          </div>

          {/* Câu hỏi khảo sát tùy chỉnh (UC20, UC21) */}
          {schema.length > 0 && (
            <div className='space-y-4 border-t border-[#f4f4f6] pt-5'>
              <h2 className='font-bold flex items-center gap-2 text-sm text-[#09090b]'>
                <ClipboardList size={16} /> Câu hỏi khảo sát của ban tổ chức
              </h2>
              {schema.map((f) => (
                <div key={f.key}>
                  <label htmlFor={`f-${f.key}`} className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>
                    {f.label} {f.required && <span className='text-red-600'>*</span>}
                  </label>
                  <FormField field={f} value={answers[f.key]} onChange={(v) => setAnswers((p) => ({ ...p, [f.key]: v }))} />
                </div>
              ))}
            </div>
          )}

          {/* Yêu cầu xuất hóa đơn đỏ - e-Invoice VAT (UC24) */}
          <div className='border-t border-[#f4f4f6] pt-5 space-y-3.5'>
            <label className='flex items-center gap-2.5 cursor-pointer select-none'>
              <input
                type='checkbox'
                className='w-4 h-4 accent-[#09090b] rounded'
                checked={requestVat}
                onChange={(e) => setRequestVat(e.target.checked)}
              />
              <span className='font-bold text-sm text-[#09090b] flex items-center gap-1.5'>
                <Receipt size={16} /> Yêu cầu xuất hóa đơn GTGT (e-Invoice VAT)
              </span>
            </label>

            {requestVat && (
              <div className='p-4 bg-[#f9f9fb] border border-[#e4e4e7] rounded-xl space-y-3 text-xs'>
                <p className='text-[11px] text-[#71717a]'>
                  Thông tin doanh nghiệp sẽ được lưu cùng đơn hàng và gửi cho ban tổ chức phát hành hóa đơn điện tử.
                </p>
                <div className='grid sm:grid-cols-2 gap-3'>
                  <div>
                    <label className='block font-semibold text-[#52525b] mb-1'>Tên công ty / Đơn vị *</label>
                    <input
                      type='text'
                      required
                      placeholder='VD: Công ty Cổ phần Giải pháp ABC'
                      value={vatInfo.company_name}
                      onChange={(e) => setVatInfo({ ...vatInfo, company_name: e.target.value })}
                      className='w-full px-3 py-2 bg-white border border-[#e4e4e7] rounded-lg outline-none focus:border-[#09090b]'
                    />
                  </div>
                  <div>
                    <label className='block font-semibold text-[#52525b] mb-1'>Mã số thuế (MST) *</label>
                    <input
                      type='text'
                      required
                      placeholder='10 hoặc 13 chữ số'
                      value={vatInfo.tax_code}
                      onChange={(e) => setVatInfo({ ...vatInfo, tax_code: e.target.value })}
                      className='w-full px-3 py-2 bg-white border border-[#e4e4e7] rounded-lg outline-none focus:border-[#09090b]'
                    />
                  </div>
                </div>
                <div>
                  <label className='block font-semibold text-[#52525b] mb-1'>Địa chỉ công ty (theo ĐKKD) *</label>
                  <input
                    type='text'
                    required
                    placeholder='VD: Số 10 Phạm Văn Bạch, Cầu Giấy, Hà Nội'
                    value={vatInfo.company_address}
                    onChange={(e) => setVatInfo({ ...vatInfo, company_address: e.target.value })}
                    className='w-full px-3 py-2 bg-white border border-[#e4e4e7] rounded-lg outline-none focus:border-[#09090b]'
                  />
                </div>
                <div>
                  <label className='block font-semibold text-[#52525b] mb-1'>Email nhận hóa đơn điện tử *</label>
                  <input
                    type='email'
                    required
                    placeholder='VD: ketoan@congty.com'
                    value={vatInfo.invoice_email}
                    onChange={(e) => setVatInfo({ ...vatInfo, invoice_email: e.target.value })}
                    className='w-full px-3 py-2 bg-white border border-[#e4e4e7] rounded-lg outline-none focus:border-[#09090b]'
                  />
                </div>
              </div>
            )}
          </div>

          <label className='flex items-start gap-2.5 text-sm text-[#52525b] cursor-pointer pt-2 border-t border-[#f4f4f6]'>
            <input type='checkbox' className='w-4 h-4 mt-0.5 accent-[#09090b]' checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>Tôi đã kiểm tra thông tin và đồng ý với quy định của sự kiện. Vé đã mua không hoàn lại, chỉ có thể đăng bán lại.</span>
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
    </div>
  );
}
