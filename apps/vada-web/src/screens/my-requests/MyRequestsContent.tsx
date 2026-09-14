import { DataTable } from '../../components/DataTable'
import { FigmaAsset } from '../../components/FigmaAsset'
import { NEUTRAL_VALUE, VALUE_TEXT } from '../../design/tones'
import { myReq01 } from '../../spec/screens'
import {
  MY_REQUESTS_ASSET as ASSET,
  MY_REQUESTS_COUNT_TONE as COUNT_TONE,
  MY_REQUESTS_NODE as NODE,
  MY_REQUESTS_SCREEN as SCREEN,
} from './config'
import type { ReadyMyRequests } from './useMyRequests'

export function MyRequestsContent({ model }: { model: ReadyMyRequests }) {
  return (
    <>
      {model.note === null ? null : (
        <p role="alert" className="mx-8 mt-6 rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-600">
          {model.note}
        </p>
      )}

      <div className="flex flex-col gap-6 px-8 py-6">
        <div className="flex items-start justify-between gap-4">
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <button
                type="button"
                data-node-id={NODE.back}
                aria-label={model.back.label}
                onClick={() => model.pressButton(model.back)}
                className="rounded p-1 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
              >
                <FigmaAsset screenId={SCREEN} nodeId={ASSET.back} className="size-3.5" />
              </button>
              <span data-node-id={NODE.heading} className="text-base font-bold text-gray-900">
                {model.heading.title}
              </span>
            </span>
            <span data-node-id={NODE.scopeNote} className="block pt-1 text-xs font-normal text-gray-500">
              {String(model.summaryRow[model.scopeNote.descriptionField ?? ''] ?? '')}
            </span>
          </span>
          <button
            type="button"
            data-node-id={NODE.newRequest}
            onClick={() => model.pressButton(model.newRequest)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.newRequest} className="size-3.5" />
            {model.newRequest.label}
          </button>
        </div>

        <div data-node-id={NODE.counts} className="grid grid-cols-5 gap-3">
          {(model.counts.items ?? []).map((item) => (
            <span key={item.field} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <span className="block text-xs font-semibold text-gray-400">{item.label}</span>
              <span
                className={`block pt-1 text-xl font-bold ${
                  VALUE_TEXT[COUNT_TONE[item.field ?? ''] ?? ''] ?? NEUTRAL_VALUE
                }`}
              >
                {String(model.summaryRow[item.field ?? ''] ?? '')}
              </span>
            </span>
          ))}
        </div>

        <DataTable
          nodeId={NODE.table}
          label={model.heading.title ?? myReq01.screenId}
          columns={model.table.columns ?? []}
          rows={model.rows}
          emptyMessage={model.emptyMessage}
          fieldPresentation={{
            code: 'faint',
            title: 'title',
            amountNote: 'strong',
            itemCountNote: 'body',
            requestedAt: 'muted',
            neededOn: 'muted',
            status: 'status',
          }}
          itemActionLabel={model.table.itemAction?.label}
          onItemAction={model.pressRow}
        />
      </div>
    </>
  )
}
