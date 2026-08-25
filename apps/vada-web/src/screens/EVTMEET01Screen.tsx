import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { FigmaAsset } from '../components/FigmaAsset'
import { WorkspaceHeader } from '../components/WorkspaceHeader'
import { NEUTRAL_CHIP, STATE_CHIP } from '../design/tones'
import { readListSource, readObjectSource } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, elementByNodeId, evtMeet01 } from '../spec/screens'
import type { ButtonSpec, ItemListSpec, SummarySpec } from '../spec/types'

// 행사 관련 회의(EVT-MEET-01).
//
// 행사 작업 공간의 **네 번째** 화면이다. 갈피 줄·상태 줄·제목은 앞의 셋과 같이
// shell.json의 작업 공간이 갖고, 화면은 어디에 그리는지만 준다.
//
// 여기서 처음인 것은 **이미 명세된 화면으로 나가는 이동**이다. 지금까지 작업
// 공간의 화면이 나가는 곳은 전부 갈피(같은 공간 안)이거나 아직 없는 화면이었다.
// '전체 회의 보기'는 공간 밖의 회의 목록(OPS-MEET-01A)으로 나간다 — 그 화면은
// 행사에 매이지 않으므로 인자를 받지 않고, 그래서 아무것도 넘기지 않는다.

const SCREEN = 'EVT-MEET-01'

const NODE = {
  briefing: '25:1994',
  head: '25:2004',
  allMeetings: '25:2009',
  meetings: '25:2011',
} as const

const ASSET = {
  briefing: '25:1995',
  workspaceStatus: { startAt: '25:1981' } as Record<string, string>,
  // 카드마다 같은 그림 셋(때·곳·들어가기)이 다른 노드로 있다. 순서에 기대지
  // 않고 첫 카드의 것만 지목한다 — 자산 대조는 같은 그림을 내용으로 묶는다.
  when: '25:2025',
  where: '25:2032',
  enter: '25:2038',
} as const

interface EVTMEET01ScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function EVTMEET01Screen({ screenParams, onNavigate }: EVTMEET01ScreenProps) {
  const [note, setNote] = useState<string | null>(null)

  const missing = (evtMeet01.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return (
      <AppShell
        screenId={evtMeet01.screenId}
        eyebrow={evtMeet01.meta?.eyebrow}
        title={evtMeet01.meta?.title ?? evtMeet01.screenId}
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

  const briefing = elementByNodeId(evtMeet01, NODE.briefing).spec as SummarySpec
  const head = elementByNodeId(evtMeet01, NODE.head).spec as SummarySpec
  const headRow = readObjectSource(
    head.dataSourceKey ?? '',
    resolveParams(head.params, { screenParams }),
  )
  const allMeetings = elementByNodeId(evtMeet01, NODE.allMeetings).spec as ButtonSpec
  const meetings = elementByNodeId(evtMeet01, NODE.meetings).spec as ItemListSpec
  const rows = readListSource(
    meetings.dataSourceKey,
    resolveParams(meetings.params, { screenParams }),
  )

  return (
    <AppShell
      screenId={evtMeet01.screenId}
      eyebrow={evtMeet01.meta?.eyebrow}
      title={drawnTitleOf(evtMeet01, screenParams)}
      onNavigate={onNavigate}
    >
      <WorkspaceHeader
        screen={evtMeet01}
        screenParams={screenParams}
        onNavigate={onNavigate}
        onPending={setNote}
        assetScreenId={SCREEN}
        statusAssets={ASSET.workspaceStatus}
      />

      {/* 안내. EVT-02의 배너와 같은 요소인데 값이 데이터가 아니라 명세에 있다 —
          어느 행사를 보든 같은 말이기 때문이다. */}
      <div
        data-node-id={NODE.briefing}
        className="mt-6 flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3.5"
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.briefing} className="mt-0.5 size-3.5" />
        <span className="text-xs text-blue-800">
          {(briefing.items ?? []).map((item) => item.value).join(' ')}
        </span>
      </div>

      <div className="flex items-end justify-between gap-4 pt-4">
        <div data-node-id={NODE.head}>
          <h2 className="text-sm font-semibold text-gray-900">{head.title}</h2>
          {/* 건수는 명세가 세지 않는다 — 무엇을 어떤 단계로 세는지는 서버가 안다. */}
          <p className="pt-1 text-xs text-gray-500">
            {String(headRow[head.descriptionField ?? ''])}
          </p>
        </div>
        <button
          type="button"
          data-node-id={NODE.allMeetings}
          onClick={() => {
            if (allMeetings.action.type === 'navigate') {
              onNavigate(allMeetings.action.targetScreenId)
            }
          }}
          className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          {allMeetings.label}
        </button>
      </div>

      {note === null ? null : (
        <p role="status" className="pt-3 text-xs font-medium text-gray-500">
          {note}
        </p>
      )}

      <ul data-node-id={NODE.meetings} className="flex flex-col gap-3 pt-3">
        {rows.map((row) => (
          <li key={String(row.id)}>
            <button
              type="button"
              onClick={() => {
                if (meetings.itemAction?.type === 'pending') setNote(meetings.itemAction.note)
              }}
              aria-label={`${String(row.title)} ${meetings.itemAction?.label ?? ''}`}
              className="flex w-full items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left hover:bg-gray-50"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      STATE_CHIP[String(row.statusTone)] ?? NEUTRAL_CHIP
                    }`}
                  >
                    {String(row.status)}
                  </span>
                  <span className="text-[10px] font-medium text-gray-400">
                    {String(row.kindLabel)}
                  </span>
                </span>
                <span className="block pt-2 text-xs font-semibold text-gray-900">
                  {String(row.title)}
                </span>
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2.5 text-xs font-medium text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <FigmaAsset screenId={SCREEN} nodeId={ASSET.when} className="size-3" />
                    {String(row.startAt)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FigmaAsset screenId={SCREEN} nodeId={ASSET.where} className="size-3" />
                    {String(row.place)}
                  </span>
                  {/* 세는 말은 데이터가 갖고 온다 — 끝난 회의는 '참석'이다. */}
                  <span>{String(row.attendanceNote)}</span>
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
