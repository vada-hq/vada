import { FigmaAsset } from '../../components/FigmaAsset'
import { ACCENT_BAR, CHOICE_CHIP, NEUTRAL_CHIP, STATE_CHIP } from '../../design/tones'
import { evtDoc01 } from '../../spec/screens'
import {
  EVENT_DOCUMENT_ASSET as ASSET,
  EVENT_DOCUMENT_NODE as NODE,
  EVENT_DOCUMENT_SCREEN as SCREEN,
} from './config'
import type { ReadyEventDocuments } from './useEventDocuments'

const COLUMN_WIDTH = ['flex-1', 'w-24 shrink-0', 'w-28 shrink-0'] as const

export function EventDocumentContent({ model }: { model: ReadyEventDocuments }) {
  return (
    <>
      <div className="pt-6">
        <h2 className="text-sm font-semibold text-gray-900">{evtDoc01.meta?.title}</h2>
        <p className="pt-1 text-xs text-gray-500">{evtDoc01.meta?.description}</p>
      </div>

      {model.note === null ? null : (
        <p role="status" className="pt-3 text-xs font-medium text-gray-500">{model.note}</p>
      )}

      <div data-node-id={NODE.stats} className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-3">
        {(model.stats.items ?? []).map((item) => (
          <span key={item.label} className="block rounded-xl border border-gray-200 bg-white p-3.5">
            <span className="block text-xs text-gray-400">{item.label}</span>
            <span className="flex items-baseline gap-1.5 pt-1">
              <span className="text-base font-bold text-gray-900">{String(model.statsRow[item.field ?? ''])}</span>
              <span className="text-xs text-gray-400">{String(model.statsRow[item.descriptionField ?? ''])}</span>
            </span>
          </span>
        ))}
      </div>

      <div data-node-id={NODE.filter} data-design-rule="choice-chip" role="radiogroup" aria-label={model.optionSource.description} className="flex flex-wrap gap-2 pt-4">
        {model.options.map((option) => {
          const value = String(option.value)
          const selected = value === model.status
          const count = model.counts === null ? undefined : model.counts[value]
          return (
            <button key={value} type="button" role="radio" aria-checked={selected} onClick={() => model.setStatus(value)} className={`rounded-full border px-3 py-1 text-xs font-medium ${selected ? CHOICE_CHIP.on : CHOICE_CHIP.off}`}>
              <span>{option.label}</span>
              {count === undefined ? null : <span className={`pl-1.5 ${selected ? 'text-gray-300' : 'text-gray-400'}`}>{String(count)}</span>}
            </button>
          )
        })}
      </div>

      <div data-node-id={NODE.table} className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex border-b border-gray-100 bg-gray-50 px-4 py-2.5">
          {(model.table.columns ?? []).map((column, at) => (
            <span key={column.label} className={`text-[10px] font-semibold text-gray-400 ${COLUMN_WIDTH[at]}`}>{column.label}</span>
          ))}
        </div>

        {model.rows.length === 0 ? (
          <p data-design-state="empty" className="px-4 py-6 text-xs text-gray-400">{model.emptyMessage}</p>
        ) : (
          <ul>
            {model.rows.map((row) => (
              <li key={String(row.id)} className="border-b border-gray-100 last:border-b-0">
                <button type="button" onClick={model.pressRow} aria-label={`${String(row.title)} ${model.table.itemAction?.label ?? ''}`} className="flex w-full items-center px-4 py-3 text-left hover:bg-gray-50">
                  <span className={`flex min-w-0 items-start gap-2.5 ${COLUMN_WIDTH[0]}`}>
                    <span className={`mt-0.5 h-9 w-0.5 shrink-0 rounded-full ${ACCENT_BAR[String(row.tone)] ?? ACCENT_BAR.gray}`} />
                    <FigmaAsset screenId={SCREEN} nodeId={ASSET.document} className="mt-1 size-3.5 shrink-0" />
                    <span className="min-w-0">
                      <span className="flex items-baseline gap-2">
                        <span className="text-[10px] font-medium text-blue-600">{String(row.category)}</span>
                        <span className="truncate text-xs font-semibold text-gray-900">{String(row.title)}</span>
                      </span>
                      <span className="block truncate pt-1 text-[10px] text-gray-500">{String(row.description)}</span>
                    </span>
                  </span>
                  <span className={COLUMN_WIDTH[1]}>
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATE_CHIP[String(row.statusTone)] ?? NEUTRAL_CHIP}`}>{String(row.status)}</span>
                  </span>
                  <span className={`text-xs text-gray-400 ${COLUMN_WIDTH[2]}`}>{String(row.updatedNote)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
