import { FigmaAsset } from '../../components/FigmaAsset'
import { findDataSource } from '../../data-sources/definitions'
import { NEUTRAL_CHIP, NEUTRAL_VALUE, TABLE_STATE_CHIP, VALUE_TEXT } from '../../design/tones'
import { ASSET, NODE, PROOF_TONE, SCREEN } from './spec'
import type { FinanceOverviewModel } from './useFinanceOverview'

/** 최근 지출 내역과 증빙 현황을 나란히 그린다. */
export function FinanceActivity({ model }: { model: FinanceOverviewModel }) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
      <section data-node-id={NODE.recent} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <header className="flex items-center justify-between border border-gray-100 bg-gray-50 px-5 py-2.5">
          <h2 className="text-xs font-semibold text-gray-700">{model.recent.title}</h2>
          <button
            type="button"
            data-node-id={NODE.ledgerLink}
            onClick={model.pressButton(model.ledgerLink)}
            className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-600"
          >
            {model.ledgerLink.label}
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.ledgerLink} className="size-3" />
          </button>
        </header>
        <table aria-label="최근 지출 내역" className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              {(model.recent.columns ?? []).map((column, index) => (
                <th
                  key={column.label}
                  scope="col"
                  className={`px-5 py-2.5 text-xs font-semibold text-gray-400 ${index === 3 ? 'text-right' : 'text-left'}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.recentRows.length === 0 ? (
              <tr>
                <td colSpan={(model.recent.columns ?? []).length} className="px-5 py-8 text-center text-sm text-gray-500">
                  {findDataSource(model.recent.dataSourceKey).messages.empty}
                </td>
              </tr>
            ) : (
              model.recentRows.map((row) => (
                <tr key={String(row.id)} className="border-b border-gray-50 last:border-b-0">
                  <td className="px-5 py-3 text-xs text-gray-500">{String(row.date)}</td>
                  <td className="px-5 py-3 text-xs font-medium text-gray-800">{String(row.title)}</td>
                  <td className="px-5 py-3 text-xs text-gray-600">{String(row.context)}</td>
                  <td className="px-5 py-3 text-right text-xs font-semibold text-gray-900">{String(row.amountNote)}</td>
                  <td className="px-5 py-3">
                    <span
                      data-design-state
                      data-design-rule="table-state-chip"
                      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${TABLE_STATE_CHIP[String(row.proofTone)] ?? NEUTRAL_CHIP}`}
                    >
                      {String(row.proof)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
      <section data-node-id={NODE.proof} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <header className="border border-gray-100 bg-gray-50 px-5 py-2.5">
          <h2 className="text-xs font-semibold text-gray-700">{model.proof.title}</h2>
        </header>
        <div className="px-5 py-4">
          {(model.proof.items ?? []).map((item, index) => {
            const last = index === (model.proof.items ?? []).length - 1
            const tone = PROOF_TONE[item.field ?? '']
            return (
              <span key={item.field} className={`flex items-center justify-between ${last ? 'mt-3 border-t border-gray-100 pt-3' : 'py-1.5'}`}>
                <span className={last ? 'text-xs font-semibold text-gray-700' : 'text-xs text-gray-500'}>{item.label}</span>
                <span
                  data-design-rule="value-text"
                  className={`text-sm font-bold ${tone === undefined ? NEUTRAL_VALUE : (VALUE_TEXT[tone] ?? NEUTRAL_VALUE)}`}
                >
                  {String(model.proofRow[item.field ?? ''])}
                </span>
              </span>
            )
          })}
        </div>
      </section>
    </div>
  )
}
