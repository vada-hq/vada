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

// 상태 칩은 무엇을 세느냐에 따라 색이 다르다. 어느 상태냐는 명세의 field가 말하고
// 무슨 색이냐는 design이 말한다 — 자산을 field로 찾는 것과 같은 방식이다.
const ALERT_STYLE: Record<string, string> = {
  delayedCount: 'border-red-100 bg-red-50 text-red-700',
  reviewCount: 'border-yellow-100 bg-yellow-50 text-yellow-800',
  mineCount: 'border-blue-100 bg-blue-50 text-blue-800',
  unassignedCount: 'border-red-100 bg-red-50 text-red-700',
}

// 부서 색은 조직이 정하는 데이터라 이름으로 온다. 이름을 실제 색으로 옮기는 표만
// 구현이 갖는다 — 부서 이름을 여기 적으면 조직마다 달라지는 값을 코드에 박게 된다.
const DEPARTMENT_CHIP: Record<string, string> = {
  teal: 'bg-teal-100 text-teal-700',
  pink: 'bg-pink-100 text-pink-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  violet: 'bg-violet-100 text-violet-700',
  red: 'bg-red-100 text-red-700',
}

const CARD_BORDER: Record<string, string> = {
  teal: 'border-teal-500',
  pink: 'border-pink-500',
  emerald: 'border-emerald-500',
  violet: 'border-violet-500',
  red: 'border-red-500',
}

const ALERT_CHIP: Record<string, string> = {
  red: 'border-red-200 bg-red-50 text-red-700',
  yellow: 'border-yellow-200 bg-yellow-50 text-yellow-700',
}

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
        <div
          data-node-id={NODE.alerts}
          data-testid="task01-alerts"
          className="flex flex-1 flex-wrap gap-2"
        >
          {(alerts.items ?? []).map((item) => (
            <span
              key={item.label}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                ALERT_STYLE[item.field ?? ''] ?? 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              {item.field && ASSET.alertByField[item.field] ? (
                <FigmaAsset
                  screenId={SCREEN}
                  nodeId={ASSET.alertByField[item.field]}
                  className="size-3.5"
                />
              ) : null}
              {/* design은 이름과 건수를 한 텍스트 노드로 그린다 — 쪼개지 않는다. */}
              {`${item.label} ${item.field ? alertRow[item.field] : (item.value ?? '')}${item.unit ?? ''}`}
            </span>
          ))}
        </div>

        <div
          data-node-id={NODE.scope}
          role="radiogroup"
          aria-label={scope.label ?? '보는 범위'}
          className="flex shrink-0 gap-1 rounded-lg bg-gray-100 p-0.5"
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
                className={`rounded px-3 py-1 text-xs font-medium ${
                  selected ? 'bg-white' : 'hover:bg-gray-50'
                }`}
              >
                {/* 고른 것과 아닌 것의 글자 색이 다르므로 각자 제 요소에 담는다. */}
                <span className={selected ? 'text-blue-700' : 'text-gray-500'}>
                  {option.label}
                </span>
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
    <section
      data-node-id={nodeId}
      className="rounded-xl border border-gray-200 bg-gray-100 p-3"
    >
      <h2 className="flex items-center justify-between pb-2 text-xs font-bold text-gray-500">
        <span>{spec.title}</span>
        {/* 열의 건수는 명세에 없다. 이 열의 항목 수가 곧 건수다. */}
        <span className="rounded bg-gray-200 px-1.5 py-0.5">{rows.length}</span>
      </h2>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs font-medium text-gray-400">
          이 단계에 업무가 없습니다
        </p>
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
  // 강조 색이 부서 색과 다르면 그 카드는 먼저 봐야 하는 상태다(담당자가 없다).
  const flagged = row.tone !== row.departmentTone
  // 붉은 주의는 기한을 넘긴 것이다.
  const overdue = row.alertTone === 'red'

  return (
    <div
      className={`rounded-lg border bg-white ${CARD_BORDER[String(row.tone)] ?? 'border-gray-200'}`}
    >
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
        <span className="block text-xs font-bold text-gray-800">{String(row.title)}</span>
        <span className="flex flex-wrap items-center gap-1 pt-1.5">
          {/* 부서 색·주의 색은 조직 데이터가 갖는다(data-sources.json task.board). */}
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
              DEPARTMENT_CHIP[String(row.departmentTone)] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {String(row.department)}
          </span>
          <span className="rounded border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-600">
            {String(row.cycle)}
          </span>
          {row.alert === undefined ? null : (
            <span
              className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${
                ALERT_CHIP[String(row.alertTone)] ??
                'border-gray-200 bg-gray-100 text-gray-600'
              }`}
            >
              {String(row.alert)}
            </span>
          )}
        </span>
        <span
          className={`block pt-1.5 text-[11px] ${
            flagged ? 'font-semibold text-red-600' : 'font-medium text-gray-400'
          }`}
        >
          {String(row.assignee)}
        </span>
        {/* 기한이 지난 업무는 기한 옆에 그 사유를 붉게 함께 적는다. */}
        <span
          className={`mt-1 flex items-center gap-1 rounded border border-gray-50 text-[11px] ${
            overdue ? 'font-semibold text-red-500' : 'font-medium text-gray-400'
          }`}
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.cardDate} className="size-3" />
          {overdue ? `${row.dueDate} · ${row.alert}` : String(row.dueDate)}
        </span>
      </button>
      {note === null ? null : (
        <p className="border-t border-gray-200 px-3 py-1.5 text-[11px] font-medium text-gray-500">
          {note}
        </p>
      )}
    </div>
  )
}
