import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { FigmaAsset } from '../components/FigmaAsset'
import { readListSource, readObjectSource } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { getOptionSource } from '../option-sources/catalog'
import { elementByNodeId, task01 } from '../spec/screens'
import type { ItemListSpec, SelectSpec, SummarySpec } from '../spec/types'

// 상시 업무 칸반 보드(TASK-01).
//
// 열 넷은 각각 `itemList`다. 같은 출처를 status만 바꿔 네 번 조회한다 —
// 열의 단계는 명세가 정한 고정값이라 `params`에 value로 담긴다.
// 열 머리의 건수는 명세에 없다. 그 열의 항목 수가 곧 건수이므로 유도한다.

const SCREEN = 'TASK-01'

const NODE = {
  alerts: '18:95',
  scope: '18:122',
  columns: ['18:129', '18:174', '18:259', '18:286'],
} as const

// 상태 칩의 아이콘은 무엇을 세는지로 묶는다 — 순서에 기대지 않는다.
// 카드의 날짜 아이콘은 항목마다 되풀이되므로 첫 항목의 것을 본으로 쓴다.
const ASSET = {
  alertByField: {
    delayedCount: '18:97',
    reviewCount: '18:104',
    mineCount: '18:110',
    unassignedCount: '18:116',
  } as Record<string, string>,
  cardDate: '18:149',
} as const

interface TASK01ScreenProps {
  onNavigate: (screenId: string) => void
}

export function TASK01Screen({ onNavigate }: TASK01ScreenProps) {
  const alerts = elementByNodeId(task01, NODE.alerts).spec as SummarySpec
  const scope = elementByNodeId(task01, NODE.scope).spec as SelectSpec

  const [scopeValue, setScopeValue] = useState(scope.initialValue ?? '')
  const alertRow = readObjectSource(alerts.dataSourceKey ?? '')

  const scopeSource = getOptionSource(scope.optionsSource.key)
  const scopeOptions = scopeSource.type === 'static' ? scopeSource.options : []

  return (
    <AppShell
      screenId={task01.screenId}
      eyebrow={task01.meta?.eyebrow}
      title={task01.meta?.title ?? task01.screenId}
      description={task01.meta?.description}
      onNavigate={onNavigate}
    >
      <div className="flex flex-wrap items-center gap-2 pb-4">
        <div data-testid="task01-alerts" className="flex flex-1 flex-wrap gap-2">
          {(alerts.items ?? []).map((item) => (
            <span
              key={item.label}
              className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700"
            >
              {item.field && ASSET.alertByField[item.field] ? (
                <FigmaAsset
                  screenId={SCREEN}
                  nodeId={ASSET.alertByField[item.field]}
                  className="size-3.5"
                />
              ) : null}
              <span>{item.label}</span>
              <span className="font-semibold text-gray-900">
                {`${item.field ? alertRow[item.field] : (item.value ?? '')}${item.unit ?? ''}`}
              </span>
            </span>
          ))}
        </div>

        <div
          role="radiogroup"
          aria-label={scope.label ?? '보는 범위'}
          className="flex shrink-0 gap-1 rounded-lg border border-gray-200 bg-white p-0.5"
        >
          {scopeOptions.map((option) => {
            const value = String(option.value)
            const selected = value === scopeValue
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setScopeValue(value)}
                className={`rounded px-3 py-1 text-xs ${
                  selected
                    ? 'bg-blue-50 font-medium text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {NODE.columns.map((nodeId) => (
          <BoardColumn
            key={nodeId}
            nodeId={nodeId}
            scopeFieldKey={scope.fieldKey}
            scopeValue={scopeValue}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </AppShell>
  )
}

interface BoardColumnProps {
  nodeId: string
  scopeFieldKey: string
  scopeValue: string
  onNavigate: (screenId: string) => void
}

function BoardColumn({ nodeId, scopeFieldKey, scopeValue, onNavigate }: BoardColumnProps) {
  const spec = elementByNodeId(task01, nodeId).spec as ItemListSpec

  // 인자는 화면 필드를 가리키거나(fieldKey) 명세가 정한 고정값이다(value).
  const params = Object.fromEntries(
    Object.entries(spec.params ?? {}).map(([name, argument]) => [
      name,
      argument.value ?? (argument.fieldKey === scopeFieldKey ? scopeValue : ''),
    ]),
  )
  const rows = readListSource(spec.dataSourceKey, params)

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-3">
      <h2 className="flex items-center justify-between pb-2 text-xs font-semibold text-gray-700">
        <span>{spec.title}</span>
        {/* 열의 건수는 명세에 없다. 이 열의 항목 수가 곧 건수다. */}
        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">{rows.length}</span>
      </h2>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-gray-400">이 단계에 업무가 없습니다</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={String(row.title)}>
              <TaskCard row={row} itemAction={spec.itemAction} onNavigate={onNavigate} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

interface TaskCardProps {
  row: DataRow
  itemAction: ItemListSpec['itemAction']
  onNavigate: (screenId: string) => void
}

function TaskCard({ row, itemAction, onNavigate }: TaskCardProps) {
  const [note, setNote] = useState<string | null>(null)

  return (
    <div className="rounded-lg border border-gray-200">
      <button
        type="button"
        onClick={() => {
          if (itemAction === undefined) return
          if (itemAction.type === 'navigate') {
            onNavigate(itemAction.targetScreenId)
            return
          }
          setNote(itemAction.note)
        }}
        className="w-full px-3 py-2.5 text-left hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
      >
        <span className="block text-xs font-medium text-gray-900">{String(row.title)}</span>
        <span className="flex flex-wrap items-center gap-1 pt-1.5">
          <Chip tone="neutral">{String(row.department)}</Chip>
          <Chip tone="neutral">{String(row.cycle)}</Chip>
          {row.alert === undefined ? null : <Chip tone="alert">{String(row.alert)}</Chip>}
        </span>
        <span className="block pt-1.5 text-[11px] text-gray-500">{String(row.assignee)}</span>
        <span className="flex items-center gap-1 pt-1 text-[11px] text-gray-500">
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.cardDate} className="size-3" />
          {String(row.dueDate)}
        </span>
      </button>
      {note === null ? null : (
        <p className="border-t border-gray-200 px-3 py-1.5 text-[11px] text-gray-500">{note}</p>
      )}
    </div>
  )
}

function Chip({ tone, children }: { tone: 'neutral' | 'alert'; children: string }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[11px] ${
        tone === 'alert' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'
      }`}
    >
      {children}
    </span>
  )
}
