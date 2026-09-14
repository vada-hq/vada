import { NEUTRAL_VALUE, VALUE_TEXT } from '../../design/tones'
import { NODE, TILE_TONE } from './spec'
import type { EventFinanceModel } from './useEventFinance'

export function EventFinanceTotals({ model }: { model: EventFinanceModel }) {
  return (
    <div data-node-id={NODE.totals} className="grid grid-cols-1 gap-4 pt-6 md:grid-cols-4">
      {(model.totals.items ?? []).map((item) => {
        const value = String(model.totalRow[item.field ?? ''])
        const isAmount = /^-?[\d,]+$/.test(value)
        return (
          <div key={item.label} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500">{item.label}</p>
            <p className="flex items-baseline gap-0.5 pt-1">
              <span
                data-design-rule="value-text"
                className={`text-base font-bold ${
                  VALUE_TEXT[TILE_TONE[item.field ?? ''] ?? ''] ?? NEUTRAL_VALUE
                }`}
              >
                {value}
              </span>
              {isAmount ? <span className="text-xs text-gray-400">{item.unit}</span> : null}
            </p>
          </div>
        )
      })}
    </div>
  )
}
