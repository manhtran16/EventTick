import { X, CheckCircle2 } from 'lucide-react';

export default function TicketCheckInSuccessModal({ data, onClose }) {
  if (!data) return null;

  return (
    <div
      className='fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50'
      onClick={onClose}>
      <div
        className='bg-white border border-[#e4e4e7] rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-5 shadow-2xl'
        onClick={(e) => e.stopPropagation()}>
        <div className='flex justify-between items-center'>
          <span className='text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full'>
            Đã qua cổng soát vé
          </span>
          <button
            type='button'
            onClick={onClose}
            className='text-[#71717a] hover:text-[#09090b] p-1'>
            <X size={18} />
          </button>
        </div>

        <div className='w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-200'>
          <CheckCircle2 size={36} className='stroke-[2.5]' />
        </div>

        <div>
          <h3 className='text-xl font-extrabold text-[#09090b] tracking-tight'>
            Chào mừng bạn đến sự kiện!
          </h3>
          <p className='text-xs text-[#71717a] mt-1'>
            Vé điện tử đã được xác thực thành công tại cổng.
          </p>
        </div>

        <div className='bg-[#f9f9fb] border border-[#e4e4e7] rounded-2xl p-4 text-left space-y-2 text-xs'>
          <div className='font-bold text-[#09090b] text-sm line-clamp-2'>
            {data.eventName}
          </div>
          {data.sessionName && (
            <div className='flex justify-between text-[#52525b] pt-1.5 border-t border-[#e4e4e7]'>
              <span>Suất diễn:</span>
              <span className='font-semibold text-[#09090b]'>{data.sessionName}</span>
            </div>
          )}
          <div className='flex justify-between text-[#52525b] pt-1 border-t border-[#f4f4f6]'>
            <span>Hạng vé:</span>
            <span className='font-bold text-[#09090b]'>{data.zoneName || data.ticketName}</span>
          </div>
          {data.seat && (
            <div className='flex justify-between text-[#52525b]'>
              <span>Vị trí ngồi:</span>
              <span className='font-semibold text-[#09090b]'>{data.seat}</span>
            </div>
          )}
          <div className='flex justify-between text-[#71717a] font-mono text-[11px] pt-1.5 border-t border-[#f4f4f6]'>
            <span>Mã vé:</span>
            <span className='font-bold text-[#09090b]'>#{data.ticketCode}</span>
          </div>
          {data.checkedInAt && (
            <div className='flex justify-between text-[#71717a] text-[11px]'>
              <span>Thời gian vào:</span>
              <span>{new Date(data.checkedInAt).toLocaleTimeString('vi-VN')}</span>
            </div>
          )}
        </div>

        <button
          type='button'
          autoFocus
          onClick={onClose}
          className='w-full py-2.5 bg-[#09090b] text-white text-xs font-semibold rounded-full hover:bg-[#27272a] transition-colors'>
          Vào sự kiện ngay
        </button>
      </div>
    </div>
  );
}
