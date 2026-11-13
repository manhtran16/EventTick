/* Hallmark · pre-emit critique: P5 H5 E5 S4 R5 V5 */
import { useState, useEffect, useMemo } from 'react';
import {
  Ticket,
  QrCode,
  Calendar,
  MapPin,
  Printer,
  Tag,
  ArrowRight,
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
  Building2,
  CreditCard,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { PATHS } from '../../routes/paths';
import TicketQr from '../../components/TicketQr';

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [resaleModalTicket, setResaleModalTicket] = useState(null);
  const [resalePrice, setResalePrice] = useState('');
  const [bankInfo, setBankInfo] = useState({ bankName: '', accountNo: '', accountHolder: '' });
  const [submittingResale, setSubmittingResale] = useState(false);
  const { showToast } = useToast();

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await api.get('/booking/user/tickets');
      setTickets(res.tickets || []);
    } catch (err) {
      showToast(err.message || 'Không thể tải danh sách vé của bạn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedTicket(null);
        setResaleModalTicket(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const filteredTickets = useMemo(() => {
    if (activeTab === 'ALL') return tickets;
    if (activeTab === 'UPCOMING') return tickets.filter((t) => t.validity === 'UPCOMING' && t.rawStatus === 'VALID');
    if (activeTab === 'RESALE') return tickets.filter((t) => t.rawStatus === 'LISTED_RESALE');
    if (activeTab === 'USED') return tickets.filter((t) => t.rawStatus === 'USED');
    return tickets;
  }, [tickets, activeTab]);

  const handlePrint = (ticket) => {
    setSelectedTicket(ticket);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleOpenResaleModal = (ticket) => {
    setResaleModalTicket(ticket);
    const maxAllowed = Math.round((ticket.ticketPrice || 0) * 1.1);
    setResalePrice(String(ticket.ticketPrice || ''));
  };

  const handleSubmitResale = async (e) => {
    e.preventDefault();
    if (!resaleModalTicket) return;

    const priceNum = Number(resalePrice);
    const maxAllowed = Math.round((resaleModalTicket.ticketPrice || 0) * 1.1);

    if (priceNum <= 0) {
      showToast('Giá bán lại phải lớn hơn 0');
      return;
    }
    if (priceNum > maxAllowed) {
      showToast(`Giá bán lại không được vượt quá 110% giá gốc (${maxAllowed.toLocaleString('vi-VN')} đ)`);
      return;
    }
    if (!bankInfo.bankName || !bankInfo.accountNo || !bankInfo.accountHolder) {
      showToast('Vui lòng điền đủ thông tin tài khoản ngân hàng nhận tiền chi trả');
      return;
    }

    try {
      setSubmittingResale(true);
      await api.post('/resale/listings', {
        ticketId: resaleModalTicket._id,
        resalePrice: priceNum,
        bankName: bankInfo.bankName.trim(),
        accountNo: bankInfo.accountNo.trim(),
        accountHolder: bankInfo.accountHolder.trim().toUpperCase(),
      });

      showToast('Đã đăng bán lại vé thành công lên Chợ Resale!');
      setResaleModalTicket(null);
      fetchTickets();
    } catch (err) {
      showToast(err.message || 'Không thể đăng bán lại vé');
    } finally {
      setSubmittingResale(false);
    }
  };

  const handleCancelResale = async (listingId) => {
    if (!window.confirm('Bạn có chắc muốn hủy tin bán lại và lấy lại vé?')) return;
    try {
      const res = await api.delete(`/resale/listings/${listingId}`);
      showToast(res.message || (res.cancelRequested ? 'Yêu cầu hủy đã được ghi nhận' : 'Đã hủy tin bán lại vé'));
      fetchTickets();
    } catch (err) {
      showToast(err.message || 'Không thể hủy tin bán lại');
    }
  };

  return (
    <div className='max-w-5xl mx-auto py-10 px-4 space-y-8'>
      {/* Page Title & Filter Bar */}
      <div className='flex flex-col md:flex-row md:items-end justify-between gap-4'>
        <div>
          <h1 className='text-2xl sm:text-3xl font-extrabold tracking-tight text-[#09090b]'>Vé của tôi</h1>
          <p className='text-xs sm:text-sm text-[#71717a] mt-1'>
            Quản lý vé điện tử, mã QR check-in sự kiện, in vé và đăng bán lại an toàn.
          </p>
        </div>

        {/* Tab Filters - Scrollable rail preventing two-line wrapping on 320px */}
        <div className='flex items-center gap-1.5 p-1 bg-[#f4f4f6] border border-[#e4e4e7] rounded-full overflow-x-auto max-w-full scrollbar-none'>
          {[
            { key: 'ALL', label: `Tất cả (${tickets.length})` },
            { key: 'UPCOMING', label: 'Sắp diễn ra' },
            { key: 'RESALE', label: 'Đang bán lại' },
            { key: 'USED', label: 'Đã check-in' },
          ].map((tab) => (
            <button
              key={tab.key}
              type='button'
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'bg-[#09090b] text-white shadow-sm'
                  : 'text-[#52525b] hover:text-[#09090b]'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className='py-20 text-center text-xs sm:text-sm text-[#71717a]'>Đang tải danh sách vé điện tử...</div>
      ) : filteredTickets.length === 0 ? (
        <div className='bg-white border border-[#e4e4e7] rounded-2xl p-8 sm:p-12 text-center space-y-4'>
          <div className='w-12 h-12 rounded-full bg-[#f4f4f6] text-[#09090b] flex items-center justify-center mx-auto border border-[#e4e4e7]'>
            <Ticket size={22} />
          </div>
          <div>
            <h2 className='text-base sm:text-lg font-bold text-[#09090b]'>Chưa có vé nào trong mục này</h2>
            <p className='text-xs sm:text-sm text-[#71717a] max-w-md mx-auto mt-1'>
              Khám phá hàng trăm sự kiện hấp dẫn hoặc kiểm tra các tab bộ lọc khác.
            </p>
          </div>
          <Link
            to={PATHS.HOME}
            className='inline-flex items-center gap-2 px-5 py-2.5 bg-[#09090b] text-white text-xs sm:text-sm font-semibold rounded-full hover:bg-[#27272a] transition-colors'>
            <span>Khám phá sự kiện</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
          {filteredTickets.map((t) => {
            const isUsable = t.rawStatus === 'VALID' && t.validity !== 'EXPIRED';

            return (
              <div
                key={t._id}
                className='bg-white border border-[#e4e4e7] rounded-2xl p-5 sm:p-6 flex flex-col justify-between hover:border-[#18181b] hover:shadow-sm transition-all relative overflow-hidden'>
                <div>
                  {/* Status & Validity Badges - Hallmark Strict Monochrome */}
                  <div className='flex items-center justify-between gap-2 mb-3'>
                    <span
                      className={`text-[10.5px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 ${
                        t.rawStatus === 'VALID'
                          ? 'bg-[#09090b] text-white border border-[#09090b]'
                          : t.rawStatus === 'LISTED_RESALE'
                          ? 'bg-[#f4f4f6] text-[#09090b] border border-[#e4e4e7]'
                          : 'bg-[#f4f4f6] text-[#71717a] border border-[#e4e4e7]'
                      }`}>
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          t.rawStatus === 'VALID' ? 'bg-white' : 'bg-[#71717a]'
                        }`}
                      />
                      <span>{t.status}</span>
                    </span>
                    <span className='text-xs font-mono font-bold text-[#71717a]'>#{t.ticketCode}</span>
                  </div>

                  {/* Event & Tier Info */}
                  <h3 className='text-base font-bold text-[#09090b] leading-snug line-clamp-2'>{t.eventName}</h3>
                  <div className='text-xs font-semibold text-[#52525b] mt-1'>
                    {t.ticketName} • {(t.ticketPrice || 0).toLocaleString('vi-VN')} ₫
                  </div>

                  <div className='mt-4 space-y-1.5 text-xs text-[#71717a]'>
                    <div className='flex items-center gap-2'>
                      <Calendar size={13} className='text-[#09090b] shrink-0' />
                      <span className='truncate'>
                        {t.sessionStart
                          ? new Date(t.sessionStart).toLocaleString('vi-VN', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Thời gian chưa công bố'}
                      </span>
                    </div>
                    {t.sessionName && (
                      <div className='flex items-center gap-2'>
                        <Clock size={13} className='text-[#09090b] shrink-0' />
                        <span className='truncate'>Suất diễn: {t.sessionName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions Bar */}
                <div className='mt-6 pt-4 border-t border-[#f4f4f6] flex flex-wrap items-center justify-between gap-2'>
                  <div className='flex items-center gap-2'>
                    {/* View QR Code */}
                    <button
                      type='button'
                      onClick={() => setSelectedTicket(t)}
                      className='inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#09090b] text-white text-xs font-semibold rounded-full hover:bg-[#27272a] transition-colors'>
                      <QrCode size={13} />
                      <span>Mã QR</span>
                    </button>

                    {/* Print ticket */}
                    <button
                      type='button'
                      onClick={() => handlePrint(t)}
                      className='inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-[#e4e4e7] bg-white text-[#09090b] text-xs font-semibold rounded-full hover:bg-[#f4f4f6] transition-colors'>
                      <Printer size={13} />
                      <span>In vé</span>
                    </button>
                  </div>

                  {/* Resale Button */}
                  {isUsable && (
                    <button
                      type='button'
                      onClick={() => handleOpenResaleModal(t)}
                      className='inline-flex items-center gap-1 px-3.5 py-1.5 border border-[#e4e4e7] text-xs font-semibold text-[#09090b] hover:border-[#18181b] bg-white rounded-full transition-colors'>
                      <Tag size={12} />
                      <span>Bán lại</span>
                    </button>
                  )}

                  {t.rawStatus === 'LISTED_RESALE' && t.resale?.listingId && (
                    t.resale?.cancelRequested ? (
                      <span className='text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full'>
                        Đang chờ hủy (có người thanh toán)
                      </span>
                    ) : (
                      <button
                        type='button'
                        onClick={() => handleCancelResale(t.resale.listingId)}
                        className='text-xs font-semibold text-[#09090b] underline hover:opacity-75 transition-opacity'>
                        Hủy bán lại
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* QR MODAL */}
      {selectedTicket && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50'
          onClick={() => setSelectedTicket(null)}>
          <div
            className='bg-white border border-[#e4e4e7] rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-4 shadow-xl'
            onClick={(e) => e.stopPropagation()}>
            <div className='flex justify-between items-center'>
              <span className='text-xs font-bold uppercase tracking-wider text-[#71717a]'>Vé điện tử chính thức</span>
              <button
                type='button'
                onClick={() => setSelectedTicket(null)}
                className='text-[#71717a] hover:text-[#09090b]'>
                <X size={18} />
              </button>
            </div>

            <div className='p-4 bg-[#f9f9fb] border border-[#e4e4e7] rounded-2xl flex flex-col items-center'>
              <TicketQr value={`${selectedTicket.ticketCode}.${selectedTicket.qrHash}`} size={208} />
              <div className='mt-3 text-sm font-mono font-bold text-[#09090b]'>#{selectedTicket.ticketCode}</div>
              <div className='text-[11px] text-[#71717a]'>Đưa mã này cho nhân viên tại cổng soát vé</div>
            </div>

            <div className='text-left space-y-1 text-xs border-t border-[#f4f4f6] pt-3'>
              <div className='font-bold text-[#09090b] line-clamp-1'>{selectedTicket.eventName}</div>
              <div className='text-[#52525b]'>{selectedTicket.ticketName}</div>
              <div className='text-[#71717a]'>
                {selectedTicket.sessionStart && new Date(selectedTicket.sessionStart).toLocaleString('vi-VN')}
              </div>
            </div>

            <button
              type='button'
              onClick={() => handlePrint(selectedTicket)}
              className='w-full py-2.5 bg-[#09090b] text-white text-xs font-semibold rounded-full hover:bg-[#27272a] transition-colors flex items-center justify-center gap-2'>
              <Printer size={15} />
              <span>In vé / Tải PDF</span>
            </button>
          </div>
        </div>
      )}

      {/* RESALE LISTING MODAL */}
      {resaleModalTicket && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50'
          onClick={() => setResaleModalTicket(null)}>
          <div
            className='bg-white border border-[#e4e4e7] rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-xl'
            onClick={(e) => e.stopPropagation()}>
            <div className='flex justify-between items-center'>
              <div>
                <h3 className='text-lg font-bold text-[#09090b]'>Đăng bán lại vé (Resale)</h3>
                <p className='text-xs text-[#71717a]'>Sang nhượng vé an toàn, bảo vệ người mua và người bán</p>
              </div>
              <button
                type='button'
                onClick={() => setResaleModalTicket(null)}
                className='text-[#71717a] hover:text-[#09090b]'>
                <X size={18} />
              </button>
            </div>

            {/* Ticket Info Box */}
            <div className='p-3.5 bg-[#f9f9fb] border border-[#e4e4e7] rounded-xl text-xs space-y-1'>
              <div className='font-bold text-[#09090b]'>{resaleModalTicket.eventName}</div>
              <div className='text-[#71717a]'>
                Hạng vé: <strong>{resaleModalTicket.ticketName}</strong> • Giá gốc:{' '}
                <strong>{(resaleModalTicket.ticketPrice || 0).toLocaleString('vi-VN')} ₫</strong>
              </div>
            </div>

            <form onSubmit={handleSubmitResale} className='space-y-4 text-xs'>
              {/* Price Input */}
              <div className='space-y-1.5'>
                <label className='font-semibold text-[#09090b] flex items-center justify-between'>
                  <span>Giá bán lại mong muốn (VNĐ) *</span>
                  <span className='text-[11px] text-[#71717a]'>
                    Tối đa 110%: {Math.round((resaleModalTicket.ticketPrice || 0) * 1.1).toLocaleString('vi-VN')} ₫
                  </span>
                </label>
                <input
                  type='number'
                  required
                  min={1}
                  max={Math.round((resaleModalTicket.ticketPrice || 0) * 1.1)}
                  value={resalePrice}
                  onChange={(e) => setResalePrice(e.target.value)}
                  className='w-full px-3.5 py-2.5 border border-[#e4e4e7] rounded-xl text-sm font-mono outline-none focus:border-[#09090b]'
                  placeholder='Nhập số tiền...'
                />
              </div>

              {/* Bank Details for payout */}
              <div className='space-y-2 pt-2 border-t border-[#f4f4f6]'>
                <span className='font-semibold text-[#09090b] block'>Tài khoản nhận tiền chi trả khi vé bán xong:</span>

                <div className='space-y-1'>
                  <span className='text-[#71717a]'>Ngân hàng (VD: Vietcombank, Techcombank, MB...)</span>
                  <input
                    type='text'
                    required
                    value={bankInfo.bankName}
                    onChange={(e) => setBankInfo({ ...bankInfo, bankName: e.target.value })}
                    className='w-full px-3 py-2 border border-[#e4e4e7] rounded-lg outline-none focus:border-[#09090b]'
                    placeholder='Tên ngân hàng'
                  />
                </div>

                <div className='grid grid-cols-2 gap-2'>
                  <div className='space-y-1'>
                    <span className='text-[#71717a]'>Số tài khoản</span>
                    <input
                      type='text'
                      required
                      value={bankInfo.accountNo}
                      onChange={(e) => setBankInfo({ ...bankInfo, accountNo: e.target.value })}
                      className='w-full px-3 py-2 border border-[#e4e4e7] rounded-lg font-mono outline-none focus:border-[#09090b]'
                      placeholder='Số tài khoản'
                    />
                  </div>
                  <div className='space-y-1'>
                    <span className='text-[#71717a]'>Tên chủ thẻ</span>
                    <input
                      type='text'
                      required
                      value={bankInfo.accountHolder}
                      onChange={(e) => setBankInfo({ ...bankInfo, accountHolder: e.target.value.toUpperCase() })}
                      className='w-full px-3 py-2 border border-[#e4e4e7] rounded-lg outline-none focus:border-[#09090b]'
                      placeholder='NGUYEN VAN A'
                    />
                  </div>
                </div>
              </div>

              <div className='flex gap-2 pt-2'>
                <button
                  type='button'
                  onClick={() => setResaleModalTicket(null)}
                  className='flex-1 py-2.5 border border-[#e4e4e7] text-[#52525b] font-semibold rounded-full hover:bg-[#f4f4f6] transition-colors'>
                  Hủy
                </button>
                <button
                  type='submit'
                  disabled={submittingResale}
                  className='flex-1 py-2.5 bg-[#09090b] text-white font-semibold rounded-full hover:bg-[#27272a] disabled:opacity-50 transition-colors'>
                  {submittingResale ? 'Đang đăng...' : 'Xác nhận đăng bán'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT-ONLY CONTAINER (Invisible on screen, styled cleanly on print) */}
      {selectedTicket && (
        <div className='hidden print:block fixed inset-0 bg-white p-8 font-sans text-black z-9999'>
          <div className='border-2 border-black rounded-2xl p-6 max-w-lg mx-auto space-y-4'>
            <div className='flex justify-between items-center border-b pb-3'>
              <div>
                <h1 className='text-xl font-bold'>EventTick • VÉ VÀO CỔNG</h1>
                <p className='text-xs text-gray-600'>Official Electronic Ticket</p>
              </div>
              <div className='text-right font-mono text-sm font-bold'>#{selectedTicket.ticketCode}</div>
            </div>

            <div className='space-y-1'>
              <h2 className='text-lg font-bold leading-tight'>{selectedTicket.eventName}</h2>
              <p className='text-sm text-gray-700'>Hạng vé: {selectedTicket.ticketName}</p>
              <p className='text-sm text-gray-700'>
                Thời gian: {selectedTicket.sessionStart && new Date(selectedTicket.sessionStart).toLocaleString('vi-VN')}
              </p>
            </div>

            <div className='flex items-center justify-between border-t border-b py-4 my-2'>
              <TicketQr value={`${selectedTicket.ticketCode}.${selectedTicket.qrHash}`} size={144} />
              <div className='text-right text-xs space-y-1'>
                <p>Khán giả vui lòng xuất trình mã QR này tại cổng check-in.</p>
                <p className='font-bold'>Mỗi mã chỉ có giá trị 01 lượt vào cổng duy nhất.</p>
              </div>
            </div>

            <div className='text-[10px] text-gray-500 text-center'>
              Hệ thống vé điện tử EventTick • Hotline hỗ trợ: 1900-6408
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
