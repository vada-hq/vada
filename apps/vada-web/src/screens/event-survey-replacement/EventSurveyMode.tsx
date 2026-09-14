import { NODE } from './spec'
import type { EventSurveyReplacementModel } from './useEventSurveyReplacement'

export function EventSurveyMode({ model }: { model: EventSurveyReplacementModel }) {
  return (
    <div
      data-node-id={NODE.mode}
      className="mx-5 mt-4 rounded border border-gray-200 bg-gray-50 px-3.5 py-3.5"
    >
      <span id={`${model.mode.fieldKey}-label`} className="block text-xs font-semibold text-gray-700">
        {model.mode.label}
      </span>
      <div
        id={model.mode.fieldKey}
        role="radiogroup"
        aria-labelledby={`${model.mode.fieldKey}-label`}
        className="flex flex-col gap-1 pt-2.5"
      >
        {model.modeOptions.map((option) => {
          const selected = option.value === model.chosen
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() =>
                model.field.setFieldValue(model.mode.fieldKey, option.value, option.label)
              }
              className="flex items-start gap-2.5 rounded px-2 py-2 text-left hover:bg-gray-100"
            >
              <span
                className={`mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border ${
                  selected ? 'border-blue-600' : 'border-gray-300'
                }`}
              >
                {selected && <span className="size-1.5 rounded-full bg-blue-600" />}
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-medium text-gray-800">{option.label}</span>
                {option.description === undefined ? null : (
                  <span className="block pt-0.5 text-xs font-medium text-gray-400">
                    {option.description}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
