/* Hallmark · pre-emit critique: P5 H5 E5 S4 R5 V5 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Tag,
  Plus,
  TrendingUp,
  Ticket,
  DollarSign,
  ArrowLeft,
  X,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Percent,
  Calendar,
} from 'lucide-react';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { PATHS } from '../../routes/paths';

const fmtDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function OrganizerVouchersPage() {
  const { eventId } = useParams();
  const { showToast } = useToast();

  const [summary, setSummary] = useState(null);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Create form state
  const [formData, setFormData] = useState({
    code: '',
    discountType: 'PERCENT',
    discountValue: '10',
    maxDiscountAmount: '',
    minOrderAmount: '0',
    usageLimit: '100',
    maxPerUser: '1',
    validFrom: new Date().toISOString().slice(0, 16),
    validUntil: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
  });

  const fetchVouchers = async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      const res = await api.get(`/organizer/events/${eventId}/vouchers`);
      setSummary(res.summary || {});
      setVouchers(res.items || []);
    } catch (err) {
      showToast(err.message || 'Không thể tải danh sách mã khuyến mãi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, [eventId]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setCreateModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await api.post(`/organizer/events/${eventId}/vouchers`, {
        code: formData.code.trim().toUpperCase(),
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        maxDiscountAmount:
          formData.discountType === 'PERCENT' && formData.maxDiscountAmount && Number(formData.maxDiscountAmount) > 0
            ? Number(formData.maxDiscountAmount)
            : undefined,
        minOrderAmount: Number(formData.minOrderAmount || 0),
        usageLimit: Number(formData.usageLimit || 100),
        maxPerUser: Number(formData.maxPerUser || 1),
        validFrom: new Date(formData.validFrom).toISOString(),
        validUntil: new Date(formData.validUntil).toISOString(),
        isActive: true,
      });

      showToast(`Đã phát hành mã voucher ${formData.code.toUpperCase()}!`);
      setCreateModalOpen(false);
      setFormData({ ...formData, code: '' });
      fetchVouchers();
    } catch (err) {
      showToast(err.message || 'Không thể tạo mã khuyến mãi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (v) => {
    try {
      await api.put(`/organizer/vouchers/${v._id}`, { isActive: !v.isActive });
      showToast(v.isActive ? `Đã tạm ngưng mã ${v.code}` : `Đã kích hoạt mã ${v.code}`);
      fetchVouchers();
    } catch (err) {
      showToast(err.message || 'Không thể cập nhật trạng thái voucher');
    }
  };

  return (
    <div className='max-w-5xl mx-auto space-y-6'>
      {/* Header & Back */}
      <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
        <div className='space-y-1'>
          <Link
            to={PATHS.ORGANIZER_DASHBOARD}
            className='inline-flex items-center gap-1.5 text-xs font-semibold text-[#71717a] hover:text-[#09090b]'>
            <ArrowLeft size={13} />
            <span>Về Bảng điều khiển Ban Tổ Chức</span>
          </Link>
          <h1 className='text-2xl font-bold tracking-tight text-[#09090b]'>Quản Lý Voucher &amp; ROI</h1>
          <p className='text-xs text-[#71717a]'>
            Mã sự kiện: <span className='font-mono font-semibold text-[#09090b]'>{eventId}</span>
          </p>
        </div>

        <button
          type='button'
          onClick={() => setCreateModalOpen(true)}
          className='inline-flex items-center gap-2 px-5 py-2.5 bg-[#09090b] text-white text-xs font-semibold rounded-full hover:bg-[#27272a] transition-colors shrink-0'>
          <Plus size={15} />
          <span>Tạo mã giảm giá mới</span>
        </button>
      </div>

      {/* ROI Summary Cards */}
      {summary && (
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
          <div className='bg-white border border-[#e4e4e7] p-5 rounded-2xl'>
            <div className='text-xs font-bold uppercase tracking-wider text-[#71717a]'>Tổng số mã</div>
            <div className='text-2xl font-extrabold text-[#09090b] mt-1'>{summary.totalVouchers || 0}</div>
            <div className='text-[11px] text-[#09090b] font-semibold mt-1'>
              Đang hoạt động: {summary.activeVouchers || 0}
            </div>
          </div>

          <div className='bg-white border border-[#e4e4e7] p-5 rounded-2xl'>
            <div className='text-xs font-bold uppercase tracking-wider text-[#71717a]'>Lượt sử dụng</div>
            <div className='text-2xl font-extrabold text-[#09090b] mt-1'>{summary.totalUsedCount || 0}</div>
            <div className='text-[11px] text-[#71717a] mt-1'>
              Đơn hàng đã thanh toán: {summary.paidOrdersWithVoucher || 0}
            </div>
          </div>

          <div className='bg-white border border-[#e4e4e7] p-5 rounded-2xl'>
            <div className='text-xs font-bold uppercase tracking-wider text-[#71717a]'>Tổng tiền đã giảm</div>
            <div className='text-2xl font-extrabold text-[#09090b] mt-1'>
              {(summary.totalDiscountGranted || 0).toLocaleString('vi-VN')} ₫
            </div>
            <div className='text-[11px] text-[#71717a] mt-1'>Chi phí khuyến mãi</div>
          </div>

          <div className='bg-white border border-[#e4e4e7] p-5 rounded-2xl'>
            <div className='text-xs font-bold uppercase tracking-wider text-[#71717a]'>Doanh thu ròng thu về</div>
            <div className='text-2xl font-extrabold text-[#09090b] mt-1'>
              {(summary.netRevenueGenerated || 0).toLocaleString('vi-VN')} ₫
            </div>
            <div className='text-[11px] text-[#71717a] mt-1'>Từ các đơn áp dụng voucher</div>
          </div>
        </div>
      )}

      {/* Vouchers Table */}
      <div className='bg-white border border-[#e4e4e7] rounded-3xl p-6 space-y-4'>
        <h2 className='text-base font-bold text-[#09090b]'>Danh sách mã khuyến mãi đã phát hành</h2>

        {loading ? (
          <div className='py-12 text-center text-xs text-[#71717a]'>Đang tải dữ liệu voucher...</div>
        ) : vouchers.length === 0 ? (
          <div className='py-12 text-center text-xs text-[#71717a] border border-dashed border-[#e4e4e7] rounded-2xl'>
            Chưa có mã khuyến mãi nào cho sự kiện này. Hãy bấm &ldquo;Tạo mã giảm giá mới&rdquo; để kích cầu doanh số!
          </div>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-xs text-left'>
              <thead>
                <tr className='border-b border-[#e4e4e7] text-[#71717a] uppercase text-[11px]'>
                  <th className='py-3 px-3'>Mã Voucher</th>
                  <th className='py-3 px-3'>Mức giảm</th>
                  <th className='py-3 px-3'>Thời gian áp dụng</th>
                  <th className='py-3 px-3'>Lượt dùng</th>
                  <th className='py-3 px-3 text-right'>Doanh thu ROI</th>
                  <th className='py-3 px-3 text-center'>Trạng thái</th>
                  <th className='py-3 px-3 text-right'>Thao tác</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-[#f4f4f6]'>
                {vouchers.map((v) => {
                  const isExpired = v.validUntil && new Date(v.validUntil) < new Date();
                  const notStarted = v.validFrom && new Date(v.validFrom) > new Date();

                  return (
                    <tr key={v._id}>
                      <td className='py-3.5 px-3'>
                        <div className='font-mono font-bold text-sm text-[#09090b]'>{v.code}</div>
                        <div className='text-[11px] text-[#71717a]'>
                          Đơn tối thiểu: {(v.minOrderAmount || 0).toLocaleString('vi-VN')} ₫
                        </div>
                      </td>

                      <td className='py-3.5 px-3 font-semibold text-[#09090b]'>
                        {v.discountType === 'PERCENT'
                          ? `Giảm ${v.discountValue}%`
                          : `Giảm ${(v.discountValue || 0).toLocaleString('vi-VN')} ₫`}
                        {v.maxDiscountAmount && v.discountType === 'PERCENT' && (
                          <div className='text-[10px] text-[#71717a] font-normal'>
                            Tối đa {v.maxDiscountAmount.toLocaleString('vi-VN')} ₫
                          </div>
                        )}
                      </td>

                      <td className='py-3.5 px-3'>
                        <div className='space-y-0.5 text-[11px] min-w-[170px]'>
                          <div className='text-[#09090b] flex items-center gap-1.5'>
                            <Calendar size={12} className='text-[#71717a] shrink-0' />
                            <span>{fmtDate(v.validFrom)}</span>
                          </div>
                          <div className='text-[#71717a] pl-4 text-[10px]'>
                            đến <span className='text-[#09090b] font-medium'>{fmtDate(v.validUntil)}</span>
                          </div>
                          <div className='pl-4 mt-0.5'>
                            {isExpired ? (
                              <span className='inline-block text-[10px] text-red-600 font-semibold'>
                                • Đã hết hạn
                              </span>
                            ) : notStarted ? (
                              <span className='inline-block text-[10px] text-amber-600 font-semibold'>
                                • Chưa bắt đầu
                              </span>
                            ) : (
                              <span className='inline-block text-[10px] text-emerald-600 font-semibold'>
                                • Đang áp dụng
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className='py-3.5 px-3'>
                        <div className='font-bold text-[#09090b]'>
                          {v.usedCount || 0} / {v.usageLimit}
                        </div>
                        <div className='w-24 h-1.5 bg-[#f4f4f6] rounded-full mt-1 overflow-hidden'>
                          <div
                            className='h-full bg-[#09090b]'
                            style={{ width: `${Math.min(100, v.stats?.usageRatePct || 0)}%` }}
                          />
                        </div>
                      </td>

                      <td className='py-3.5 px-3 text-right'>
                        <div className='font-bold text-[#09090b]'>
                          {(v.stats?.netRevenueGenerated || 0).toLocaleString('vi-VN')} ₫
                        </div>
                        <div className='text-[10px] text-[#71717a]'>
                          {v.stats?.paidOrdersCount || 0} đơn thành công
                        </div>
                      </td>

                      <td className='py-3.5 px-3 text-center'>
                        {isExpired ? (
                          <span className='px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-red-50 text-red-700 border border-red-200'>
                            Hết hạn
                          </span>
                        ) : (
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                              v.isActive
                                ? 'bg-[#09090b] text-white'
                                : 'bg-[#f4f4f6] text-[#52525b] border border-[#e4e4e7]'
                            }`}>
                            {v.isActive ? 'Đang chạy' : 'Tạm ngưng'}
                          </span>
                        )}
                      </td>

                    <td className='py-3.5 px-3 text-right'>
                      <button
                        type='button'
                        onClick={() => handleToggleActive(v)}
                        className='inline-flex items-center gap-1 px-3 py-1 border border-[#e4e4e7] rounded-full text-[11px] font-semibold hover:bg-[#f4f4f6] transition-colors'>
                        {v.isActive ? (
                          <>
                            <PauseCircle size={13} />
                            <span>Ngưng</span>
                          </>
                        ) : (
                          <>
                            <PlayCircle size={13} />
                            <span>Kích hoạt</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Voucher Modal */}
      {createModalOpen && (
        <div
          className='fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50'
          onClick={() => setCreateModalOpen(false)}>
          <div
            className='bg-white border border-[#e4e4e7] rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto'
            onClick={(e) => e.stopPropagation()}>
            <div className='flex justify-between items-center'>
              <h3 className='text-lg font-bold text-[#09090b]'>Phát hành Voucher mới</h3>
              <button
                type='button'
                onClick={() => setCreateModalOpen(false)}
                className='text-[#71717a] hover:text-[#09090b]'>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className='space-y-3.5 text-xs'>
              <div className='space-y-1'>
                <label className='font-semibold text-[#09090b]'>Mã Code (A-Z, 0-9, 3-30 ký tự) *</label>
                <input
                  type='text'
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder='VD: EARLYBIRD20'
                  className='w-full px-3 py-2 border border-[#e4e4e7] rounded-xl font-mono outline-none focus:border-[#09090b]'
                />
              </div>

              <div className='grid grid-cols-2 gap-3'>
                <div className='space-y-1'>
                  <label className='font-semibold text-[#09090b]'>Loại giảm giá *</label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                    className='w-full px-3 py-2 border border-[#e4e4e7] rounded-xl outline-none focus:border-[#09090b]'>
                    <option value='PERCENT'>Phần trăm (%)</option>
                    <option value='FIXED'>Số tiền cố định (đ)</option>
                  </select>
                </div>

                <div className='space-y-1'>
                  <label className='font-semibold text-[#09090b]'>
                    Giá trị ({formData.discountType === 'PERCENT' ? '%' : 'VNĐ'}) *
                  </label>
                  <input
                    type='number'
                    required
                    min={1}
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                    className='w-full px-3 py-2 border border-[#e4e4e7] rounded-xl outline-none focus:border-[#09090b]'
                  />
                </div>
              </div>

              {formData.discountType === 'PERCENT' && (
                <div className='space-y-1'>
                  <label className='font-semibold text-[#09090b]'>
                    Số tiền giảm tối đa (đ) <span className='text-[#71717a] font-normal'>(bỏ trống nếu không giới hạn)</span>
                  </label>
                  <input
                    type='number'
                    min={0}
                    value={formData.maxDiscountAmount}
                    onChange={(e) => setFormData({ ...formData, maxDiscountAmount: e.target.value })}
                    placeholder='VD: 100000'
                    className='w-full px-3 py-2 border border-[#e4e4e7] rounded-xl outline-none focus:border-[#09090b]'
                  />
                </div>
              )}

              <div className='grid grid-cols-2 gap-3'>
                <div className='space-y-1'>
                  <label className='font-semibold text-[#09090b]'>Đơn tối thiểu (đ)</label>
                  <input
                    type='number'
                    min={0}
                    value={formData.minOrderAmount}
                    onChange={(e) => setFormData({ ...formData, minOrderAmount: e.target.value })}
                    className='w-full px-3 py-2 border border-[#e4e4e7] rounded-xl outline-none focus:border-[#09090b]'
                  />
                </div>
                <div className='space-y-1'>
                  <label className='font-semibold text-[#09090b]'>Giới hạn lượt dùng</label>
                  <input
                    type='number'
                    required
                    min={1}
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                    className='w-full px-3 py-2 border border-[#e4e4e7] rounded-xl outline-none focus:border-[#09090b]'
                  />
                </div>
              </div>

              <div className='grid grid-cols-2 gap-3'>
                <div className='space-y-1'>
                  <label className='font-semibold text-[#09090b]'>Hiệu lực từ</label>
                  <input
                    type='datetime-local'
                    required
                    value={formData.validFrom}
                    onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                    className='w-full px-3 py-2 border border-[#e4e4e7] rounded-xl outline-none focus:border-[#09090b]'
                  />
                </div>
                <div className='space-y-1'>
                  <label className='font-semibold text-[#09090b]'>Đến ngày</label>
                  <input
                    type='datetime-local'
                    required
                    value={formData.validUntil}
                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                    className='w-full px-3 py-2 border border-[#e4e4e7] rounded-xl outline-none focus:border-[#09090b]'
                  />
                </div>
              </div>

              <div className='flex gap-2 pt-2'>
                <button
                  type='button'
                  onClick={() => setCreateModalOpen(false)}
                  className='flex-1 py-2.5 border border-[#e4e4e7] text-[#52525b] font-semibold rounded-full hover:bg-[#f4f4f6] transition-colors'>
                  Hủy
                </button>
                <button
                  type='submit'
                  disabled={submitting}
                  className='flex-1 py-2.5 bg-[#09090b] text-white font-semibold rounded-full hover:bg-[#27272a] disabled:opacity-50 transition-colors'>
                  {submitting ? 'Đang tạo...' : 'Phát hành ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
