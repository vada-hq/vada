import { FigmaAsset } from '../../components/FigmaAsset'
import { findDataSource } from '../../data-sources/definitions'
import { NEUTRAL_CHIP, STATE_CHIP } from '../../design/tones'
import { resolveParams } from '../../spec/params'
import { targetScreenOf } from '../../spec/types'
import type { ItemListSpec } from '../../spec/types'
import { ASSET, COLUMN_WIDTH, EMPTY_ASSET, EMPTY_SCREEN, NODE, SCREEN } from './spec'
import type { ParticipantDirectoryModel } from './useParticipantDirectory'

export function ParticipantTable({ model }: { model: ParticipantDirectoryModel }) {
  const { table } = model.specs
  return (
    <>
      <div data-node-id={NODE.table} className="mt-4 overflow-hidden rounded border border-gray-200 bg-white">
        <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-2.5">
          <input
            type="checkbox"
            aria-label={`이 쪽의 참가자 모두 ${table.selection?.action.label ?? ''}`}
            checked={model.picked.length > 0 && model.picked.length === model.rows.length}
            onChange={(event) =>
              model.setPicked(event.target.checked ? model.rows.map((row) => String(row.id)) : [])
            }
            className="size-3.5 shrink-0 rounded border-gray-400"
          />
          {(table.columns ?? []).map((column, at) => (
            <span key={column.label} className={`text-xs font-medium text-gray-500 ${COLUMN_WIDTH[at]}`}>
              {column.label}
            </span>
          ))}
          <span className="w-6 shrink-0" />
        </div>

        {model.rows.length === 0 ? (
          <EmptyParticipants model={model} table={table} />
        ) : (
          <ul>
            {model.rows.map((row) => {
              const id = String(row.id)
              return (
                <li key={id} className="flex items-center gap-3 border-b border-gray-100 bg-yellow-50 px-4 py-3 last:border-b-0">
                  <input
                    type="checkbox"
                    aria-label={`${String(row.name)} 고르기`}
                    checked={model.picked.includes(id)}
                    onChange={(event) =>
                      model.setPicked((previous) =>
                        event.target.checked ? [...previous, id] : previous.filter((other) => other !== id),
                      )
                    }
                    className="size-3.5 shrink-0 rounded border-gray-400"
                  />
                  <span className={`flex items-center gap-1.5 ${COLUMN_WIDTH[0]}`}>
                    <span className="text-xs font-medium text-gray-900">{String(row.name)}</span>
                    <FigmaAsset screenId={SCREEN} nodeId={ASSET.nameAlert} className="size-3 shrink-0" />
                  </span>
                  <span className={`text-xs text-gray-600 ${COLUMN_WIDTH[1]}`}>{String(row.studentNo)}</span>
                  <span className={`text-xs text-gray-600 ${COLUMN_WIDTH[2]}`}>{String(row.affiliation)}</span>
                  {(
                    [['applyStatus', 'applyStatusTone', 3], ['payStatus', 'payStatusTone', 4], ['attendStatus', 'attendStatusTone', 5]] as const
                  ).map(([field, toneField, at]) => (
                    <span key={field} className={COLUMN_WIDTH[at]}>
                      <span data-design-rule="state-chip" className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATE_CHIP[String(row[toneField])] ?? NEUTRAL_CHIP}`}>
                        {String(row[field])}
                      </span>
                    </span>
                  ))}
                  <button
                    type="button"
                    aria-label={`${String(row.name)} ${table.itemAction?.label ?? ''}`}
                    onClick={() => {
                      if (table.itemAction?.type === 'pending') model.setNote(table.itemAction.note)
                    }}
                    className="w-6 shrink-0 rounded p-1 hover:bg-gray-100"
                  >
                    <FigmaAsset screenId={SCREEN} nodeId={ASSET.rowMenu} className="size-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {model.picked.length === 0 ? null : (
        <button
          type="button"
          onClick={() => {
            if (table.selection?.action.type === 'pending') model.setNote(table.selection.action.note)
          }}
          className="mt-3 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          {`${table.selection?.action.label ?? ''} ${model.picked.length}명`}
        </button>
      )}

      <div data-node-id={model.paging.source} className="flex items-center justify-between pt-3">
        <span className="text-xs text-gray-500">{String(model.pageInfo[model.paging.totalNoteField])}</span>
        <div className="flex items-center gap-1.5">
          <PageButton model={model} page={Math.max(1, model.page - 1)} disabled={model.page === 1}>이전</PageButton>
          {Array.from({ length: Math.max(1, model.pageCount) }, (_, at) => at + 1).map((number) => (
            <button
              key={number}
              type="button"
              aria-current={number === model.page ? 'page' : undefined}
              onClick={() => model.setPage(number)}
              className={`rounded border px-2 py-1 text-sm font-medium ${number === model.page ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >{number}</button>
          ))}
          <PageButton model={model} page={Math.min(model.pageCount, model.page + 1)} disabled={model.page === model.pageCount}>다음</PageButton>
        </div>
      </div>
    </>
  )
}

function PageButton({ model, page, disabled, children }: { model: ParticipantDirectoryModel; page: number; disabled: boolean; children: string }) {
  return (
    <button
      type="button"
      data-design-state={disabled ? 'disabled' : undefined}
      disabled={disabled}
      onClick={() => model.setPage(page)}
      className={`rounded border border-gray-200 px-2 py-1 text-sm font-medium ${disabled ? 'text-gray-400' : 'text-gray-600 hover:bg-gray-50'}`}
    >{children}</button>
  )
}

function EmptyParticipants({ model, table }: { model: ParticipantDirectoryModel; table: ItemListSpec }) {
  const messages = findDataSource(table.dataSourceKey).messages
  const action = table.emptyAction
  return (
    <div data-design-state="empty" className="flex flex-col items-center gap-4 py-20 text-center">
      <FigmaAsset screenId={EMPTY_SCREEN} nodeId={EMPTY_ASSET.icon} className="size-12" />
      <p className="text-base font-bold text-gray-900">{messages.empty}</p>
      {messages.emptyDetail === undefined ? null : <p className="text-xs whitespace-pre-line text-gray-500">{messages.emptyDetail}</p>}
      {action === undefined ? null : (
        <button
          type="button"
          onClick={() => {
            if (action.type === 'pending') model.setNote(action.note)
            if (action.type === 'navigate') {
              const target = targetScreenOf(action, {})
              if (target !== null) model.onNavigate(target, resolveParams(action.params, { screenParams: model.screenParams }))
            }
          }}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          <FigmaAsset screenId={EMPTY_SCREEN} nodeId={EMPTY_ASSET.addIcon} className="size-3.5" />
          {action.label}
        </button>
      )}
    </div>
  )
}
