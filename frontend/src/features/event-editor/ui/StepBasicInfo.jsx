import { Upload } from 'lucide-react';
import { inputCls } from '../../../components/FormField';
import { useToast } from '../../../context/ToastContext';
import { useEventEditorStore } from '../model/useEventEditorStore';

const label = 'block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5';

export default function StepBasicInfo() {
  const {
    info,
    updateInfoField,
    categories,
    editing,
    status,
    banner,
    setBanner,
    thumb,
    setThumb,
    legalDoc,
    setLegalDoc,
    hasLegalDoc,
  } = useEventEditorStore();

  const { showToast } = useToast();
  const structural = !editing || status === 'DRAFT';

  const pickImage = (setter) => (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
      showToast('Ảnh phải là JPG, PNG hoặc WEBP');
      e.target.value = '';
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      showToast('Ảnh quá lớn (tối đa 5MB)');
      e.target.value = '';
      return;
    }
    setter(f);
  };

  const pickLegalDoc = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.type)) {
      showToast('Giấy phép phải là ảnh JPG, PNG, WEBP hoặc PDF');
      e.target.value = '';
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      showToast('Tệp quá lớn (tối đa 10MB)');
      e.target.value = '';
      return;
    }
    setLegalDoc(f);
  };

  return (
    <div className='space-y-5'>
      <div>
        <label htmlFor='e-title' className={label}>
          Tên sự kiện
        </label>
        <input
          id='e-title'
          disabled={!structural}
          className={inputCls}
          value={info.title}
          onChange={(e) => updateInfoField('title', e.target.value)}
          maxLength={255}
        />
      </div>

      <div className='grid gap-4 sm:grid-cols-3'>
        <div>
          <label htmlFor='e-cat' className={label}>
            Danh mục
          </label>
          <select
            id='e-cat'
            disabled={!structural}
            className={inputCls}
            value={info.category}
            onChange={(e) => updateInfoField('category', e.target.value)}>
            {editing && <option value=''>(giữ nguyên)</option>}
            {categories.map((c) => (
              <option key={c._id || c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor='e-venue' className={label}>
            Địa điểm
          </label>
          <input
            id='e-venue'
            disabled={!structural}
            className={inputCls}
            value={info.venueName}
            onChange={(e) => updateInfoField('venueName', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor='e-city' className={label}>
            Thành phố
          </label>
          <input
            id='e-city'
            disabled={!structural}
            className={inputCls}
            value={info.city}
            onChange={(e) => updateInfoField('city', e.target.value)}
          />
        </div>
      </div>

      <div>
        <label htmlFor='e-desc' className={label}>
          Mô tả (hỗ trợ HTML cơ bản)
        </label>
        <textarea
          id='e-desc'
          rows={6}
          className={inputCls}
          value={info.description}
          onChange={(e) => updateInfoField('description', e.target.value)}
        />
      </div>

      <div>
        <label htmlFor='e-org' className={label}>
          Thông tin đơn vị tổ chức
        </label>
        <textarea
          id='e-org'
          rows={2}
          className={inputCls}
          value={info.organizerInfo}
          onChange={(e) => updateInfoField('organizerInfo', e.target.value)}
        />
      </div>

      <div className='grid gap-4 sm:grid-cols-2'>
        {[
          ['Ảnh bìa (banner)', banner, setBanner],
          ['Ảnh đại diện (thumbnail)', thumb, setThumb],
        ].map(([t, f, setter]) => (
          <div key={t}>
            <div className={label}>
              {t}
              {!editing && t.startsWith('Ảnh bìa') && ' *'}
            </div>
            <label className='tb-btn tb-btn-outline cursor-pointer'>
              <Upload size={14} /> {f ? 'Đổi ảnh' : 'Chọn ảnh'}
              <input
                type='file'
                accept='image/jpeg,image/png,image/webp'
                className='hidden'
                onChange={pickImage(setter)}
              />
            </label>
            <p className='text-xs text-[#71717a] mt-2'>
              {f ? f.name : editing ? 'Giữ ảnh hiện tại nếu không chọn' : 'JPG, PNG, WEBP, tối đa 5MB'}
            </p>
          </div>
        ))}
      </div>

      <div className='border-t border-[#f4f4f6] pt-4 space-y-2'>
        <div className={label}>Giấy phép tổ chức sự kiện (bắt buộc khi gửi duyệt)</div>
        {editing && !['DRAFT', 'PENDING'].includes(status) ? (
          <p className='text-xs text-[#71717a]'>
            {hasLegalDoc ? 'Đã nộp giấy phép.' : 'Chưa có giấy phép.'} Sự kiện đã được duyệt nên không thay được.
          </p>
        ) : (
          <>
            <label className='tb-btn tb-btn-outline cursor-pointer'>
              <Upload size={14} /> {legalDoc ? 'Đổi tệp' : hasLegalDoc ? 'Thay giấy phép' : 'Chọn tệp'}
              <input
                type='file'
                accept='image/jpeg,image/png,image/webp,application/pdf'
                className='hidden'
                onChange={pickLegalDoc}
              />
            </label>
            <p className='text-xs text-[#71717a]'>
              {legalDoc
                ? legalDoc.name
                : hasLegalDoc
                ? 'Đã có giấy phép trên hệ thống (lưu riêng tư, chỉ Admin duyệt xem được). Chọn tệp mới nếu muốn thay.'
                : 'Giấy phép biểu diễn / tổ chức sự kiện do cơ quan có thẩm quyền cấp. JPG, PNG, WEBP hoặc PDF, tối đa 10MB.'}
            </p>
          </>
        )}
      </div>

      <div className='border-t border-[#f4f4f6] pt-4 space-y-3'>
        <label className='flex items-center gap-2.5 text-sm cursor-pointer'>
          <input
            type='checkbox'
            disabled={!structural}
            className='w-4 h-4 accent-[#09090b]'
            checked={info.allowResale}
            onChange={(e) => updateInfoField('allowResale', e.target.checked)}
          />
          Cho phép khách bán lại vé trên chợ chính thức
        </label>
        {info.allowResale && (
          <div className='max-w-xs'>
            <label htmlFor='e-markup' className={label}>
              Giá bán lại tối đa (+% so với giá gốc)
            </label>
            <input
              id='e-markup'
              type='number'
              min='0'
              max='100'
              disabled={!structural}
              className={inputCls}
              value={info.maxResaleMarkupPct}
              onChange={(e) => updateInfoField('maxResaleMarkupPct', e.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
