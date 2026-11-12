import { Calendar, Clock, QrCode, Printer, Tag } from 'lucide-react';
import TicketStatusBadge from './TicketStatusBadge';

export default function TicketCard({
  ticket,
  onViewQr,
  onPrint,
  onOpenResale,
  onCancelResale,
}) {
  const isUsable = ticket.rawStatus === 'VALID' && ticket.validity !== 'EXPIRED';

  return (
    <div className='bg-white border border-[#e4e4e7] rounded-2xl p-5 sm:p-6 flex flex-col justify-between hover:border-[#18181b] hover:shadow-sm transition-all relative overflow-hidden'>
      <div>
        {/* Status & Validity Badges */}
        <div className='flex items-center justify-between gap-2 mb-3'>
          <TicketStatusBadge rawStatus={ticket.rawStatus} status={ticket.status} />
          <span className='text-xs font-mono font-bold text-[#71717a]'>#{ticket.ticketCode}</span>
        </div>

        {/* Event & Tier Info */}
        <h3 className='text-base font-bold text-[#09090b] leading-snug line-clamp-2'>{ticket.eventName}</h3>
        <div className='text-xs font-semibold text-[#52525b] mt-1'>
          {ticket.ticketName} • {(ticket.ticketPrice || 0).toLocaleString('vi-VN')} ₫
        </div>

        <div className='mt-4 space-y-1.5 text-xs text-[#71717a]'>
          <div className='flex items-center gap-2'>
            <Calendar size={13} className='text-[#09090b] shrink-0' />
            <span className='truncate'>
              {ticket.sessionStart
                ? new Date(ticket.sessionStart).toLocaleString('vi-VN', {
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
          {ticket.sessionName && (
            <div className='flex items-center gap-2'>
              <Clock size={13} className='text-[#09090b] shrink-0' />
              <span className='truncate'>Suất diễn: {ticket.sessionName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Actions Bar */}
      <div className='mt-6 pt-4 border-t border-[#f4f4f6] flex flex-wrap items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={() => onViewQr(ticket)}
            className='inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#09090b] text-white text-xs font-semibold rounded-full hover:bg-[#27272a] transition-colors'>
            <QrCode size={13} />
            <span>Mã QR</span>
          </button>

          <button
            type='button'
            onClick={() => onPrint(ticket)}
            className='inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-[#e4e4e7] bg-white text-[#09090b] text-xs font-semibold rounded-full hover:bg-[#f4f4f6] transition-colors'>
            <Printer size={13} />
            <span>In vé</span>
          </button>
        </div>

        {isUsable && (
          <button
            type='button'
            onClick={() => onOpenResale(ticket)}
            className='inline-flex items-center gap-1 px-3.5 py-1.5 border border-[#e4e4e7] text-xs font-semibold text-[#09090b] hover:border-[#18181b] bg-white rounded-full transition-colors'>
            <Tag size={12} />
            <span>Bán lại</span>
          </button>
        )}

        {ticket.rawStatus === 'LISTED_RESALE' && ticket.resale?.listingId && (
          ticket.resale?.cancelRequested ? (
            <span className='text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full'>
              Đang chờ hủy (có người thanh toán)
            </span>
          ) : (
            <button
              type='button'
              onClick={() => onCancelResale(ticket.resale.listingId)}
              className='text-xs font-semibold text-[#09090b] underline hover:opacity-75 transition-opacity'>
              Hủy bán lại
            </button>
          )
        )}
      </div>
    </div>
  );
}
