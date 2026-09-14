import { FigmaAsset } from '../../components/FigmaAsset'
import { ASSET, NODE, SCREEN } from './spec'
import type { ReadyPurchaseReviewDraftModel } from './usePurchaseReviewDraft'

/** 전송 상태와 검토 화면의 하단 동작을 그린다. */
export function PurchaseReviewActions({ model }: { model: ReadyPurchaseReviewDraftModel }) {
  return (
    <>
      {model.submitAction.submittingMessage === null ? null : (
        <p role="status" className="text-sm text-gray-600">{model.submitAction.submittingMessage}</p>
      )}
      {model.submitAction.errorMessage === null ? null : (
        <p role="alert" className="text-sm text-red-700">{model.submitAction.errorMessage}</p>
      )}
      {model.note === null ? null : (
        <p role="status" className="text-sm text-gray-600">{model.note}</p>
      )}
      {!model.blocked || model.firstMissing === undefined ? null : (
        <p role="alert" className="text-sm text-red-700">아직 판정하지 않은 품목이 있습니다.</p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          data-node-id={NODE.back}
          onClick={model.pressPending(model.back)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.back} className="size-3.5" />
          {model.back.label}
        </button>
        <button
          type="button"
          data-node-id={NODE.send}
          onClick={model.pressSend}
          className={`rounded-lg px-4 py-2 text-xs font-medium text-white ${
            model.swapped ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {model.sendLabel}
        </button>
      </div>
    </>
  )
}
