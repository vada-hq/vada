import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { FigmaAsset } from '../components/FigmaAsset'
import { ProgressBar } from '../components/ProgressBar'
import {
  ACCENT_BORDER,
  ALERT_CHIP,
  DEPARTMENT_CHIP,
  NEUTRAL_BORDER,
  NEUTRAL_CHIP,
  STATE_CHIP,
  STATUS_CHIP,
} from '../design/tones'
import { readListSource, readObjectSource } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { getOptionSource } from '../option-sources/catalog'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, elementByNodeId, evtTask01 } from '../spec/screens'
import type {
  ButtonSpec,
  DisplayAction,
  ItemListSpec,
  SelectSpec,
  SummarySpec,
} from '../spec/types'

// 행사 업무 보드(EVT-TASK-01).
//
// 칸반 자체는 새 것이 아니다 — TASK-01(상시 업무)이 이미 같은 모양이고, 열 넷은
// 같은 출처를 status만 바꿔 네 번 조회한다. 여기서 처음인 것은 **인자가 오가는
// 것**이다.
//
// - 받는다: 어느 행사의 보드인지(eventId). 화면 안 어디에도 없으므로 밖에서 온다.
// - 넘긴다: 카드를 누르면 그 카드가 '어느 업무인지'(taskId)를 업무 상세에 준다.
//   값은 눌린 그 행만 안다 — 명세도 화면도 모른다(itemField).
//
// 제목도 처음이다. 이 화면의 제목은 그 행사의 이름이고, 이름은 데이터에만 있다
// (meta.titleFrom). meta.title은 화면을 부르는 말로 남아 보드의 머리에 그려진다.

const SCREEN = 'EVT-TASK-01'

const NODE = {
  addTask: '25:1280',
  tabs: ['25:1286', '25:1289', '25:1292', '25:1295', '25:1298', '25:1301', '25:1304'],
  workspace: '25:1307',
  event: '25:1331',
  alerts: '25:1352',
  scope: '25:1379',
  columns: ['25:1392', '25:1433', '25:1505', '25:1536'],
} as const

const ASSET = {
  addTask: '25:1281',
  workspaceTime: '25:1318',
  alertByField: {
    delayedCount: '25:1354',
    reviewCount: '25:1361',
    mineCount: '25:1367',
    unassignedCount: '25:1373',
  } as Record<string, string>,
  // 카드의 아이콘은 항목마다 되풀이되므로 본이 되는 하나씩만 가리킨다.
  cardDate: '25:1410',
  // 기한이 지난 카드는 아이콘까지 붉다(25:1476이 #E7000B, 나머지는 #99A1AF).
  cardDateOverdue: '25:1476',
  cardDocument: '25:1457',
} as const

interface EVTTASK01ScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function EVTTASK01Screen({ screenParams, onNavigate }: EVTTASK01ScreenProps) {
  const addTask = elementByNodeId(evtTask01, NODE.addTask).spec as ButtonSpec
  const workspaceSpec = elementByNodeId(evtTask01, NODE.workspace).spec as SummarySpec
  const eventSpec = elementByNodeId(evtTask01, NODE.event).spec as SummarySpec
  const alerts = elementByNodeId(evtTask01, NODE.alerts).spec as SummarySpec
  const scope = elementByNodeId(evtTask01, NODE.scope).spec as SelectSpec

  const [scopeValue, setScopeValue] = useState(scope.initialValue ?? '')
  const [note, setNote] = useState<string | null>(null)

  // 명세가 요구한 인자가 없으면 조용히 아무 행사나 보여주지 않는다. 미등록 화면
  // 오류 카드와 같은 태도다 — 명세의 구멍을 숨기지 않는다.
  const missing = (evtTask01.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return (
      <AppShell
        screenId={evtTask01.screenId}
        eyebrow={evtTask01.meta?.eyebrow}
        title={evtTask01.meta?.title ?? evtTask01.screenId}
        onNavigate={onNavigate}
      >
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {`이 화면은 ${missing.map((param) => param.key).join('·')}가 있어야 열립니다. ` +
            `${missing.map((param) => param.description).join(' ')} 주소에 붙여 주세요 — 예: #/${evtTask01.screenId}?eventId=E-01`}
        </p>
      </AppShell>
    )
  }

  const argumentsOf = (params: SummarySpec['params']) =>
    resolveParams(params, { screenParams, fields: { [scope.fieldKey]: scopeValue } })

  const workspace = readObjectSource(
    workspaceSpec.dataSourceKey ?? '',
    argumentsOf(workspaceSpec.params),
  )
  const event = readObjectSource(eventSpec.dataSourceKey ?? '', argumentsOf(eventSpec.params))
  const alertRow = readObjectSource(alerts.dataSourceKey ?? '', argumentsOf(alerts.params))

  const scopeSource = getOptionSource(scope.optionsSource.key)
  const scopeOptions = scopeSource.type === 'static' ? scopeSource.options : []

  // 눈에 띄어야 하는 것은 없으면 아예 오지 않는다 — 자리를 비워 두지 않는다.
  const workspaceItems = (workspaceSpec.items ?? []).filter(
    (item) => workspace[item.field ?? ''] !== undefined,
  )
  const chipFields = new Set(['status', 'alert'])
  const noteField = 'permissionNote'

  return (
    <AppShell
      screenId={evtTask01.screenId}
      eyebrow={evtTask01.meta?.eyebrow}
      // 이 화면의 제목은 그 행사의 이름이다. 명세가 어디서 읽을지를 말한다.
      title={drawnTitleOf(evtTask01, screenParams)}
      onNavigate={onNavigate}
      headerAction={
        <button
          type="button"
          data-node-id={NODE.addTask}
          disabled={addTask.initiallyDisabled}
          onClick={() => {
            if (addTask.action.type === 'pending') setNote(addTask.action.note)
          }}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.addTask} className="size-3.5" />
          {addTask.label}
        </button>
      }
    >
      {/* 행사 작업 공간의 갈피. 갈피마다 다른 화면이라 고르는 것이 아니라 옮겨 간다. */}
      <nav
        aria-label="행사 작업 공간"
        className="-mx-8 -mt-6 flex gap-6 border-b border-gray-100 bg-white px-8"
      >
        {NODE.tabs.map((nodeId) => {
          const tab = elementByNodeId(evtTask01, nodeId).spec as ButtonSpec
          const current = tab.emphasis === 'primary'
          return (
            <button
              key={nodeId}
              type="button"
              data-node-id={nodeId}
              aria-current={current ? 'page' : undefined}
              onClick={() => {
                if (tab.action.type === 'pending') {
                  setNote(tab.action.note)
                  return
                }
                if (tab.action.type === 'navigate') {
                  onNavigate(
                    tab.action.targetScreenId,
                    resolveParams(tab.action.params, { screenParams }),
                  )
                }
              }}
              className={`border-b-2 py-3.5 text-sm font-medium ${
                current
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </nav>

      {/* 행사 머리. 갈피를 옮겨 다녀도 그대로인 값이라 화면이 아니라 행사에 딸린다. */}
      <div
        data-node-id={NODE.workspace}
        className="-mx-8 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-200 bg-white px-8 py-2.5"
      >
        {workspaceItems.map((item) => {
          const field = item.field ?? ''
          const value = String(workspace[field])
          if (chipFields.has(field)) {
            const tone = String(workspace[`${field === 'status' ? 'status' : 'alert'}Tone`])
            return (
              <span
                key={field}
                data-design-rule="state-chip"
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  STATE_CHIP[tone] ?? NEUTRAL_CHIP
                }`}
              >
                {value}
              </span>
            )
          }
          if (field === noteField) {
            // 이 안내만 오른쪽 끝으로 밀려 옅게 놓인다.
            return (
              <span key={field} className="ml-auto text-xs text-gray-400">
                {value}
              </span>
            )
          }
          return (
            <span key={field} className="flex items-center gap-1.5 text-xs text-gray-500">
              {field === 'startAt' ? (
                <FigmaAsset
                  screenId={SCREEN}
                  nodeId={ASSET.workspaceTime}
                  className="size-3"
                />
              ) : null}
              {value}
            </span>
          )
        })}
      </div>

      {note === null ? null : (
        <p role="status" className="pt-4 text-xs font-medium text-gray-500">
          {note}
        </p>
      )}

      {/* 행사 카드. 제목은 화면의 제목과 같은 값이지만 그리는 자리가 둘이다. */}
      <section
        data-node-id={NODE.event}
        className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-6 py-4"
      >
        <span>
          <span className="block text-sm font-bold text-gray-900">
            {String(event[eventSpec.titleField ?? ''])}
          </span>
          <span className="block pt-1 text-xs text-gray-500">
            {String(event[eventSpec.items?.[0]?.field ?? ''])}
          </span>
        </span>
        <span className="flex items-center gap-6">
          {(eventSpec.items ?? []).slice(1, 2).map((item) => (
            <span key={item.label} className="text-center">
              <span className="block text-xs text-gray-400">{item.label}</span>
              <span className="block text-xl font-bold text-blue-600">
                {String(event[item.field ?? ''])}
              </span>
            </span>
          ))}
          {(eventSpec.items ?? []).slice(2, 3).map((item) => (
            <span key={item.label} className="block border-l border-gray-100 pl-6">
              <span className="block pb-1 text-right text-xs text-gray-400">
                {item.label}
              </span>
              <ProgressBar
                percent={Number(event.progressPercent)}
                ariaLabel={item.label}
                label={
                  <span className="font-bold text-gray-700">
                    {String(event[item.field ?? ''])}
                  </span>
                }
              />
            </span>
          ))}
        </span>
      </section>

      <div className="flex flex-wrap items-center gap-2 py-4">
        <div data-node-id={NODE.alerts} className="flex flex-1 flex-wrap gap-2">
          {(alerts.items ?? []).map((item) => (
            <span
              key={item.label}
              data-design-rule="status-chip"
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                STATUS_CHIP[item.field ?? ''] ?? NEUTRAL_CHIP
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
                <span className={selected ? 'text-blue-700' : 'text-gray-500'}>
                  {option.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-4 pb-3">
        <h2 className="text-sm font-bold text-gray-900">{evtTask01.meta?.title}</h2>
        <span className="text-xs text-gray-400">{evtTask01.meta?.description}</span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {NODE.columns.map((nodeId) => (
          <BoardColumn
            key={nodeId}
            nodeId={nodeId}
            screenParams={screenParams}
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
  screenParams: Record<string, string>
  scopeFieldKey: string
  scopeValue: string
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

function BoardColumn({
  nodeId,
  screenParams,
  scopeFieldKey,
  scopeValue,
  onNavigate,
}: BoardColumnProps) {
  const spec = elementByNodeId(evtTask01, nodeId).spec as ItemListSpec
  const rows = readListSource(
    spec.dataSourceKey,
    resolveParams(spec.params, { screenParams, fields: { [scopeFieldKey]: scopeValue } }),
  )

  return (
    <section
      data-node-id={nodeId}
      className="rounded-xl border border-gray-200 bg-gray-100 p-3"
    >
      <h3 className="flex items-center justify-between pb-2 text-xs font-bold text-gray-500">
        <span>{spec.title}</span>
        {/* 열의 건수는 명세에 없다. 이 열의 항목 수가 곧 건수다. */}
        <span className="rounded bg-gray-200 px-1.5 py-0.5">{rows.length}</span>
      </h3>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs font-medium text-gray-400">
          이 단계에 업무가 없습니다
        </p>
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

interface TaskCardProps {
  row: DataRow
  itemAction: DisplayAction | undefined
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

function TaskCard({ row, itemAction, onNavigate }: TaskCardProps) {
  const [note, setNote] = useState<string | null>(null)
  // 강조 색이 부서 색과 다르면 그 카드는 먼저 봐야 하는 상태다(담당자가 없다).
  const flagged = row.tone !== row.departmentTone
  const overdue = row.alertTone === 'red'

  return (
    <div
      className={`rounded-lg border bg-white ${ACCENT_BORDER[String(row.tone)] ?? NEUTRAL_BORDER}`}
    >
      <button
        type="button"
        onClick={() => {
          if (itemAction === undefined) return
          if (itemAction.type === 'navigate') {
            // 어느 업무인지는 눌린 이 행만 안다. 명세는 어느 조각인지만 말한다.
            onNavigate(
              itemAction.targetScreenId,
              resolveParams(itemAction.params, { row }),
            )
            return
          }
          setNote(itemAction.note)
        }}
        className="w-full px-3 py-2.5 text-left hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
      >
        <span className="block text-xs font-bold text-gray-800">{String(row.title)}</span>
        <span className="flex flex-wrap items-center gap-1 pt-1.5">
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
              DEPARTMENT_CHIP[String(row.departmentTone)] ?? NEUTRAL_CHIP
            }`}
          >
            {String(row.department)}
          </span>
          {row.alert === undefined ? null : (
            <span
              className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${
                ALERT_CHIP[String(row.alertTone)] ?? NEUTRAL_CHIP
              }`}
            >
              {String(row.alert)}
            </span>
          )}
          {/* 담당자가 없으면 배정이 필요하다는 사실이 값에 이미 들어 있다. */}
          <span
            className={`text-[11px] ${
              flagged ? 'font-semibold text-red-600' : 'font-medium text-gray-400'
            }`}
          >
            {String(row.assignee)}
          </span>
        </span>
        <span className="mt-2 flex items-center justify-between pt-1.5">
          <span
            className={`flex items-center gap-1 rounded border border-gray-50 text-[11px] ${
              overdue ? 'font-semibold text-red-600' : 'font-medium text-gray-400'
            }`}
          >
            <FigmaAsset
              screenId={SCREEN}
              nodeId={overdue ? ASSET.cardDateOverdue : ASSET.cardDate}
              className="size-3"
            />
            {String(row.dueDate)}
          </span>
          {/* 딸린 문서가 있을 때만 표시가 붙는다. 개수는 오지 않는다. */}
          {row.hasDocuments === undefined ? null : (
            <FigmaAsset
              screenId={SCREEN}
              nodeId={ASSET.cardDocument}
              className="size-3"
              alt="관련 문서 있음"
            />
          )}
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
