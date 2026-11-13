import { useCallback, useEffect, useState } from 'react';
import { Loader2, FileText, Check, X } from 'lucide-react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { inputCls } from '../../components/FormField';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/v1';
const TABS = [
  { k: 'PENDING', t: 'Chờ duyệt' },
  { k: 'VERIFIED', t: 'Đã duyệt' },
  { k: 'REJECTED', t: 'Đã từ chối' },
];
const fmt = (d) => (d ? new Date(d).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—');

/** UC38: duyệt hồ sơ KYC nhà tổ chức. Giấy tờ lưu riêng tư, Admin mở bằng link có chữ ký hết hạn 5 phút. */
export default function AdminKycPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState('PENDING');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/admin/kyc?status=${tab}&limit=50`);
      setItems(r.items || []);
    } catch (err) {
      showToast(err.message || 'Không tải được danh sách hồ sơ');
    } finally {
      setLoading(false);
    }
  }, [tab, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const openDoc = async (p) => {
    setBusy(`doc:${p._id}`);
    try {
      const r = await api.get(`/admin/kyc/${p._id}/document`);
      if (r.url) window.open(r.url, '_blank', 'noopener');
      else window.open(`${BASE}/admin/kyc/${p._id}/document`, '_blank', 'noopener');
    } catch (err) {
      showToast(err.message || 'Không mở được giấy tờ');
    } finally {
      setBusy('');
    }
  };

  const approve = async () => {
    setBusy(`ok:${approving._id}`);
    try {
      await api.put(`/admin/kyc/${approving._id}/approve`, {});
      showToast('Đã duyệt hồ sơ');
      setApproving(null);
      load();
    } catch (err) {
      showToast(err.message || 'Không duyệt được');
    } finally {
      setBusy('');
    }
  };

  const reject = async () => {
    if (!reason.trim()) return showToast('Vui lòng nhập lý do từ chối');
    setBusy(`no:${rejecting._id}`);
    try {
      await api.put(`/admin/kyc/${rejecting._id}/reject`, { reason: reason.trim() });
      showToast('Đã từ chối hồ sơ');
      setRejecting(null);
      setReason('');
      load();
    } catch (err) {
      showToast(err.message || 'Không từ chối được');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className='space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Duyệt hồ sơ nhà tổ chức (KYC)</h1>
        <p className='text-sm text-[#71717a] mt-1'>Kiểm tra giấy tờ pháp lý trước khi cho phép tạo sự kiện và nhận doanh thu.</p>
      </div>

      <div className='flex gap-2'>
        {TABS.map(({ k, t }) => (
          <button
            key={k}
            type='button'
            onClick={() => setTab(k)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${tab === k ? 'bg-[#09090b] text-white border-[#09090b]' : 'bg-white border-[#e4e4e7] text-[#52525b] hover:border-[#09090b]'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className='text-[#71717a] flex items-center gap-2'>
          <Loader2 size={16} className='animate-spin' /> Đang tải...
        </div>
      ) : items.length === 0 ? (
        <div className='bg-white border border-[#e4e4e7] rounded-2xl p-12 text-center text-sm text-[#71717a]'>Không có hồ sơ nào.</div>
      ) : (
        <div className='grid gap-4'>
          {items.map((p) => (
            <div key={p._id} className='bg-white border border-[#e4e4e7] rounded-2xl p-5 space-y-3'>
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                  <h2 className='font-bold'>{p.organizationName}</h2>
                  <p className='text-xs text-[#71717a]'>
                    {p.businessType === 'ENTERPRISE' ? 'Doanh nghiệp' : 'Cá nhân'} · gửi lúc {fmt(p.submittedAt)}
                  </p>
                </div>
                <div className='flex flex-wrap gap-2'>
                  <button type='button' className='tb-btn tb-btn-outline tb-btn-sm' disabled={!p.hasDocument || busy === `doc:${p._id}`} onClick={() => openDoc(p)}>
                    <FileText size={13} /> Xem giấy tờ
                  </button>
                  {p.kycStatus === 'PENDING' && (
                    <>
                      <button type='button' className='tb-btn tb-btn-solid tb-btn-sm' disabled={busy === `ok:${p._id}`} onClick={() => setApproving(p)}>
                        <Check size={13} /> Duyệt
                      </button>
                      <button type='button' className='tb-btn tb-btn-outline tb-btn-sm text-red-700' onClick={() => { setRejecting(p); setReason(''); }}>
                        <X size={13} /> Từ chối
                      </button>
                    </>
                  )}
                </div>
              </div>
              <dl className='grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2'>
                {[
                  ['Chủ tài khoản hệ thống', `${p.owner?.fullName || '—'} (${p.owner?.email || '—'})`],
                  ['Số điện thoại', p.owner?.phone],
                  ['Mã số thuế', p.taxCode],
                  ['Ngân hàng', `${p.bankName} · ${p.bankAccountNo} · ${p.bankAccountHolder}`],
                ].map(([k, v]) => (
                  <div key={k} className='flex gap-2'>
                    <dt className='text-[#71717a] shrink-0'>{k}:</dt>
                    <dd className='font-medium break-all'>{v || '—'}</dd>
                  </div>
                ))}
              </dl>
              {p.kycStatus === 'REJECTED' && p.rejectionReason && (
                <p className='text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2'>Lý do từ chối: {p.rejectionReason}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {approving && (
        <div className='fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50' onClick={() => setApproving(null)}>
          <div className='bg-white rounded-2xl w-full max-w-md p-6 space-y-4' onClick={(e) => e.stopPropagation()}>
            <h3 className='font-bold'>Duyệt hồ sơ &quot;{approving.organizationName}&quot;</h3>
            <p className='text-sm text-[#52525b]'>Tài khoản sẽ trở thành nhà tổ chức và được phép tạo sự kiện, nhận doanh thu.</p>
            <div className='flex gap-3'>
              <button type='button' className='tb-btn tb-btn-solid' disabled={busy === `ok:${approving._id}`} onClick={approve}>
                Xác nhận duyệt
              </button>
              <button type='button' className='tb-btn tb-btn-outline' disabled={busy === `ok:${approving._id}`} onClick={() => setApproving(null)}>
                Huỷ
              </button>
            </div>
          </div>
        </div>
      )}

      {rejecting && (
        <div className='fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50' onClick={() => setRejecting(null)}>
          <div className='bg-white rounded-2xl w-full max-w-md p-6 space-y-4' onClick={(e) => e.stopPropagation()}>
            <h3 className='font-bold'>Từ chối hồ sơ &quot;{rejecting.organizationName}&quot;</h3>
            <div>
              <label htmlFor='kyc-reason' className='block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5'>Lý do (bắt buộc, người nộp sẽ thấy)</label>
              <textarea id='kyc-reason' rows={4} className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} />
            </div>
            <div className='flex gap-3'>
              <button type='button' className='tb-btn tb-btn-solid' disabled={busy === `no:${rejecting._id}`} onClick={reject}>
                Xác nhận từ chối
              </button>
              <button type='button' className='tb-btn tb-btn-outline' onClick={() => setRejecting(null)}>
                Huỷ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
