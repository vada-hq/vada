import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { FigmaAsset } from '../components/FigmaAsset'
import { WorkspaceHeader } from '../components/WorkspaceHeader'
import { NEUTRAL_CHIP, NEUTRAL_VALUE, STATE_CHIP, VALUE_TEXT } from '../design/tones'
import { findDataSource, readListSource, readObjectSource } from '../data-sources/catalog'
import { getOptionSource } from '../option-sources/catalog'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, elementByNodeId, evtFin01 } from '../spec/screens'
import type { ButtonSpec, ItemListSpec, SelectSpec, SummarySpec } from '../spec/types'

// 행사 재정 — 개요(EVT-FIN-01).
//
// 행사 작업 공간의 **일곱 번째이자 마지막 갈피**다. 새 어휘는 없다 — 값 타일은
// HOME-01K, 보드는 EVT-TASK-01, 화면 안 갈피는 EVT-04에서 그대로 온다.
//
// 이 화면이 말하는 것은 **금액을 화면이 계산하지 않는다**는 것이다. 배정에서 무엇을
// 빼야 사용 가능액이 되는지는 조직의 재정 규칙이고, 그 규칙이 바뀌면 화면이 아니라
// 서버가 바뀐다. 그래서 네 값이 다 따로 온다.

const SCREEN = 'EVT-FIN-01'

const NODE = {
  myRequests: '28:780',
  newRequest: '28:785',
  totals: '28:836',
  tab: '28:866',
  alerts: '28:872',
  columns: ['28:878', '28:914', '28:920', '28:926'],
} as const

const ASSET = {
  workspaceStatus: { startAt: '28:823' } as Record<string, string>,
  myRequests: '28:781',
  newRequest: '28:786',
} as const

// 타일마다 값의 톤이 다르다. 어느 타일이 어느 톤인지만 여기서 말하고, 톤을 실제
// 색으로 옮기는 일은 design/tones가 한 곳에서 한다(HOME-01K와 같은 방식).
//
// 사용 가능액만 도드라지는 것은 **그것이 다음 결정을 좌우하는 값**이기 때문이다.
// 데이터가 정할 일이 아니라 이 화면이 무엇을 앞세울지 정하는 것이다.
const TILE_TONE: Record<string, string> = { available: 'blue' }

interface EVTFIN01ScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function EVTFIN01Screen({ screenParams, onNavigate }: EVTFIN01ScreenProps) {
  const [tab, setTab] = useState(
    (elementByNodeId(evtFin01, NODE.tab).spec as SelectSpec).initialValue ?? '',
  )
  const [note, setNote] = useState<string | null>(null)

  const missing = (evtFin01.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return (
      <AppShell
        screenId={evtFin01.screenId}
        eyebrow={evtFin01.meta?.eyebrow}
        title={evtFin01.meta?.title ?? evtFin01.screenId}
        onNavigate={onNavigate}
      >
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {`이 화면은 ${missing.map((param) => param.key).join('·')}가 있어야 열립니다. ` +
            `${missing.map((param) => param.description).join(' ')} 주소에 붙여 주세요 — 예: #/${evtFin01.screenId}?eventId=E-01`}
        </p>
      </AppShell>
    )
  }

  const buttonAt = (nodeId: string) => elementByNodeId(evtFin01, nodeId).spec as ButtonSpec
  const pend = (spec: ButtonSpec) => () => {
    if (spec.action.type === 'pending') setNote(spec.action.note)
  }

  const totals = elementByNodeId(evtFin01, NODE.totals).spec as SummarySpec
  const totalRow = readObjectSource(
    totals.dataSourceKey ?? '',
    resolveParams(totals.params, { screenParams }),
  )
  const alerts = elementByNodeId(evtFin01, NODE.alerts).spec as SummarySpec
  const alertRow = readObjectSource(
    alerts.dataSourceKey ?? '',
    resolveParams(alerts.params, { screenParams }),
  )
  const tabSpec = elementByNodeId(evtFin01, NODE.tab).spec as SelectSpec
  const tabSource = getOptionSource(tabSpec.optionsSource.key)
  const tabOptions = tabSource.type === 'static' ? tabSource.options : []

  return (
    <AppShell
      screenId={evtFin01.screenId}
      eyebrow={evtFin01.meta?.eyebrow}
      title={drawnTitleOf(evtFin01, screenParams)}
      onNavigate={onNavigate}
      headerAction={
        <div className="flex gap-2">
          {(
            [
              [NODE.myRequests, ASSET.myRequests, false],
              [NODE.newRequest, ASSET.newRequest, true],
            ] as const
          ).map(([nodeId, asset, primary]) => {
            const spec = buttonAt(nodeId)
            return (
              <button
                key={nodeId}
                type="button"
                data-node-id={nodeId}
                onClick={pend(spec)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                  primary
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <FigmaAsset screenId={SCREEN} nodeId={asset} className="size-3" />
                {spec.label}
              </button>
            )
          })}
        </div>
      }
    >
      <WorkspaceHeader
        screen={evtFin01}
        screenParams={screenParams}
        onNavigate={onNavigate}
        onPending={setNote}
        assetScreenId={SCREEN}
        statusAssets={ASSET.workspaceStatus}
      />

      {/* 금액 넷. 빼기는 화면이 하지 않는다 — 무엇을 빼는지가 재정 규칙이다. */}
      <div
        data-node-id={NODE.totals}
        className="grid grid-cols-1 gap-4 pt-6 md:grid-cols-4"
      >
        {(totals.items ?? []).map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <p className="text-xs font-medium text-gray-500">{item.label}</p>
            <p className="flex items-baseline gap-0.5 pt-1">
              <span
                data-design-rule="value-text"
                className={`text-base font-bold ${
                  VALUE_TEXT[TILE_TONE[item.field ?? ''] ?? ''] ?? NEUTRAL_VALUE
                }`}
              >
                {String(totalRow[item.field ?? ''])}
              </span>
              <span className="text-xs text-gray-400">{item.unit}</span>
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 border-b border-gray-200 pt-6">
        <div data-node-id={NODE.tab} role="tablist" aria-label={tabSource.description}>
          {tabOptions.map((option) => {
            const current = option.value === tab
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={current}
                onClick={() => {
                  setTab(option.value)
                  setNote(option.description ?? null)
                }}
                className={`-mb-px border-b-2 px-3.5 py-2 text-sm font-medium ${
                  current ? 'border-blue-600' : 'border-transparent hover:text-gray-700'
                }`}
              >
                <span className={current ? 'text-blue-700' : 'text-gray-500'}>
                  {option.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* 지금 사람 손이 필요한 건수. 금액과 다른 것이라 출처도 다르다. */}
        <div data-node-id={NODE.alerts} className="flex items-center gap-1.5 pb-2">
          {(alerts.items ?? []).map((item) => (
            <span key={item.label} className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">{item.label}</span>
              <span className="rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">
                {String(alertRow[item.field ?? ''])}
              </span>
            </span>
          ))}
        </div>
      </div>

      {note === null ? null : (
        <p role="status" className="pt-3 text-xs font-medium text-gray-500">
          {note}
        </p>
      )}

      {/* 열 넷은 명세에 고정이고 각 열에 몇 장이 오는지가 데이터에 달렸다. */}
      <div className="grid grid-cols-1 gap-4 pt-4 md:grid-cols-4">
        {NODE.columns.map((nodeId) => {
          const column = elementByNodeId(evtFin01, nodeId).spec as ItemListSpec
          const cards = readListSource(
            column.dataSourceKey,
            resolveParams(column.params, { screenParams }),
          )
          return (
            <div key={nodeId} data-node-id={nodeId}>
              <p className="pb-2 text-xs font-semibold text-gray-600">{column.title}</p>
              <div className="flex min-h-64 flex-col gap-2 rounded-xl border border-gray-200 bg-gray-100 p-2">
                {cards.length === 0 ? (
                  <p
                    data-design-state="empty"
                    className="pt-16 text-center text-xs text-gray-400"
                  >
                    {findDataSource(column.dataSourceKey).messages.empty}
                  </p>
                ) : (
                  cards.map((card) => (
                    <button
                      key={String(card.id)}
                      type="button"
                      onClick={() => {
                        if (column.itemAction?.type === 'pending') {
                          setNote(column.itemAction.note)
                        }
                      }}
                      aria-label={`${String(card.title)} ${column.itemAction?.label ?? ''}`}
                      className="rounded border border-gray-200 bg-white p-3 text-left hover:bg-gray-50"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span
                          data-design-rule="state-chip"
                          className={`rounded px-2 py-0.5 text-xs font-medium ${STATE_CHIP.gray}`}
                        >
                          {String(card.departmentLabel)}
                        </span>
                        <span className="text-[10px] font-medium text-gray-400">
                          {String(card.requestedAt)}
                        </span>
                      </span>
                      <span className="block pt-2 text-xs font-bold text-gray-800">
                        {String(card.title)}
                      </span>
                      <span className="block pt-1 text-[10px] font-medium text-gray-500">
                        {String(card.itemsNote)}
                      </span>
                      {/* design은 이 줄에 gray-50 테두리를 둘렀다. 흰 바탕 위에서는
                          거의 보이지 않지만 그린 것은 그린 것이다. */}
                      <span className="mt-1 flex items-center justify-between gap-2 border border-gray-50 pt-2">
                        <span className="text-xs font-bold text-gray-900">
                          {String(card.amountNote)}
                        </span>
                        <span
                          data-design-rule="state-chip"
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            STATE_CHIP[String(card.statusTone)] ?? NEUTRAL_CHIP
                          }`}
                        >
                          {String(card.status)}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </AppShell>
  )
}
