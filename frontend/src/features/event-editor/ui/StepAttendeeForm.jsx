import { Plus, Trash2 } from 'lucide-react';
import { inputCls } from '../../../components/FormField';
import { FIELD_TYPES } from '../model/eventEditorConstants';
import { useEventEditorStore } from '../model/useEventEditorStore';

const label = 'block text-xs font-semibold uppercase tracking-wider text-[#52525b] mb-1.5';

export default function StepAttendeeForm() {
  const {
    questions,
    editing,
    status,
    addQuestion,
    removeQuestion,
    updateQuestion,
  } = useEventEditorStore();

  const structural = !editing || status === 'DRAFT';

  return (
    <div className='space-y-4'>
      <p className='text-sm text-[#52525b]'>
        Câu hỏi khách phải trả lời khi đặt vé (tối đa 20). Có thể bỏ trống nếu không cần.
      </p>

      {questions.map((q, i) => (
        <div
          key={i}
          className='border border-[#e4e4e7] rounded-xl p-4 grid gap-3 sm:grid-cols-[2fr_1fr_auto]'>
          <div>
            <label className={label}>Câu hỏi {i + 1}</label>
            <input
              disabled={!structural}
              className={inputCls}
              value={q.label}
              onChange={(e) => updateQuestion(i, { label: e.target.value })}
              placeholder='Ví dụ: Họ tên người tham dự'
            />
          </div>
          <div>
            <label className={label}>Kiểu</label>
            <select
              disabled={!structural}
              className={inputCls}
              value={q.type}
              onChange={(e) => updateQuestion(i, { type: e.target.value })}>
              {FIELD_TYPES.map((f) => (
                <option key={f.v} value={f.v}>
                  {f.t}
                </option>
              ))}
            </select>
          </div>
          <div className='flex items-end gap-3'>
            <label className='flex items-center gap-1.5 text-xs pb-2.5 cursor-pointer'>
              <input
                type='checkbox'
                disabled={!structural}
                className='w-4 h-4 accent-[#09090b]'
                checked={q.required}
                onChange={(e) => updateQuestion(i, { required: e.target.checked })}
              />{' '}
              Bắt buộc
            </label>
            {structural && (
              <button
                type='button'
                aria-label='Xóa câu hỏi'
                className='text-red-700 pb-2.5 cursor-pointer'
                onClick={() => removeQuestion(i)}>
                <Trash2 size={15} />
              </button>
            )}
          </div>
          {q.type === 'select' && (
            <div className='sm:col-span-3'>
              <label className={label}>Các lựa chọn (ngăn cách bằng dấu phẩy)</label>
              <input
                disabled={!structural}
                className={inputCls}
                value={q.optionsText}
                onChange={(e) => updateQuestion(i, { optionsText: e.target.value })}
                placeholder='S, M, L, XL'
              />
            </div>
          )}
        </div>
      ))}

      {structural && questions.length < 20 && (
        <button
          type='button'
          className='tb-btn tb-btn-outline'
          onClick={addQuestion}>
          <Plus size={14} /> Thêm câu hỏi
        </button>
      )}
    </div>
  );
}
