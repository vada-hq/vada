import type { SupplementDraftModel } from './useSupplementDraft'
import { NODE } from './spec'

export function SupplementActions({ model }: { model: SupplementDraftModel }) {
  const {
    submitAction,
    blocked,
    firstMissing,
    saveDraft,
    resubmit,
    press,
  } = model
  return (
    <>
        {submitAction.submittingMessage === null ? null : (
          <p role="status" className="text-sm text-gray-600">
            {submitAction.submittingMessage}
          </p>
        )}
        {submitAction.errorMessage === null ? null : (
          <p role="alert" className="text-sm text-red-700">
            {submitAction.errorMessage}
          </p>
        )}
        {!blocked || firstMissing === undefined ? null : (
          <p role="alert" className="text-sm text-red-700">
            아직 채우지 않은 칸이 있습니다.
          </p>
        )}

        <div className="flex justify-end gap-2">
          {[saveDraft, resubmit].map((spec, index) => (
            <button
              key={spec.label}
              type="button"
              data-node-id={index === 0 ? NODE.saveDraft : NODE.resubmit}
              onClick={press(spec)}
              className={
                spec.emphasis === 'primary'
                  ? 'rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700'
                  : 'rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50'
              }
            >
              {spec.label}
            </button>
          ))}
        </div>
    </>
  )
}
