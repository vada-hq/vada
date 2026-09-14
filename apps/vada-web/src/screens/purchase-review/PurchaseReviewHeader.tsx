import { NEUTRAL_CHIP, NEUTRAL_VALUE, STATE_CHIP } from '../../design/tones'
import { NODE, TILE_TONE, scalar } from './spec'
import type { ReadyPurchaseReviewDraftModel } from './usePurchaseReviewDraft'

/** 요청 요약, 판단 근거와 검토 단계 갈피를 그린다. */
export function PurchaseReviewHeader({ model }: { model: ReadyPurchaseReviewDraftModel }) {
  return (
    <>
      <section
        data-node-id={NODE.head}
        className="flex items-start justify-between gap-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="text-xs font-normal text-gray-400">
              {scalar(model.summaryRow, model.head.eyebrowField ?? '')}
            </span>
            <span
              data-design-state
              data-design-rule="state-chip"
              className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${
                STATE_CHIP[scalar(model.summaryRow, model.head.status?.[0]?.toneField ?? '')] ?? NEUTRAL_CHIP
              }`}
            >
              {scalar(model.summaryRow, model.head.status?.[0]?.field ?? '')}
            </span>
          </span>
          <span className="block pt-1 text-lg font-bold text-gray-900">{model.head.title}</span>
        </span>
        <span className="flex shrink-0 gap-6">
          {(model.head.items ?? []).map((item) => (
            <span key={item.field} className="rounded-lg border border-gray-100 px-4 py-2 text-right">
              <span className="block text-xs font-semibold text-gray-400">{item.label}</span>
              <span className={`block pt-1 text-lg font-bold ${TILE_TONE[item.field ?? ''] ?? NEUTRAL_VALUE}`}>
                {scalar(model.summaryRow, item.field ?? '')}
              </span>
            </span>
          ))}
        </span>
      </section>
      <section
        data-node-id={NODE.facts}
        className="grid grid-cols-3 gap-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm"
      >
        {(model.facts.items ?? []).map((item) => (
          <span key={item.field}>
            <span className="block text-xs font-semibold text-gray-400">{item.label}</span>
            <span className="block pt-1 text-xs font-normal text-gray-700">
              {scalar(model.summaryRow, item.field ?? '')}
            </span>
          </span>
        ))}
      </section>
      <div className="flex gap-2">
        {NODE.tabs.map((nodeId) => {
          const spec = model.buttonAt(nodeId)
          return (
            <button
              key={nodeId}
              type="button"
              data-node-id={nodeId}
              disabled={spec.initiallyDisabled}
              aria-current={spec.action.type === 'current' ? 'page' : undefined}
              onClick={model.pressPending(spec)}
              className={
                spec.action.type === 'current'
                  ? 'rounded-lg border border-blue-600 px-3 py-2 text-xs font-semibold text-blue-700'
                  : 'rounded-lg px-3 py-2 text-xs font-semibold text-gray-400 hover:bg-gray-100'
              }
            >
              {spec.label}
            </button>
          )
        })}
      </div>
    </>
  )
}
