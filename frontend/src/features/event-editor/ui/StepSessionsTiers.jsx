import { Plus, Trash2 } from 'lucide-react';
import { inputCls } from '../../../components/FormField';
import { useEventEditorStore } from '../model/useEventEditorStore';

const label = 'block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5';

export default function StepSessionsTiers() {
  const {
    sessions,
    editing,
    status,
    addSession,
    removeSession,
    updateSession,
    addTier,
    removeTier,
    updateTier,
  } = useEventEditorStore();

  const structural = !editing || status === 'DRAFT';

  return (
    <div className='space-y-6'>
      {editing && structural && (
        <p className='text-xs text-[#71717a]'>
          Ở chế độ sửa, suất diễn và hạng vé hiển thị để xem. Muốn đổi, hãy dùng chức năng thêm / sửa suất diễn khi sự kiện còn là bản nháp.
        </p>
      )}

      {sessions.map((s, i) => (
        <div key={s.id || i} className='border border-[#e4e4e7] rounded-xl p-4 space-y-4'>
          <div className='flex items-center justify-between'>
            <h3 className='font-bold'>Suất diễn {i + 1}</h3>
            {!editing && sessions.length > 1 && (
              <button
                type='button'
                className='text-xs text-red-700 flex items-center gap-1 cursor-pointer'
                onClick={() => removeSession(i)}>
                <Trash2 size={13} /> Xóa suất
              </button>
            )}
          </div>

          <div className='grid gap-4 sm:grid-cols-3'>
            <div>
              <label className={label}>Tên suất</label>
              <input
                disabled={editing}
                className={inputCls}
                value={s.name}
                onChange={(e) => updateSession(i, { name: e.target.value })}
                placeholder={`Suất diễn ${i + 1}`}
              />
            </div>
            <div>
              <label className={label}>Bắt đầu</label>
              <input
                type='datetime-local'
                disabled={editing}
                className={inputCls}
                value={s.startTime}
                onChange={(e) => updateSession(i, { startTime: e.target.value })}
              />
            </div>
            <div>
              <label className={label}>Kết thúc (tùy chọn)</label>
              <input
                type='datetime-local'
                disabled={editing}
                className={inputCls}
                value={s.endTime}
                onChange={(e) => updateSession(i, { endTime: e.target.value })}
              />
            </div>
          </div>

          <div className='space-y-3'>
            {s.tiers.map((t, k) => (
              <div
                key={t.id || k}
                className='grid gap-3 sm:grid-cols-[1.4fr_1fr_0.8fr_0.9fr_auto] items-end bg-[#f9f9fb] rounded-lg p-3'>
                <div>
                  <label className={label}>Hạng vé</label>
                  <input
                    disabled={editing}
                    className={inputCls}
                    value={t.name}
                    onChange={(e) => updateTier(i, k, { name: e.target.value })}
                    placeholder='VIP, Thường...'
                  />
                </div>
                <div>
                  <label className={label}>Giá (₫)</label>
                  <input
                    type='number'
                    min='0'
                    disabled={editing}
                    className={inputCls}
                    value={t.price}
                    onChange={(e) => updateTier(i, k, { price: e.target.value })}
                  />
                </div>
                <div>
                  <label className={label}>Số lượng</label>
                  <input
                    type='number'
                    min='1'
                    disabled={editing}
                    className={inputCls}
                    value={t.quantity}
                    onChange={(e) => updateTier(i, k, { quantity: e.target.value })}
                  />
                </div>
                <div>
                  <label className={label}>Loại</label>
                  <select
                    disabled={editing}
                    className={inputCls}
                    value={t.zoneType}
                    onChange={(e) => updateTier(i, k, { zoneType: e.target.value })}>
                    <option value='GA'>Vé đứng</option>
                    <option value='SEATED'>Ghế đánh số</option>
                  </select>
                </div>
                <div className='flex items-center gap-2'>
                  <input
                    type='color'
                    disabled={editing}
                    value={t.color}
                    onChange={(e) => updateTier(i, k, { color: e.target.value })}
                    className='w-9 h-9 rounded border border-[#e4e4e7] bg-white'
                    aria-label='Màu khu'
                  />
                  {!editing && s.tiers.length > 1 && (
                    <button
                      type='button'
                      aria-label='Xóa hạng vé'
                      className='text-red-700 cursor-pointer'
                      onClick={() => removeTier(i, k)}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {!editing && (
              <button
                type='button'
                className='tb-btn tb-btn-outline tb-btn-sm'
                onClick={() => addTier(i)}>
                <Plus size={13} /> Thêm hạng vé
              </button>
            )}
          </div>
        </div>
      ))}

      {!editing && (
        <button
          type='button'
          className='tb-btn tb-btn-outline'
          onClick={addSession}>
          <Plus size={14} /> Thêm suất diễn
        </button>
      )}

      <p className='text-xs text-[#71717a]'>
        Hạng vé &quot;Ghế đánh số&quot; cần sơ đồ chỗ ngồi: bạn tự tải file SVG + Excel ở bước &quot;Sơ đồ&quot; sau khi lưu bản nháp, không cần qua Admin.
      </p>
    </div>
  );
}
