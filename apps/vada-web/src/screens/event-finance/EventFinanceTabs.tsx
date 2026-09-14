import { NODE } from './spec'
import type { EventFinanceModel } from './useEventFinance'

export function EventFinanceTabs({ model }: { model: EventFinanceModel }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-gray-200 pt-6">
      <div data-node-id={NODE.tab} role="tablist" aria-label={model.tabSource.description}>
        {model.tabOptions.map((option) => {
          const current = option.value === model.tab
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={current}
              onClick={() => model.selectTab(option.value, option.description)}
              className={`-mb-px border-b-2 px-3.5 py-2 text-sm font-medium ${
                current ? 'border-blue-600' : 'border-transparent hover:text-gray-700'
              }`}
            >
              <span className={current ? 'text-blue-700' : 'text-gray-500'}>{option.label}</span>
            </button>
          )
        })}
      </div>

      <div data-node-id={NODE.alerts} className="flex items-center gap-1.5 pb-2">
        {(model.alerts.items ?? []).map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">{item.label}</span>
            <span className="rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">
              {String(model.alertRow[item.field ?? ''])}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
