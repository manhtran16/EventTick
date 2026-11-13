import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Clock, XCircle, FileText, Upload, Loader2 } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { inputCls } from '../../components/FormField';

const STATUS = {
  PENDING: { label: 'Đang chờ Admin duyệt', cls: 'bg-[#f4f4f6] text-[#09090b] border-[#e4e4e7]', icon: Clock },
  VERIFIED: { label: 'Đã được duyệt', cls: 'bg-[#09090b] text-white border-[#09090b]', icon: ShieldCheck },
  REJECTED: { label: 'Bị từ chối', cls: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
};
const EMPTY = { organizationName: '', businessType: 'INDIVIDUAL', taxCode: '', phone: '', bankName: '', bankAccountNo: '', bankAccountHolder: '' };
const label = 'block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5';

/** UC21: nộp hồ sơ pháp nhân (KYC). Giấy tờ lưu kho riêng tư, chỉ Admin và chính chủ xem được. */
export default function OrganizerKycPage() {
  const { user, refreshUser } = useAuth();
  // Khách thường xem trong layout công khai (không có khung) nên tự căn giữa; nhà tổ chức nằm trong dashboard
  const standalone = user?.role === 'CUSTOMER';
  const { showToast } = useToast();
  const fileRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const r = await api.get('/organizer/kyc');
      setProfile(r.profile);
      if (r.profile) {
        setForm({
          organizationName: r.profile.organizationName || '',
          businessType: r.profile.businessType || 'INDIVIDUAL',
          taxCode: r.profile.taxCode || '',
          phone: r.profile.phone || user?.phone || '',
          bankName: r.profile.bankName || '',
          bankAccountNo: r.profile.bankAccountNo || '',
          bankAccountHolder: r.profile.bankAccountHolder || '',
        });
      } else {
        setForm({ ...EMPTY, phone: user?.phone || '' });
      }
    } catch (err) {
      showToast(err.message || 'Không tải được hồ sơ KYC');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = profile?.kycStatus;
  const locked = status === 'PENDING' || status === 'VERIFIED';
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.type)) {
      showToast('Giấy tờ phải là ảnh JPG, PNG, WEBP hoặc PDF');
      e.target.value = '';
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      showToast('Tệp quá lớn (tối đa 10MB)');
      e.target.value = '';
      return;
    }
    setFile(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\d{10}(-?\d{3})?$/.test(form.taxCode.trim())) return showToast('Mã số thuế phải gồm 10 hoặc 13 chữ số');
    if (!/^[0-9+\s]{8,15}$/.test(form.phone.trim())) return showToast('Số điện thoại không hợp lệ');
    if (!/^\d{6,20}$/.test(form.bankAccountNo.trim())) return showToast('Số tài khoản chỉ gồm 6–20 chữ số');
    if (!file && !profile?.hasDocument) return showToast('Vui lòng tải lên giấy tờ (CCCD hoặc giấy phép ĐKKD)');

    const fd = new FormData();
    fd.append('organizationName', form.organizationName.trim());
    fd.append('businessType', form.businessType);
    fd.append('taxCode', form.taxCode.trim());
    fd.append('phone', form.phone.trim());
    fd.append('bankName', form.bankName.trim());
    fd.append('bankAccountNo', form.bankAccountNo.trim());
    fd.append('bankAccountHolder', form.bankAccountHolder.trim().toUpperCase());
    if (file) fd.append('document', file);

    setSubmitting(true);
    try {
      await api.post('/organizer/kyc', fd);
      showToast('Đã gửi hồ sơ, vui lòng chờ Admin duyệt');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      await load();
      await refreshUser();
    } catch (err) {
      showToast(err.message || 'Không gửi được hồ sơ');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className='text-[#71717a] flex items-center gap-2 py-10'>
        <Loader2 size={16} className='animate-spin' /> Đang tải...
      </div>
    );

  const badge = status ? STATUS[status] : null;
  const BadgeIcon = badge?.icon;

  return (
    <div className={standalone ? 'tb-container py-10' : ''}>
    <div className={`max-w-3xl space-y-6 ${standalone ? 'mx-auto' : ''}`}>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>Xác minh nhà tổ chức (KYC)</h1>
        <p className='text-sm text-[#71717a] mt-1'>Cần được duyệt hồ sơ trước khi tạo sự kiện và nhận doanh thu.</p>
      </div>

      {badge && (
        <div className={`flex items-start gap-3 p-4 border rounded-xl ${badge.cls}`}>
          <BadgeIcon size={20} className='mt-0.5 shrink-0' />
          <div className='text-sm'>
            <div className='font-bold'>{badge.label}</div>
            {status === 'REJECTED' && profile.rejectionReason && <div className='mt-1'>Lý do: {profile.rejectionReason}</div>}
            {status === 'REJECTED' && <div className='mt-1'>Bạn có thể chỉnh sửa và gửi lại bên dưới.</div>}
            {status === 'VERIFIED' && <div className='mt-1'>Bạn đã có thể tạo sự kiện.</div>}
          </div>
        </div>
      )}

      <form onSubmit={submit} className='bg-white border border-[#e4e4e7] rounded-2xl p-6 space-y-4'>
        <fieldset disabled={locked} className='space-y-4 disabled:opacity-70'>
          <div>
            <label htmlFor='k-org' className={label}>Tên đơn vị / cá nhân tổ chức</label>
            <input id='k-org' required className={inputCls} value={form.organizationName} onChange={set('organizationName')} />
          </div>
          <div className='grid gap-4 sm:grid-cols-3'>
            <div>
              <label htmlFor='k-type' className={label}>Loại hình</label>
              <select id='k-type' className={inputCls} value={form.businessType} onChange={set('businessType')}>
                <option value='INDIVIDUAL'>Cá nhân</option>
                <option value='ENTERPRISE'>Doanh nghiệp</option>
              </select>
            </div>
            <div>
              <label htmlFor='k-tax' className={label}>Mã số thuế</label>
              <input id='k-tax' required className={inputCls} value={form.taxCode} onChange={set('taxCode')} placeholder='10 hoặc 13 chữ số' />
            </div>
            <div>
              <label htmlFor='k-phone' className={label}>Số điện thoại</label>
              <input id='k-phone' type='tel' required className={inputCls} value={form.phone} onChange={set('phone')} placeholder='0912345678' />
            </div>
          </div>
          <div className='grid gap-4 sm:grid-cols-3'>
            <div>
              <label htmlFor='k-bank' className={label}>Ngân hàng</label>
              <input id='k-bank' required className={inputCls} value={form.bankName} onChange={set('bankName')} placeholder='Vietcombank' />
            </div>
            <div>
              <label htmlFor='k-acc' className={label}>Số tài khoản</label>
              <input id='k-acc' required className={inputCls} value={form.bankAccountNo} onChange={set('bankAccountNo')} inputMode='numeric' />
            </div>
            <div>
              <label htmlFor='k-holder' className={label}>Chủ tài khoản</label>
              <input id='k-holder' required className={inputCls} value={form.bankAccountHolder} onChange={set('bankAccountHolder')} />
            </div>
          </div>

          <div>
            <div className={label}>Giấy tờ pháp lý (CCCD hoặc giấy phép ĐKKD)</div>
            <button type='button' onClick={() => fileRef.current?.click()} className='tb-btn tb-btn-outline'>
              <Upload size={15} /> {file ? 'Đổi tệp' : 'Chọn tệp'}
            </button>
            <input ref={fileRef} type='file' accept='image/jpeg,image/png,image/webp,application/pdf' className='hidden' onChange={pick} />
            <p className='text-xs text-[#71717a] mt-2 flex items-center gap-1.5'>
              <FileText size={13} />
              {file ? file.name : profile?.hasDocument ? 'Đã có giấy tờ trên hệ thống (giữ riêng tư)' : 'Chưa chọn tệp (JPG, PNG, WEBP hoặc PDF, tối đa 10MB)'}
            </p>
          </div>
        </fieldset>

        {!locked && (
          <button type='submit' disabled={submitting} className='tb-btn tb-btn-solid' style={{ height: 44, padding: '0 24px' }}>
            {submitting ? 'Đang gửi...' : status === 'REJECTED' ? 'Gửi lại hồ sơ' : 'Gửi hồ sơ xác minh'}
          </button>
        )}
      </form>
    </div>
    </div>
  );
}
