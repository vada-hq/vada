import { DANGER_BUTTON } from '../../design/tones'
import type { SubmitAction } from '../../spec/types'
import { NODE } from './spec'
import type { EventSurveyReplacementModel } from './useEventSurveyReplacement'

export function EventSurveyReplacementActions({
  model,
}: {
  model: EventSurveyReplacementModel
}) {
  return (
    <>
      <div className="mt-4 flex justify-end gap-2 border-t border-gray-100 px-5 py-3.5">
        <button
          type="button"
          data-node-id={NODE.cancel}
          onClick={model.press(model.cancel)}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          {model.cancel.label}
        </button>
        <button
          type="button"
          data-node-id={NODE.replace}
          onClick={() =>
            void model.submitAction.run(model.replace.action as SubmitAction, {
              payload: model.draft.values,
              onNavigate: model.onNavigate,
              paramSources: { screenParams: model.screenParams },
              onScopeEvent: model.onScopeEvent,
            })
          }
          className={`rounded px-3 py-1.5 text-xs font-medium ${DANGER_BUTTON}`}
        >
          {model.submitAction.labelOf(
            model.replace.action as SubmitAction,
            model.replace.label,
          )}
        </button>
      </div>
      {model.submitAction.errorMessage === null ? null : (
        <p role="alert" className="px-5 pb-3.5 text-xs text-red-500">
          {model.submitAction.errorMessage}
        </p>
      )}
      {model.submitAction.pendingNote === null ? null : (
        <p role="status" className="px-5 pb-3.5 text-xs text-gray-500">
          {model.submitAction.pendingNote}
        </p>
      )}
    </>
  )
}
