import { scalarValue as scalar } from '../../data-sources/values'
import { BANNER_TEXT, CONFIRM_NOTE } from '../../design/tones'
import { NODE } from './spec'
import type { EventSurveyReplacementModel } from './useEventSurveyReplacement'

export function EventSurveyImpact({ model }: { model: EventSurveyReplacementModel }) {
  return (
    <>
      <div data-node-id={NODE.head} className={`px-5 py-3.5 ${CONFIRM_NOTE.red}`}>
        <h2
          data-design-rule="state-banner"
          className={`text-sm font-semibold ${BANNER_TEXT.red.title}`}
        >
          {scalar(model.impactRow, model.head.titleField)}
        </h2>
        <p className="pt-0.5 text-xs">
          {scalar(model.impactRow, model.head.descriptionField)}
        </p>
      </div>

      <div className="flex flex-col gap-4 px-5 pt-4">
        <div data-node-id={NODE.impact} className="grid grid-cols-2 gap-2.5">
          {(model.impact.items ?? []).map((item) => (
            <span key={item.field} className="rounded border border-gray-200 px-3 py-2.5">
              <span className="block text-xs text-gray-400">{item.label}</span>
              <span className="block pt-1 text-sm font-bold text-gray-800">
                {scalar(model.impactRow, item.field)}
              </span>
            </span>
          ))}
        </div>

        <ul data-node-id={NODE.notes} className="flex flex-col gap-2">
          {model.noteRows.map((note, at) => (
            <li key={at} className="flex items-start gap-2 text-xs text-gray-600">
              <span aria-hidden className="pt-px text-orange-400">
                •
              </span>
              <span>{String(note[model.noteField] ?? '')}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
