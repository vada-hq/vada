import { findDataSource } from '../../data-sources/definitions'
import { NODE } from './spec'
import type { FinanceOverviewModel } from './useFinanceOverview'

/** 선택한 범위의 예산 구분별 표를 그린다. */
export function FinanceBreakdown({ model }: { model: FinanceOverviewModel }) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div
        data-node-id={NODE.scope}
        role="tablist"
        aria-label={model.scopeSource.description}
        className="flex border border-gray-100 bg-gray-50 px-4"
      >
        {model.scopeOptions.map((option) => {
          const current = option.value === model.scope
          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={current}
              onClick={() => model.setScope(option.value)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-sm ${
                current
                  ? 'border-blue-600 font-semibold text-blue-700'
                  : 'border-transparent font-medium text-gray-400'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      <table data-node-id={NODE.breakdown} aria-label="구분별 예산 현황" className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {(model.breakdown.columns ?? []).map((column, index) => (
              <th
                key={column.label}
                scope="col"
                className={`px-5 py-2.5 text-xs font-semibold text-gray-500 ${index === 0 ? 'text-left' : 'text-right'}`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.breakdownRows.length === 0 ? (
            <tr>
              <td colSpan={(model.breakdown.columns ?? []).length} className="px-5 py-8 text-center text-sm text-gray-500">
                {findDataSource(model.breakdown.dataSourceKey).messages.empty}
              </td>
            </tr>
          ) : (
            model.breakdownRows.map((row) => (
              <tr key={String(row.id)} className="border-b border-gray-100 last:border-b-0">
                <td className="px-5 py-3 text-sm font-medium text-gray-900">{String(row.name)}</td>
                <td className="px-5 py-3 text-right text-sm text-gray-600">{String(row.budget)}</td>
                <td className="px-5 py-3 text-right text-sm text-gray-600">{String(row.spent)}</td>
                <td className="px-5 py-3 text-right text-sm text-gray-600">{String(row.planned)}</td>
                <td className="px-5 py-3 text-right text-sm font-bold text-blue-600">{String(row.available)}</td>
                <td className="px-5 py-3">
                  <span className="flex items-center justify-end gap-2">
                    <span className="h-1 w-14 overflow-hidden rounded-full bg-gray-100">
                      <span className="block h-full rounded-full bg-blue-500" style={{ width: `${Number(row.executionPercent)}%` }} />
                    </span>
                    <span className="text-xs font-semibold text-gray-700">{`${row.executionPercent}%`}</span>
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
