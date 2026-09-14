import { NODE } from './spec'
import type { FinanceEvidenceModel } from './useFinanceEvidence'

export function EvidenceCompletionActions({ model }: { model: FinanceEvidenceModel }) {
  return (
    <>
      {model.submitAction.submittingMessage === null ? null : (
        <p role="status" className="text-sm text-gray-600">
          {model.submitAction.submittingMessage}
        </p>
      )}
      {model.submitAction.errorMessage === null ? null : (
        <p role="alert" className="text-sm text-red-700">
          {model.submitAction.errorMessage}
        </p>
      )}
      {model.note === null ? null : (
        <p role="alert" className="text-sm text-gray-600">
          {model.note}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          data-node-id={NODE.save}
          onClick={model.pressPending(model.save)}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          {model.save.label}
        </button>
        <button
          type="button"
          data-node-id={NODE.complete}
          onClick={model.pressComplete}
          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
        >
          {model.complete.label}
        </button>
      </div>
    </>
  )
}
