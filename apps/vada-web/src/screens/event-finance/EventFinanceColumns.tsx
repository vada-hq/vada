import { NEUTRAL_CHIP, STATE_CHIP } from '../../design/tones'
import { NODE } from './spec'
import type { EventFinanceModel } from './useEventFinance'

export function EventFinanceColumns({ model }: { model: EventFinanceModel }) {
  return (
    <div className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-4">
      {model.columns.map(({ nodeId, spec, cards, emptyMessage }) => (
        <div key={nodeId} data-node-id={nodeId}>
          <p className="pb-2 text-xs font-semibold text-gray-600">{spec.title}</p>
          <div className="flex min-h-64 flex-col gap-2 rounded-xl border border-gray-200 bg-gray-100 p-2">
            {cards.length === 0 ? (
              <p data-design-state="empty" className="pt-16 text-center text-xs text-gray-400">
                {emptyMessage}
              </p>
            ) : (
              cards.map((card) => (
                <button
                  key={String(card.id)}
                  type="button"
                  onClick={() => model.pressCard(spec, card)}
                  aria-label={`${String(card.title)} ${spec.itemAction?.label ?? ''}`}
                  className="rounded border border-gray-200 bg-white p-3 text-left hover:bg-gray-50"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span
                      data-design-rule="state-chip"
                      className={`rounded px-2 py-0.5 text-xs font-medium ${STATE_CHIP.gray}`}
                    >
                      {String(card.departmentLabel)}
                    </span>
                    <span className="text-[10px] font-medium text-gray-400">
                      {String(card.requestedAt)}
                    </span>
                  </span>
                  <span className="block pt-2 text-xs font-bold text-gray-800">
                    {String(card.title)}
                  </span>
                  <span className="block pt-1 text-[10px] font-medium text-gray-500">
                    {String(card.itemsNote)}
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-2 border border-gray-50 pt-2">
                    <span className="text-xs font-bold text-gray-900">
                      {String(card.amountNote)}
                    </span>
                    <span
                      data-design-rule="state-chip"
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        STATE_CHIP[String(card.statusTone)] ?? NEUTRAL_CHIP
                      }`}
                    >
                      {String(card.status)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
