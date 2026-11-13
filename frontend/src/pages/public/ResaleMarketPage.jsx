/* Hallmark · pre-emit critique: P5 H5 E5 S4 R5 V5 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Tag,
  Search,
  Calendar,
  MapPin,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Ticket,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  CreditCard,
} from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { PATHS } from '../../routes/paths';
import FormField, { firstMissingRequired } from '../../components/FormField';
import { VIETNAMESE_BANKS } from '../../data/vietnameseBanks';

export default function ResaleMarketPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();

  // State for Market Overview (/resale)
  const [events, setEvents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingEvents, setLoadingEvents] = useState(true);

  // State for Event Resale Listings (/resale/:eventId)
  const [eventDetail, setEventDetail] = useState(null);
  const [bundles, setBundles] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('ALL');
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Buying Modal State
  const [selectedListing, setSelectedListing] = useState(null);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [answers, setAnswers] = useState({});
  const [refundBankInfo, setRefundBankInfo] = useState({ bankName: '', accountNo: '', accountHolder: '' });

  // Fetch all resale events
  useEffect(() => {
    if (!eventId) {
      const fetchEvents = async () => {
        try {
          setLoadingEvents(true);
          const qParam = searchQuery.trim() ? `?q=${encodeURIComponent(searchQuery.trim())}` : '';
          const res = await api.get(`/resale/events${qParam}`);
          setEvents(res.events || []);
        } catch (err) {
          showToast(err.message || 'Không thể tải danh sách sự kiện bán lại');
        } finally {
          setLoadingEvents(false);
        }
      };
      const debounce = setTimeout(fetchEvents, 250);
      return () => clearTimeout(debounce);
    }
  }, [eventId, searchQuery]);

  // Fetch specific event resale listings
  useEffect(() => {
    if (eventId) {
      const fetchListings = async () => {
        try {
          setLoadingDetail(true);
          const res = await api.get(`/resale/events/${eventId}`);
          setEventDetail(res.event);
          setBundles(res.bundles || []);
          setSessions(res.sessions || []);
        } catch (err) {
          showToast(err.message || 'Không thể tải tin bán lại của sự kiện');
        } finally {
          setLoadingDetail(false);
        }
      };
      fetchListings();
    }
  }, [eventId]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedListing) {
        setSelectedListing(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedListing]);

  const handleBuyClick = (item, bundle) => {
    if (!user) {
      showToast('Vui lòng đăng nhập để mua vé bán lại');
      navigate(PATHS.LOGIN);
      return;
    }
    setSelectedListing({ ...item, bundle });
    setAnswers({});
    setRefundBankInfo({ bankName: '', accountNo: '', accountHolder: '' });
    setAgreeTerms(true);
  };

  const handleConfirmPurchase = async () => {
    if (!selectedListing || !eventId) return;
    if (!agreeTerms) {
      showToast('Vui lòng đồng ý với Điều khoản Chợ vé bán lại');
      return;
    }

    const schema = eventDetail?.formSchema || [];
    const missing = firstMissingRequired(schema, answers);
    if (missing) {
      showToast(`Vui lòng trả lời: "${missing}"`);
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
    const bundle = selectedListing.bundle;
    const listingIds = bundle.allowPartial === false ? bundle.items.map((i) => i.id) : [selectedListing.id];

    try {
      setPurchasing(true);
      const res = await api.post('/resale/orders', {
        eventId,
        listingIds,
        attendeeFormAnswers: answers,
        refundBankInfo,
        agreeTerms: true,
      });

      showToast('Đã tạo đơn giữ chỗ mua vé thành công (giữ chỗ 10 phút)!');
      setSelectedListing(null);

      if (res.orderId) {
        navigate(`/payment/${res.orderId}`);
      } else {
        navigate(PATHS.MY_TICKETS);
      }
    } catch (err) {
      showToast(err.message || 'Không thể đặt mua vé. Vé có thể đã được người khác giữ chỗ.');
    } finally {
      setPurchasing(false);
    }
  };

  // ================= VIEW 1: EVENT LISTINGS DETAIL (/resale/:eventId) =================
  if (eventId) {
    const filteredBundles =
      selectedSessionId === 'ALL' ? bundles : bundles.filter((b) => String(b.sessionId) === String(selectedSessionId));

    return (
      <div className='max-w-5xl mx-auto py-8 px-4 space-y-6'>
        {/* Back Link */}
        <Link
          to={PATHS.RESALE}
          className='inline-flex items-center gap-2 text-xs font-semibold text-[#71717a] hover:text-[#09090b] transition-colors'>
          <ArrowLeft size={14} />
          <span>Về danh sách sự kiện Chợ Resale</span>
        </Link>

        {loadingDetail ? (
          <div className='py-20 text-center text-sm text-[#71717a]'>Đang tải thông tin vé bán lại...</div>
        ) : !eventDetail ? (
          <div className='bg-white border border-[#e4e4e7] rounded-2xl p-12 text-center'>
            <h2 className='text-lg font-bold text-[#09090b]'>Không tìm thấy sự kiện</h2>
          </div>
        ) : (
          <div className='space-y-6'>
            {/* Event Header Banner */}
            <div className='bg-white border border-[#e4e4e7] rounded-3xl p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start'>
              {eventDetail.bannerUrl && (
                <img
                  src={eventDetail.bannerUrl}
                  alt={eventDetail.title}
                  className='w-full md:w-56 h-36 object-cover rounded-2xl bg-[#f4f4f6]'
                  onError={(e) => {
                    e.currentTarget.src = '/assets/banners/hero_0.jpg';
                  }}
                />
              )}
              <div className='space-y-2 flex-1 min-w-0'>
                <div className='inline-flex items-center gap-1.5 px-3 py-1 bg-[#f4f4f6] text-[#09090b] border border-[#e4e4e7] rounded-full text-xs font-bold'>
                  <ShieldCheck size={14} />
                  <span>Xác thực vé điện tử 100% qua EventTick</span>
                </div>
                <h1 className='text-2xl sm:text-3xl font-extrabold tracking-tight text-[#09090b]'>{eventDetail.title}</h1>
                <div className='flex flex-wrap items-center gap-4 text-xs text-[#71717a] pt-1'>
                  <div className='flex items-center gap-1.5'>
                    <MapPin size={14} className='text-[#09090b] shrink-0' />
                    <span>
                      {eventDetail.venueName} • {eventDetail.city}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sessions Filter */}
            {sessions.length > 1 && (
              <div className='flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none'>
                <button
                  type='button'
                  onClick={() => setSelectedSessionId('ALL')}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedSessionId === 'ALL'
                      ? 'bg-[#09090b] text-white'
                      : 'bg-white border border-[#e4e4e7] text-[#52525b] hover:text-[#09090b] hover:border-[#18181b]'
                  }`}>
                  Tất cả suất diễn
                </button>
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    type='button'
                    onClick={() => setSelectedSessionId(s.id)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                      selectedSessionId === s.id
                        ? 'bg-[#09090b] text-white'
                        : 'bg-white border border-[#e4e4e7] text-[#52525b] hover:text-[#09090b] hover:border-[#18181b]'
                    }`}>
                    {s.name} ({new Date(s.startTime).toLocaleDateString('vi-VN')})
                  </button>
                ))}
              </div>
            )}

            {/* Listings Groups */}
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <h2 className='text-base font-bold text-[#09090b]'>Danh sách vé đang sang nhượng</h2>
                <span className='text-xs text-[#71717a]'>
                  {filteredBundles.reduce((acc, b) => acc + b.items.length, 0)} vé có sẵn
                </span>
              </div>

              {filteredBundles.length === 0 ? (
                <div className='bg-white border border-[#e4e4e7] rounded-2xl p-12 text-center text-sm text-[#71717a] space-y-2'>
                  <Ticket size={24} className='mx-auto text-[#a1a1aa]' />
                  <div>Hiện chưa có vé bán lại nào cho suất diễn này.</div>
                </div>
              ) : (
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  {filteredBundles.map((b) =>
                    b.items.map((item) => {
                      const diffPrice = item.resalePrice - item.originalPrice;
                      const diffPct = Math.round((diffPrice / item.originalPrice) * 100);

                      return (
                        <div
                          key={item.id}
                          className='bg-white border border-[#e4e4e7] rounded-2xl p-5 flex flex-col justify-between hover:border-[#18181b] hover:shadow-sm transition-all space-y-4'>
                          <div>
                            <div className='flex items-center justify-between gap-2 mb-2'>
                              <span className='text-[11px] font-bold uppercase tracking-wider text-[#09090b] bg-[#f4f4f6] border border-[#e4e4e7] px-3 py-0.5 rounded-full'>
                                {b.tierName}
                              </span>
                              <span className='text-xs font-mono font-bold text-[#71717a]'>
                                {b.code} · {b.allowPartial === false ? 'Không bán lẻ' : 'Bán lẻ'}
                              </span>
                            </div>

                            {item.seat && (
                              <div className='text-xs font-medium text-[#52525b]'>
                                Vị trí ghế: <strong className='text-[#09090b]'>{item.seat}</strong>
                              </div>
                            )}

                            <div className='mt-3 flex items-baseline gap-2.5 flex-wrap'>
                              <span className='text-xl font-extrabold text-[#09090b]'>
                                {item.resalePrice.toLocaleString('vi-VN')} ₫
                              </span>
                              <span className='text-xs text-[#71717a] line-through'>
                                {item.originalPrice.toLocaleString('vi-VN')} ₫
                              </span>
                              {diffPct !== 0 && (
                                <span
                                  className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
                                    diffPct < 0
                                      ? 'bg-[#09090b] text-white'
                                      : 'bg-[#f4f4f6] text-[#09090b] border border-[#e4e4e7]'
                                  }`}>
                                  {diffPct > 0 ? `+${diffPct}%` : `${diffPct}%`}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className='pt-3 border-t border-[#f4f4f6] flex items-center justify-between gap-2'>
                            {item.held ? (
                              <span className='text-xs font-semibold text-[#71717a] flex items-center gap-1.5'>
                                <Clock size={13} />
                                <span>Đang giữ chỗ</span>
                              </span>
                            ) : (
                              <span className='text-xs font-semibold text-[#09090b] flex items-center gap-1.5'>
                                <span className='w-1.5 h-1.5 rounded-full bg-[#09090b]' />
                                <span>Sẵn sàng giao dịch</span>
                              </span>
                            )}

                            <button
                              type='button'
                              disabled={item.held || (b.allowPartial === false && b.items.some((i) => i.held))}
                              onClick={() => handleBuyClick(item, b)}
                              className='px-4 py-2 bg-[#09090b] text-white text-xs font-semibold rounded-full hover:bg-[#27272a] disabled:opacity-40 transition-colors flex items-center gap-1.5 whitespace-nowrap'>
                              <Tag size={13} />
                              <span>{b.allowPartial === false ? `Mua cả gói (${b.items.length} vé)` : 'Mua vé này'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    }),
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Purchase Confirmation Modal */}
        {selectedListing && (
          <div
            className='fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50'
            onClick={() => setSelectedListing(null)}>
            <div
              className='bg-white border border-[#e4e4e7] rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl'
              onClick={(e) => e.stopPropagation()}>
              <div className='flex justify-between items-center'>
                <h3 className='text-lg font-bold text-[#09090b]'>Xác nhận giữ chỗ mua vé</h3>
                <button
                  type='button'
                  onClick={() => setSelectedListing(null)}
                  className='text-[#71717a] hover:text-[#09090b]'>
                  <X size={18} />
                </button>
              </div>

              <div className='p-4 bg-[#f9f9fb] border border-[#e4e4e7] rounded-2xl space-y-2 text-xs'>
                <div className='font-bold text-sm text-[#09090b]'>{eventDetail.title}</div>
                <div className='text-[#52525b]'>
                  Hạng vé: <strong>{selectedListing.bundle.tierName}</strong>
                  {selectedListing.seat && ` • Ghế: ${selectedListing.seat}`}
                </div>
                <div className='flex justify-between items-center pt-2 border-t border-[#e4e4e7] font-bold text-sm'>
                  <span>Giá bán lại:</span>
                  <span className='text-base'>
                    {(selectedListing.bundle.allowPartial === false
                      ? selectedListing.bundle.items.reduce((t, i) => t + i.resalePrice, 0)
                      : selectedListing.resalePrice
                    ).toLocaleString('vi-VN')}{' '}
                    ₫
                  </span>
                </div>
              </div>

              {(eventDetail?.formSchema || []).length > 0 && (
                <div className='space-y-3'>
                  <div className='text-xs font-bold uppercase tracking-wider text-[#52525b]'>Câu hỏi của ban tổ chức</div>
                  {eventDetail.formSchema.map((f) => (
                    <div key={f.key}>
                      <label htmlFor={`f-${f.key}`} className='block text-xs font-semibold text-[#52525b] mb-1'>
                        {f.label} {f.required && <span className='text-red-600'>*</span>}
                      </label>
                      <FormField field={f} value={answers[f.key]} onChange={(v) => setAnswers((p) => ({ ...p, [f.key]: v }))} />
                    </div>
                  ))}
                </div>
              )}

              <div className='space-y-3'>
                <div className='text-xs font-bold uppercase tracking-wider text-[#52525b]'>
                  Vui lòng điền số tài khoản nhận tiền trong trường hợp sự kiện bị hủy
                </div>
                <p className='text-[11px] text-[#71717a]'>Thông tin này chỉ được sử dụng để hoàn tiền nếu sự kiện bị hủy.</p>
                <select
                  required
                  value={refundBankInfo.bankName}
                  onChange={(e) => setRefundBankInfo((p) => ({ ...p, bankName: e.target.value }))}
                  className='w-full border border-[#e4e4e7] rounded-lg px-3 py-2 text-xs'
                >
                  <option value=''>Chọn ngân hàng</option>
                  {VIETNAMESE_BANKS.map((bank) => <option key={bank.code} value={bank.name}>{bank.name}</option>)}
                </select>
                <input
                  required
                  inputMode='numeric'
                  value={refundBankInfo.accountNo}
                  onChange={(e) => setRefundBankInfo((p) => ({ ...p, accountNo: e.target.value.replace(/\D/g, '') }))}
                  placeholder='Số tài khoản nhận tiền'
                  className='w-full border border-[#e4e4e7] rounded-lg px-3 py-2 text-xs'
                />
                <input
                  required
                  value={refundBankInfo.accountHolder}
                  onChange={(e) => setRefundBankInfo((p) => ({ ...p, accountHolder: e.target.value.toUpperCase() }))}
                  placeholder='Tên chủ tài khoản'
                  className='w-full border border-[#e4e4e7] rounded-lg px-3 py-2 text-xs uppercase'
                />
              </div>

              <div className='text-xs space-y-3 text-[#52525b]'>
                <label className='flex items-start gap-2.5 cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className='mt-0.5 rounded border-[#e4e4e7] text-black focus:ring-black'
                  />
                  <span className='text-[11px] leading-relaxed'>
                    Tôi đồng ý với chính sách Chợ vé bán lại: Sau khi xác nhận, vé sẽ được giữ chỗ trong 10 phút để
                    thanh toán. Vé cũ của người bán sẽ lập tức bị thu hồi và phát hành mã QR mới hoàn toàn cho tôi.
                  </span>
                </label>
              </div>

              <div className='flex gap-2 pt-2'>
                <button
                  type='button'
                  onClick={() => setSelectedListing(null)}
                  className='flex-1 py-2.5 border border-[#e4e4e7] text-[#52525b] text-xs font-semibold rounded-full hover:bg-[#f4f4f6] transition-colors'>
                  Hủy
                </button>
                <button
                  type='button'
                  disabled={purchasing || !agreeTerms}
                  onClick={handleConfirmPurchase}
                  className='flex-1 py-2.5 bg-[#09090b] text-white text-xs font-semibold rounded-full hover:bg-[#27272a] disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5'>
                  <CreditCard size={14} />
                  <span>{purchasing ? 'Đang tạo đơn...' : 'Tiếp tục thanh toán'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ================= VIEW 2: MARKET OVERVIEW (/resale) =================
  return (
    <div className='max-w-5xl mx-auto py-10 px-4 space-y-8'>
      {/* Hero Banner */}
      <div className='bg-[#09090b] text-white rounded-3xl p-7 sm:p-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6'>
        <div className='space-y-2.5 max-w-xl'>
          <div className='inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 border border-white/20 rounded-full text-xs font-semibold'>
            <ShieldCheck size={14} />
            <span>Sàn vé thứ cấp chính chủ EventTick</span>
          </div>
          <h1 className='text-2xl sm:text-3xl font-extrabold tracking-tight'>Chợ Vé Bán Lại (Resale)</h1>
          <p className='text-sm text-[#a1a1aa] leading-relaxed'>
            Mua và sang nhượng vé sự kiện đã bán hết một cách an toàn. Giá bán lại được khống chế trần tối đa 110% giá
            gốc, chống đầu cơ phe vé, bảo lãnh hoàn tiền 100%.
          </p>
        </div>

        <Link
          to={PATHS.MY_TICKETS}
          className='inline-flex items-center gap-2 px-5 py-2.5 bg-white text-[#09090b] text-xs font-bold rounded-full hover:bg-[#f4f4f6] transition-colors shrink-0 shadow-sm whitespace-nowrap'>
          <Tag size={14} />
          <span>Đăng bán vé của tôi</span>
        </Link>
      </div>

      {/* Search Bar */}
      <div className='flex items-center gap-3'>
        <div className='relative flex-1'>
          <Search size={18} className='absolute left-4 top-3 text-[#71717a]' />
          <input
            type='text'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder='Tìm kiếm sự kiện có vé bán lại...'
            className='w-full pl-11 pr-4 py-2.5 bg-[#f9f9fb] border border-[#e4e4e7] rounded-full text-sm outline-none focus:bg-white focus:border-[#09090b] transition-all'
          />
        </div>
      </div>

      {/* Events Grid */}
      {loadingEvents ? (
        <div className='py-20 text-center text-sm text-[#71717a]'>Đang kiểm tra các sự kiện có vé bán lại...</div>
      ) : events.length === 0 ? (
        <div className='bg-white border border-[#e4e4e7] rounded-3xl p-12 text-center space-y-4'>
          <Ticket size={32} className='mx-auto text-[#a1a1aa]' />
          <div>
            <h3 className='text-base font-bold text-[#09090b]'>Chưa có vé bán lại nào</h3>
            <p className='text-xs text-[#71717a] max-w-sm mx-auto mt-1'>
              Hiện tại tất cả vé sang nhượng đã được mua hết hoặc chưa có khán giả nào đăng bán.
            </p>
          </div>
        </div>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          {events.map((e) => (
            <Link
              key={e.id}
              to={`/resale/${e.id}`}
              className='bg-white border border-[#e4e4e7] rounded-2xl overflow-hidden hover:border-[#18181b] hover:shadow-md transition-all flex flex-col group'>
              <div className='relative h-44 bg-[#f4f4f6] overflow-hidden'>
                <img
                  src={e.bannerUrl}
                  alt={e.title}
                  className='w-full h-full object-cover group-hover:scale-102 transition-transform duration-300'
                  onError={(ev) => {
                    ev.currentTarget.src = '/assets/banners/hero_0.jpg';
                  }}
                />
                <div className='absolute top-3 right-3 bg-[#09090b]/80 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-lg'>
                  {e.listingCount} vé có sẵn
                </div>
              </div>

              <div className='p-5 flex-1 flex flex-col justify-between space-y-3'>
                <div>
                  <h3 className='text-sm font-bold text-[#09090b] line-clamp-2 leading-snug group-hover:underline'>
                    {e.title}
                  </h3>
                  <div className='mt-2 space-y-1 text-xs text-[#71717a]'>
                    <div className='flex items-center gap-1.5'>
                      <MapPin size={13} className='text-[#09090b] shrink-0' />
                      <span className='truncate'>
                        {e.venueName} • {e.city}
                      </span>
                    </div>
                    {e.nextSessionTime && (
                      <div className='flex items-center gap-1.5'>
                        <Calendar size={13} className='text-[#09090b] shrink-0' />
                        <span>{new Date(e.nextSessionTime).toLocaleDateString('vi-VN')}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className='pt-3 border-t border-[#f4f4f6] flex items-center justify-between'>
                  <div>
                    <div className='text-[10px] text-[#71717a] uppercase font-semibold'>Giá từ</div>
                    <div className='text-sm font-bold text-[#09090b]'>
                      {e.minPrice ? `${e.minPrice.toLocaleString('vi-VN')} ₫` : 'Liên hệ'}
                    </div>
                  </div>
                  <div className='text-xs font-semibold text-[#09090b] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform'>
                    <span>Xem vé</span>
                    <ArrowRight size={13} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
