import { useState } from 'react';
import { X } from 'lucide-react';
import api from '../../../api/client';
import { useToast } from '../../../context/ToastContext';

export default function ResaleListingModal({ ticket, onClose, onSuccess }) {
  const { showToast } = useToast();
  const [resalePrice, setResalePrice] = useState(String(ticket?.ticketPrice || ''));
  const [bankInfo, setBankInfo] = useState({ bankName: '', accountNo: '', accountHolder: '' });
  const [submittingResale, setSubmittingResale] = useState(false);

  if (!ticket) return null;

  const maxAllowed = Math.round((ticket.ticketPrice || 0) * 1.1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const priceNum = Number(resalePrice);

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
        ticketId: ticket._id,
        resalePrice: priceNum,
        bankName: bankInfo.bankName.trim(),
        accountNo: bankInfo.accountNo.trim(),
        accountHolder: bankInfo.accountHolder.trim().toUpperCase(),
      });

      showToast('Đã đăng bán lại vé thành công lên Chợ Resale!');
      onSuccess?.();
      onClose();
    } catch (err) {
      showToast(err.message || 'Không thể đăng bán lại vé');
    } finally {
      setSubmittingResale(false);
    }
  };

  return (
    <div
      className='fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50'
      onClick={onClose}>
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
            onClick={onClose}
            className='text-[#71717a] hover:text-[#09090b]'>
            <X size={18} />
          </button>
        </div>

        {/* Ticket Info Box */}
        <div className='p-3.5 bg-[#f9f9fb] border border-[#e4e4e7] rounded-xl text-xs space-y-1'>
          <div className='font-bold text-[#09090b]'>{ticket.eventName}</div>
          <div className='text-[#71717a]'>
            Hạng vé: <strong>{ticket.ticketName}</strong> • Giá gốc:{' '}
            <strong>{(ticket.ticketPrice || 0).toLocaleString('vi-VN')} ₫</strong>
          </div>
        </div>

        <form onSubmit={handleSubmit} className='space-y-4 text-xs'>
          {/* Price Input */}
          <div className='space-y-1.5'>
            <label className='font-semibold text-[#09090b] flex items-center justify-between'>
              <span>Giá bán lại mong muốn (VNĐ) *</span>
              <span className='text-[11px] text-[#71717a]'>
                Tối đa 110%: {maxAllowed.toLocaleString('vi-VN')} ₫
              </span>
            </label>
            <input
              type='number'
              required
              min={1}
              max={maxAllowed}
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
              onClick={onClose}
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
  );
}
