import type { SubmitAction } from '../../spec/types'
import type { ExternalSurveyFormModel } from './useExternalSurveyForm'
import { NODE } from './spec'

export function ExternalSurveySubmit({ model }: { model: ExternalSurveyFormModel }) {
  const { field, submit, submitAction, draft, onNavigate, screenParams, onScopeEvent } = model
  // 바닥 단추(30:7227). 고정 푸터가 아니라 흐름의 끝에 놓인 단추다.
  return (
    <div className="pt-6 pb-6">
      <button
        type="button"
        data-node-id={NODE.submit}
        onClick={() =>
          field.runButton(submit, () => {
            void submitAction.run(submit.action as SubmitAction, {
              payload: draft.values,
              onNavigate,
              // 무엇을 넘길지는 명세가 말한다(onSuccess.params). 화면은 그 값이
              // 어디 있는지만 알려 준다.
              paramSources: { screenParams },
              onScopeEvent,
            })
          })
        }
        className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
      >
        {submitAction.labelOf(submit.action as SubmitAction, submit.label)}
      </button>
      {submitAction.errorMessage === null ? null : (
        <p role="alert" className="pt-2 text-xs text-red-500">
          {submitAction.errorMessage}
        </p>
      )}
    </div>
  )
}
