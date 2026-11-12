import { useEffect } from 'react';
import { X, Printer } from 'lucide-react';
import api from '../../../api/client';
import TicketQr from '../../../components/TicketQr';

export default function TicketQrModal({ ticket, onClose, onCheckInSuccess, onPrint }) {
  // Polling thời gian thực khi khách đang mở modal mã QR tại cổng soát vé
  useEffect(() => {
    if (!ticket || ticket.rawStatus !== 'VALID') return;

    const ticketId = ticket._id;
    let active = true;

    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/booking/tickets/${ticketId}/status`);
        if (!active) return;
        if (res.ticket && res.ticket.status === 'USED') {
          clearInterval(interval);
          onCheckInSuccess({
            ...ticket,
            ...res.ticket,
          });
        }
      } catch {
        // bỏ qua lỗi tạm thời trong quá trình polling
      }
    }, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [ticket, onCheckInSuccess]);

  if (!ticket) return null;

  return (
    <div
      className='fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50'
      onClick={onClose}>
      <div
        className='bg-white border border-[#e4e4e7] rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-4 shadow-xl'
        onClick={(e) => e.stopPropagation()}>
        <div className='flex justify-between items-center'>
          <span className='text-xs font-bold uppercase tracking-wider text-[#71717a]'>Vé điện tử chính thức</span>
          <button
            type='button'
            onClick={onClose}
            className='text-[#71717a] hover:text-[#09090b]'>
            <X size={18} />
          </button>
        </div>

        <div className='p-4 bg-[#f9f9fb] border border-[#e4e4e7] rounded-2xl flex flex-col items-center'>
          <TicketQr value={`${ticket.ticketCode}.${ticket.qrHash}`} size={208} />
          <div className='mt-3 text-sm font-mono font-bold text-[#09090b]'>#{ticket.ticketCode}</div>
          <div className='text-[11px] text-[#71717a]'>Đưa mã này cho nhân viên tại cổng soát vé</div>
        </div>

        <div className='text-left space-y-1 text-xs border-t border-[#f4f4f6] pt-3'>
          <div className='font-bold text-[#09090b] line-clamp-1'>{ticket.eventName}</div>
          <div className='text-[#52525b]'>{ticket.ticketName}</div>
          <div className='text-[#71717a]'>
            {ticket.sessionStart && new Date(ticket.sessionStart).toLocaleString('vi-VN')}
          </div>
        </div>

        <button
          type='button'
          onClick={() => onPrint(ticket)}
          className='w-full py-2.5 bg-[#09090b] text-white text-xs font-semibold rounded-full hover:bg-[#27272a] transition-colors flex items-center justify-center gap-2'>
          <Printer size={15} />
          <span>In vé / Tải PDF</span>
        </button>
      </div>
    </div>
  );
}
