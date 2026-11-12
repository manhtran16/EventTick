import TicketQr from '../../../components/TicketQr';

export default function TicketPrintView({ ticket }) {
  if (!ticket) return null;

  return (
    <div className='hidden print:block fixed inset-0 bg-white p-8 font-sans text-black z-9999'>
      <div className='border-2 border-black rounded-2xl p-6 max-w-lg mx-auto space-y-4'>
        <div className='flex justify-between items-center border-b pb-3'>
          <div>
            <h1 className='text-xl font-bold'>EventTick • VÉ VÀO CỔNG</h1>
            <p className='text-xs text-gray-600'>Official Electronic Ticket</p>
          </div>
          <div className='text-right font-mono text-sm font-bold'>#{ticket.ticketCode}</div>
        </div>

        <div className='space-y-1'>
          <h2 className='text-lg font-bold leading-tight'>{ticket.eventName}</h2>
          <p className='text-sm text-gray-700'>Hạng vé: {ticket.ticketName}</p>
          <p className='text-sm text-gray-700'>
            Thời gian: {ticket.sessionStart && new Date(ticket.sessionStart).toLocaleString('vi-VN')}
          </p>
        </div>

        <div className='flex items-center justify-between border-t border-b py-4 my-2'>
          <TicketQr value={`${ticket.ticketCode}.${ticket.qrHash}`} size={144} />
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
  );
}
