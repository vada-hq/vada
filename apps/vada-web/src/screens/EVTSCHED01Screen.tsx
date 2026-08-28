import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { FigmaAsset } from '../components/FigmaAsset'
import { WorkspaceHeader } from '../components/WorkspaceHeader'
import { ACCENT_BAR, CHOICE_CHIP, LEAD_TEXT, NEUTRAL_CHIP, STATE_CHIP } from '../design/tones'
import { readListSource } from '../data-sources/catalog'
import { getOptionSource } from '../option-sources/catalog'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, elementByNodeId, evtSched01 } from '../spec/screens'
import type { ButtonSpec, ItemListSpec, SelectSpec } from '../spec/types'

// 행사 일정(EVT-SCHED-01).
//
// 행사 작업 공간의 **다섯 번째** 화면이다. 갈피 줄·상태 줄·제목은 앞의 넷과 같이
// shell.json의 작업 공간이 갖고, 화면은 어디에 그리는지만 준다.
//
// 이 화면에 새 어휘는 없다. 좁혀 보기는 EVT-DOC-01의 필터에서 개수만 빠진 것이고,
// 줄 목록은 EVT-MEET-01의 카드 목록과 같다. 다른 것은 **이 목록이 원본이 아니라는
// 사실**뿐인데, 그것도 화면이 아는 것이 아니다 — 줄마다 originNote가 어디를 고쳐야
// 하는지 말하고 화면은 그것을 그리기만 한다.

const SCREEN = 'EVT-SCHED-01'

const NODE = {
  calendar: '28:148',
  filter: '28:150',
  timeline: '28:161',
} as const

const ASSET = {
  workspaceStatus: { startAt: '28:129' } as Record<string, string>,
  // 줄마다 같은 그림(들어가기)이 다른 노드로 있다. 첫 줄의 것만 지목한다.
  enter: '28:180',
} as const

interface EVTSCHED01ScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function EVTSCHED01Screen({ screenParams, onNavigate }: EVTSCHED01ScreenProps) {
  const filter = elementByNodeId(evtSched01, NODE.filter).spec as SelectSpec
  const [scheduleFilter, setScheduleFilter] = useState(filter.initialValue ?? '')
  const [note, setNote] = useState<string | null>(null)

  const missing = (evtSched01.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return (
      <AppShell
        screenId={evtSched01.screenId}
        activeNavigationScreenId={evtSched01.activeNavigationScreenId}
        eyebrow={evtSched01.meta?.eyebrow}
        title={evtSched01.meta?.title ?? evtSched01.screenId}
        onNavigate={onNavigate}
      >
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {missing.map((param) => param.missingNote).join(' ')}
        </p>
      </AppShell>
    )
  }

  const calendar = elementByNodeId(evtSched01, NODE.calendar).spec as ButtonSpec
  const timeline = elementByNodeId(evtSched01, NODE.timeline).spec as ItemListSpec
  const optionSource = getOptionSource(filter.optionsSource.key)
  const options = optionSource.type === 'static' ? optionSource.options : []
  // 값이 바뀌면 서버에 다시 묻는다 — 받아온 것을 화면에서 거르지 않는다.
  const rows = readListSource(
    timeline.dataSourceKey,
    resolveParams(timeline.params, {
      screenParams,
      fields: { [filter.fieldKey]: scheduleFilter },
    }),
  )

  return (
    <AppShell
      screenId={evtSched01.screenId}
      activeNavigationScreenId={evtSched01.activeNavigationScreenId}
      eyebrow={evtSched01.meta?.eyebrow}
      title={drawnTitleOf(evtSched01, screenParams)}
      footerNote={evtSched01.meta?.footerNote}
      onNavigate={onNavigate}
    >
      <WorkspaceHeader
        screen={evtSched01}
        screenParams={screenParams}
        onNavigate={onNavigate}
        onPending={setNote}
        assetScreenId={SCREEN}
        statusAssets={ASSET.workspaceStatus}
      />

      <div className="flex items-end justify-between gap-4 pt-6">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{evtSched01.meta?.title}</h2>
          <p className="pt-1 text-xs text-gray-500">{evtSched01.meta?.description}</p>
        </div>
        <button
          type="button"
          data-node-id={NODE.calendar}
          onClick={() => {
            if (calendar.action.type === 'pending') setNote(calendar.action.note)
          }}
          className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          {calendar.label}
        </button>
      </div>

      {note === null ? null : (
        <p role="status" className="pt-3 text-xs font-medium text-gray-500">
          {note}
        </p>
      )}

      {/* 한 축이 아니다 — '이번 주'는 때로, 나머지는 무엇이냐로 자른다. 그래도
          하나만 고르는 것은 서버가 한 벌의 조건으로 받기 때문이다. */}
      <div
        data-node-id={NODE.filter}
        data-design-rule="choice-chip"
        role="radiogroup"
        aria-label={optionSource.description}
        className="flex flex-wrap gap-2 pt-4"
      >
        {options.map((option) => {
          const value = String(option.value)
          const selected = value === scheduleFilter
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setScheduleFilter(value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                selected ? CHOICE_CHIP.on : CHOICE_CHIP.off
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      <ul
        data-node-id={NODE.timeline}
        className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white"
      >
        {rows.map((row) => (
          <li key={String(row.id)}>
            <button
              type="button"
              onClick={() => {
                if (timeline.itemAction?.type === 'pending') setNote(timeline.itemAction.note)
              }}
              aria-label={`${String(row.title)} ${timeline.itemAction?.label ?? ''}`}
              className="flex w-full items-start gap-4 border border-gray-100 px-4 py-3.5 text-left hover:bg-gray-50"
            >
              {/* 때도 점과 같은 톤을 받는다 — 기준이 되는 줄은 둘 다 도드라진다. */}
              <span
                data-design-rule="lead-text"
                className={`w-14 shrink-0 pt-0.5 text-xs font-semibold ${
                  LEAD_TEXT[String(row.tone)] ?? LEAD_TEXT.gray
                }`}
              >
                {String(row.dateLabel)}
              </span>
              {/* 줄을 잇는 세로선과 그 위의 점. 점은 표 한 줄의 강조선과 같은
                  부품이 모양만 다른 것이라 같은 표를 쓴다(ACCENT_BAR). */}
              <span className="relative w-px shrink-0 self-stretch bg-gray-200">
                <span
                  data-design-rule="accent-bar"
                  className={`absolute top-1 -left-[2.5px] size-1.5 rounded-full ${
                    ACCENT_BAR[String(row.tone)] ?? ACCENT_BAR.gray
                  }`}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-800">
                    {String(row.title)}
                  </span>
                  <span
                    data-design-rule="state-chip"
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      STATE_CHIP[String(row.kindTone)] ?? NEUTRAL_CHIP
                    }`}
                  >
                    {String(row.kindLabel)}
                  </span>
                </span>
                <span className="block pt-1.5 text-xs font-medium text-gray-500">
                  {String(row.description)}
                </span>
                {/* 누가 맡았는지와 어디가 원본인지. 원본을 줄마다 말하는 것이 이
                    화면의 요점이라 밑줄 글씨로 접어 두지 않는다. */}
                <span className="flex flex-wrap gap-x-4 pt-2 text-[10px] font-medium text-gray-400">
                  <span>{String(row.ownerNote)}</span>
                  <span>{String(row.originNote)}</span>
                </span>
              </span>
              <FigmaAsset
                screenId={SCREEN}
                nodeId={ASSET.enter}
                className="mt-1 size-3 shrink-0"
              />
            </button>
          </li>
        ))}
      </ul>
    </AppShell>
  )
}
