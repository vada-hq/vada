import { FigmaAsset } from '../../components/FigmaAsset'
import { SearchSelect } from '../../components/SearchSelect'
import { NEUTRAL_CHIP, NEUTRAL_VALUE, STATE_CHIP, VALUE_TEXT } from '../../design/tones'
import { findDataSource } from '../../data-sources/definitions'
import {
  FINANCE_LEDGER_ASSET as ASSET,
  FINANCE_LEDGER_FILTERS as FILTERS,
  FINANCE_LEDGER_NODE as NODE,
  FINANCE_LEDGER_SCREEN as SCREEN,
} from './config'
import { financeLedgerFilterSpec } from './useFinanceLedger'
import type { FinanceLedgerModel } from './useFinanceLedger'

const TILE_TONE: Record<string, string> = { proofMissing: 'red' }

function LedgerTiles({ model }: { model: FinanceLedgerModel }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      {model.tiles.map(({ nodeId, spec, row, item }) => {
        const tone = TILE_TONE[item?.field ?? '']
        return (
          <div
            key={nodeId}
            data-node-id={nodeId}
            className="rounded-xl border border-gray-200 bg-white px-5 py-4"
          >
            <p className="text-xs text-gray-400">
              {spec.title ?? String(row[spec.titleField ?? ''])}
            </p>
            <p
              data-design-rule="value-text"
              className={`pt-1 text-lg font-bold ${
                tone === undefined ? NEUTRAL_VALUE : (VALUE_TEXT[tone] ?? NEUTRAL_VALUE)
              }`}
            >
              {String(row[item?.field ?? ''])}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function LedgerFilters({ model }: { model: FinanceLedgerModel }) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-5">
      <span data-node-id={NODE.search} className="w-64">
        <label htmlFor={model.search.fieldKey} className="sr-only">
          {model.search.label}
        </label>
        <span className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-600/50">
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.search} className="size-3.5 shrink-0" />
          <input
            id={model.search.fieldKey}
            type={model.search.inputType}
            value={model.query}
            placeholder={model.search.placeholder ?? model.search.label}
            onChange={(event) => model.setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none"
          />
        </span>
      </span>

      {FILTERS.map((filter) => {
        const spec = financeLedgerFilterSpec(filter.node)
        return (
          <span
            key={filter.node}
            data-node-id={filter.node}
            data-design-rule="filter-select"
            className="w-40"
          >
            <label htmlFor={spec.fieldKey} className="sr-only">{spec.label}</label>
            <SearchSelect
              id={spec.fieldKey}
              placeholder={spec.placeholder}
              searchable={spec.searchable}
              disabled={spec.initiallyDisabled}
              sourceKey={spec.optionsSource.key}
              sourceParams={{}}
              value={model.picked[spec.fieldKey] ?? null}
              onSelect={(option) => model.selectFilter(spec.fieldKey, option)}
              chevron={<FigmaAsset screenId={SCREEN} nodeId={filter.chevron} className="size-4" />}
            />
          </span>
        )
      })}
    </div>
  )
}

function LedgerTable({ model }: { model: FinanceLedgerModel }) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table data-node-id={NODE.ledger} aria-label="사용 내역" className="w-full">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {(model.ledger.columns ?? []).map((column, index) => (
              <th
                key={column.label}
                scope="col"
                className={`px-5 py-2.5 text-xs font-semibold text-gray-500 ${
                  index === 5 ? 'text-right' : 'text-left'
                }`}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.rows.length === 0 ? (
            <tr>
              <td
                colSpan={(model.ledger.columns ?? []).length}
                className="px-5 py-10 text-center text-sm text-gray-500"
              >
                {findDataSource(model.ledger.dataSourceKey).messages.empty}
              </td>
            </tr>
          ) : (
            model.rows.map((row) => (
              <tr key={String(row.id)} className="border-b border-gray-100 last:border-b-0">
                <td className="px-5 py-3 text-xs text-gray-500">{String(row.date)}</td>
                <td className="px-5 py-3 text-xs font-medium text-gray-800">{String(row.title)}</td>
                <td className="px-5 py-3 text-xs text-gray-600">{String(row.context)}</td>
                <td className="px-5 py-3 text-xs text-gray-600">{String(row.department)}</td>
                <td className="px-5 py-3 text-xs text-gray-600">{String(row.budgetItem)}</td>
                <td className="px-5 py-3 text-right text-xs font-bold text-gray-900">{String(row.amountNote)}</td>
                <td className="px-5 py-3">
                  <span
                    data-design-state
                    data-design-rule="state-chip"
                    className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${
                      STATE_CHIP[String(row.proofTone)] ?? NEUTRAL_CHIP
                    }`}
                  >
                    {String(row.proof)}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div
        data-node-id={NODE.scope}
        className="flex flex-wrap items-center justify-between gap-2 border border-gray-100 px-5 py-3"
      >
        {(model.scope.items ?? []).map((item) => (
          <span key={item.field} className="text-xs text-gray-400">
            {String(model.scopeRow[item.field ?? ''])}
          </span>
        ))}
      </div>
    </div>
  )
}

export function FinanceLedgerView({ model }: { model: FinanceLedgerModel }) {
  return (
    <>
      <LedgerTiles model={model} />
      <LedgerFilters model={model} />
      <LedgerTable model={model} />
    </>
  )
}
