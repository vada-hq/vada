import { useState } from 'react'
import { FigmaAsset } from '../../components/FigmaAsset'
import { readListSource } from '../../data-sources/catalog'
import type { DataRow } from '../../data-sources/definitions'
import {
  ACCENT_BORDER,
  ALERT_CHIP,
  DEPARTMENT_CHIP,
  NEUTRAL_BORDER,
  NEUTRAL_CHIP,
} from '../../design/tones'
import { resolveParams } from '../../spec/params'
import { elementByNodeId, evtTask01 } from '../../spec/screens'
import { noteOf, targetScreenOf } from '../../spec/types'
import type { DisplayAction, ItemListSpec } from '../../spec/types'
import { ASSET, NODE, SCREEN } from './spec'

interface TaskBoardProps {
  screenParams: Record<string, string>
  scopeFieldKey: string
  scopeValue: string
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

/** 선택한 범위에 맞는 네 개의 업무 열을 그린다. */
export function TaskBoard(props: TaskBoardProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {NODE.columns.map((nodeId) => <BoardColumn key={nodeId} nodeId={nodeId} {...props} />)}
    </div>
  )
}

function BoardColumn({
  nodeId,
  screenParams,
  scopeFieldKey,
  scopeValue,
  onNavigate,
}: TaskBoardProps & { nodeId: string }) {
  const spec = elementByNodeId(evtTask01, nodeId).spec as ItemListSpec
  const rows = readListSource(
    spec.dataSourceKey,
    resolveParams(spec.params, { screenParams, fields: { [scopeFieldKey]: scopeValue } }),
  )
  return (
    <section data-node-id={nodeId} className="rounded-xl border border-gray-200 bg-gray-100 p-3">
      <h3 className="flex items-center justify-between pb-2 text-xs font-bold text-gray-500">
        <span>{spec.title}</span>
        <span className="rounded bg-gray-200 px-1.5 py-0.5">{rows.length}</span>
      </h3>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs font-medium text-gray-400">이 단계에 업무가 없습니다</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={String(row.id)}>
              <TaskCard row={row} itemAction={spec.itemAction} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function TaskCard({
  row,
  itemAction,
  onNavigate,
}: {
  row: DataRow
  itemAction: DisplayAction | undefined
  onNavigate: TaskBoardProps['onNavigate']
}) {
  const [note, setNote] = useState<string | null>(null)
  const flagged = row.tone !== row.departmentTone
  const overdue = row.alertTone === 'red'
  return (
    <div className={`rounded-lg border bg-white ${ACCENT_BORDER[String(row.tone)] ?? NEUTRAL_BORDER}`}>
      <button
        type="button"
        onClick={() => {
          if (itemAction === undefined) return
          if (itemAction.type === 'navigate') {
            onNavigate(
              targetScreenOf(itemAction, row) ?? itemAction.type,
              resolveParams(itemAction.params, { row }),
            )
            return
          }
          setNote(noteOf(itemAction))
        }}
        className="w-full px-3 py-2.5 text-left hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
      >
        <span className="block text-xs font-bold text-gray-800">{String(row.title)}</span>
        <span className="flex flex-wrap items-center gap-1 pt-1.5">
          <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${DEPARTMENT_CHIP[String(row.departmentTone)] ?? NEUTRAL_CHIP}`}>
            {String(row.department)}
          </span>
          {row.alert === undefined ? null : (
            <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${ALERT_CHIP[String(row.alertTone)] ?? NEUTRAL_CHIP}`}>
              {String(row.alert)}
            </span>
          )}
          <span className={`text-[11px] ${flagged ? 'font-semibold text-red-600' : 'font-medium text-gray-400'}`}>
            {String(row.assignee)}
          </span>
        </span>
        <span className="mt-2 flex items-center justify-between pt-1.5">
          <span className={`flex items-center gap-1 rounded border border-gray-50 text-[11px] ${overdue ? 'font-semibold text-red-600' : 'font-medium text-gray-400'}`}>
            <FigmaAsset screenId={SCREEN} nodeId={overdue ? ASSET.cardDateOverdue : ASSET.cardDate} className="size-3" />
            {String(row.dueDate)}
          </span>
          {row.hasDocuments !== true ? null : (
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.cardDocument} className="size-3" alt="관련 문서 있음" />
          )}
        </span>
      </button>
      {note === null ? null : (
        <p className="border-t border-gray-200 px-3 py-1.5 text-[11px] font-medium text-gray-500">{note}</p>
      )}
    </div>
  )
}
