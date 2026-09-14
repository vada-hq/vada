import { FigmaAsset } from '../../components/FigmaAsset'
import { PendingBox } from '../../components/PendingBox'
import { INFO_CHIP, NEUTRAL_CHIP, STATE_CHIP } from '../../design/tones'
import type { DataRow } from '../../data-sources/definitions'
import { scalarValue as scalar } from '../../data-sources/values'
import {
  RECORDS_ARCHIVE_ASSET as ASSET,
  RECORDS_ARCHIVE_NODE as NODE,
  RECORDS_ARCHIVE_SCREEN as SCREEN,
} from './config'
import type { RecordsArchiveModel } from './useRecordsArchive'

const COMPLETED_CHIP = 'border border-gray-200 bg-gray-100 text-gray-500'

function rowsOf(row: DataRow, field: string | undefined): DataRow[] {
  const value = row[field ?? '']
  return Array.isArray(value) ? value : []
}

function CompletedEventCard({ row, model }: { row: DataRow; model: RecordsArchiveModel }) {
  const { status, archive, title, date, host, highlights, completed, blocked } = model.columns
  const actionLabel =
    model.list.itemAction?.labelField === undefined
      ? ''
      : scalar(row, model.list.itemAction.labelField)

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4">
      <div>
        <span className="flex items-center gap-2">
          <span className={`rounded px-2 py-0.5 text-xs font-semibold ${COMPLETED_CHIP}`}>
            {scalar(row, (status?.fields ?? [])[0])}
          </span>
          <span
            data-design-rule="state-chip"
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              STATE_CHIP[scalar(row, archive?.toneField)] ?? NEUTRAL_CHIP
            }`}
          >
            {scalar(row, (archive?.fields ?? [])[0])}
          </span>
        </span>
        <span className="block pt-2 text-sm font-semibold text-gray-900">
          {scalar(row, (title?.fields ?? [])[0])}
        </span>
        <span className="flex flex-wrap items-center gap-4 pt-1.5">
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.date} className="size-3" />
            <span>{scalar(row, (date?.fields ?? [])[0])}</span>
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.host} className="size-3" />
            <span>{scalar(row, (host?.fields ?? [])[0])}</span>
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-2 pt-2.5">
          {rowsOf(row, (highlights?.fields ?? [])[0]).map((highlight) => (
            <span key={scalar(highlight, 'label')} className={`rounded px-2 py-1 text-xs ${INFO_CHIP}`}>
              {scalar(highlight, 'label')}
            </span>
          ))}
        </span>
        <span className="block pt-2.5 text-xs text-gray-400">
          {scalar(row, (completed?.fields ?? [])[0])}
        </span>
      </div>

      {actionLabel === '' || model.list.itemAction === undefined ? (
        <span className="shrink-0 text-right text-xs text-gray-400">
          {scalar(row, (blocked?.fields ?? [])[0])}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => model.open(model.list.itemAction!, row)}
          className="shrink-0 rounded text-xs font-medium text-blue-500 hover:underline focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export function RecordsArchiveView({ model }: { model: RecordsArchiveModel }) {
  const alertField = (model.alert.items ?? [])[0]?.field
  return (
    <>
      {scalar(model.alertRow, alertField) === '' ? null : (
        <p data-node-id={NODE.alert} className="inline-flex items-center gap-1.5 rounded-md border border-orange-100 bg-orange-50 px-3 py-1.5">
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.alert} className="size-3.5" />
          <span className="text-xs font-medium text-orange-800">{scalar(model.alertRow, alertField)}</span>
        </p>
      )}

      <div className="flex items-center gap-3 pt-4 pb-4">
        <label data-node-id={NODE.query} className="flex w-full max-w-[280px] min-w-0 items-center gap-2 rounded-md border border-gray-200 px-3 py-2">
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.search} className="size-3.5 shrink-0" />
          <input
            aria-label={model.query.label}
            type={model.query.inputType}
            value={model.queryValue}
            placeholder={model.query.placeholder ?? model.query.label}
            onChange={(event) => model.setQueryValue(event.target.value)}
            className="min-w-0 flex-1 text-sm text-gray-700 placeholder:text-gray-700 focus:outline-none"
          />
        </label>
        <PendingBox nodeId={NODE.filter} spec={model.filter} className="h-9 w-28 shrink-0 rounded border border-gray-200" />
      </div>

      <div data-node-id={NODE.list} className="flex flex-col gap-3 pb-12">
        {model.rows.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-white px-5 py-8 text-center text-sm text-gray-500">{model.emptyMessage}</p>
        ) : (
          model.rows.map((row) => <CompletedEventCard key={scalar(row, 'id')} row={row} model={model} />)
        )}
      </div>

      {model.note === null ? null : <p role="status" className="pb-6 text-xs text-gray-500">{model.note}</p>}
    </>
  )
}
