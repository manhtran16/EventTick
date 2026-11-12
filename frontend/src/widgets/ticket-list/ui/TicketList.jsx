import { Ticket, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PATHS } from '../../../routes/paths';
import { TicketCard } from '../../../entities/ticket';

export default function TicketList({
  tickets = [],
  filteredTickets = [],
  activeTab = 'ALL',
  onTabChange,
  loading = false,
  onViewQr,
  onPrint,
  onOpenResale,
  onCancelResale,
}) {
  const TABS = [
    { key: 'ALL', label: `Tất cả (${tickets.length})` },
    { key: 'UPCOMING', label: 'Sắp diễn ra' },
    { key: 'RESALE', label: 'Đang bán lại' },
    { key: 'USED', label: 'Đã check-in' },
  ];

  return (
    <div className='space-y-8'>
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
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type='button'
              onClick={() => onTabChange(tab.key)}
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
          {filteredTickets.map((t) => (
            <TicketCard
              key={t._id}
              ticket={t}
              onViewQr={onViewQr}
              onPrint={onPrint}
              onOpenResale={onOpenResale}
              onCancelResale={onCancelResale}
            />
          ))}
        </div>
      )}
    </div>
  );
}
