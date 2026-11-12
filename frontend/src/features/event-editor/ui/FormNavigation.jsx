import { useEventEditorStore } from '../model/useEventEditorStore';

export default function FormNavigation({ onNext, onSave }) {
  const { step, setStep, saving, editing } = useEventEditorStore();

  return (
    <div className='flex flex-wrap items-center justify-between gap-3'>
      <button
        type='button'
        disabled={step === 1}
        className='tb-btn tb-btn-outline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
        onClick={() => setStep((s) => s - 1)}>
        Quay lại
      </button>

      <div className='flex flex-wrap gap-3'>
        {step < 5 ? (
          <button type='button' className='tb-btn tb-btn-solid cursor-pointer' onClick={onNext}>
            Tiếp tục
          </button>
        ) : editing ? (
          <button
            type='button'
            disabled={saving}
            className='tb-btn tb-btn-solid cursor-pointer disabled:opacity-50'
            onClick={() => onSave(true)}>
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        ) : (
          <>
            <button
              type='button'
              disabled={saving}
              className='tb-btn tb-btn-outline cursor-pointer disabled:opacity-50'
              onClick={() => onSave(true)}>
              Lưu bản nháp
            </button>
            <button
              type='button'
              disabled={saving}
              className='tb-btn tb-btn-solid cursor-pointer disabled:opacity-50'
              onClick={() => onSave(false)}>
              {saving ? 'Đang gửi...' : 'Gửi duyệt'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
