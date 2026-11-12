import { STEPS } from '../model/eventEditorConstants';
import { useEventEditorStore } from '../model/useEventEditorStore';

export default function StepIndicator() {
  const { step, setStep } = useEventEditorStore();

  return (
    <ol className='flex flex-wrap gap-2'>
      {STEPS.map((title, i) => {
        const stepNum = i + 1;
        const isCurrent = step === stepNum;
        const isPassed = stepNum < step;

        return (
          <li key={title}>
            <button
              type='button'
              onClick={() => (isPassed ? setStep(stepNum) : undefined)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                isCurrent
                  ? 'bg-[#09090b] text-white border-[#09090b]'
                  : isPassed
                  ? 'bg-white border-[#09090b] text-[#09090b] cursor-pointer'
                  : 'bg-white border-[#e4e4e7] text-[#71717a]'
              }`}>
              {stepNum}. {title}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
