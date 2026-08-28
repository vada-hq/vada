import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FigmaAsset } from '../components/FigmaAsset'
import {
  BANNER_TEXT,
  BANNER_TONE,
  NEUTRAL_BORDER,
  NEUTRAL_CHIP,
  NEUTRAL_VALUE,
  SOFT_BOX,
  SOFT_BOX_TEXT,
  STATE_CHIP,
} from '../design/tones'
import { findDataSource, readListSource, readObjectSourceOrNull } from '../data-sources/catalog'
import type { DataRow, DataValue } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { elementByNodeId, opsMeet07, opsMeet08 } from '../spec/screens'
import { useSubmitAction } from '../spec/useSubmitAction'
import type { ButtonSpec, ItemListSpec, SubmitAction, SummarySpec } from '../spec/types'

// 완료된 회의록(OPS-MEET-07).
//
// 이 그림도 보는 사람에 따라 갈린다(07 참석자 · 08 불참자). 주소는 하나이므로
// 여기서 그리는 것은 둘이 함께 갖는 자리뿐이다 — '회의 요약 확인 완료'와 '나에게
// 배정된 후속 업무' 카드는 08 명세에 있고 아직 구현에 없다.
//
// **상태 이름도 참석 딱지도 이 파일에 없다.** '완료'도 '15:07 참석'도 '불참'도
// 서버가 글과 색 이름을 함께 준다. 참석 딱지는 시각까지 붙어서 오는데(catalog의
// attendanceLabel), 화면이 시각과 상태를 이으면 잇는 방법이 명세의 일이 된다.
//
// 띠의 색도 데이터가 준다(stateBannerTone). 07은 초록이고 08은 주황인데, 같은
// 자리에 상태가 둘이므로 코드에 색을 박으면 둘 중 하나는 반드시 틀린다.
//
// 받아 가는 것(회의록 내보내기·자료 줄의 내려받기)은 pending이 아니라 download다.
// pending은 '아직 안 정했다'는 뜻인데 여기는 정해져 있다 — 그렇게 적으면 조용한
// 대체가 된다. 다만 이 저장소에는 파일을 건네줄 곳이 아직 없으므로 어느 파일인지만
// 드러낸다: 조용히 아무 일도 안 하면 아무도 모른다.
//
// **머리 카드의 '참석 3명'·'불참 1명' 타일은 그리지 않는다.** 카탈로그에 두 수를
// 따로 담는 조각이 없다(attendanceResultNote는 '3명 참석 · 1명 불참'을 한 줄로
// 이어 온다). 명세가 가리키지 못하는 값을 화면이 지어내거나 스스로 세면 그것은
// 디자인에 없는 사실이 된다 — 05A가 결정 딱지에서 한 것과 같은 태도다.

const SCREEN = 'OPS-MEET-07'

const NODE = {
  export: '20:2188',
  banner: '20:2197',
  head: '20:2213',
  decisionTile: '20:2231',
  followUpTile: '20:2236',
  minutes: '20:2243',
  agendas: '20:2248',
  followUpHeader: '20:2286',
  followUps: '20:2291',
  people: '20:2293',
  documents: '20:2317',
  documentDownload: '20:2330',
} as const

// 어느 자리에 어떤 그림이 오는지는 명세가 아니라 design이 갖는다. 되풀이되는
// 자리는 첫 것의 nodeId를 본으로 쓴다.
const ASSET = {
  export: '20:2189',
  banner: '20:2198',
  document: '20:2322',
  download: '20:2330',
} as const

// 경로 조각 사이의 화살표. 조각보다 하나 적다.
const BREADCRUMB_SEPARATORS = ['20:2177', '20:2182']

// 회의에 참석하지 않은 사람이 보는 같은 회의록(변형 OPS-MEET-08).
//
// **다른 화면이 아니라 다른 사람이 본 같은 화면이다** — 명세가 그렇게 말한다
// (meeting.detail의 viewerChipLabel이 불참으로 온다). 이 저장소에는 로그인한 사람이
// 없어 어느 그림을 열었는지가 그 자리를 대신하고, 조건의 이름은 명세에 남아 있다.
//
// 자리가 둘이다. 머리의 '회의록 내보내기'가 '회의 요약 확인 완료'로 바뀌고, 오른쪽
// 기둥에 '나에게 배정된 후속 업무'가 한 칸 더 붙는다.
const ABSENTEE = {
  screen: 'OPS-MEET-08',
  acknowledge: { node: '20:2449', asset: '20:2450' },
  myFollowUpHeader: '20:2553',
  myFollowUps: '20:2558',
} as const

interface OPSMEET07ScreenProps {
  screenParams: Record<string, string>
  /** 어느 그림을 그리는지. 변형은 주소가 같고 보는 사람이 가른다. */
  screenId?: string
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

function summaryAt(nodeId: string): SummarySpec {
  return elementByNodeId(opsMeet07, nodeId).spec as SummarySpec
}

function listAt(nodeId: string): ItemListSpec {
  return elementByNodeId(opsMeet07, nodeId).spec as ItemListSpec
}

function scalar(row: DataRow, field: string | undefined): string {
  const value: DataValue | undefined = field === undefined ? undefined : row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`OPS-MEET-07의 '${field}' 조각은 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

// 딱지 하나. 글도 색 이름도 데이터가 준다 — 명세는 어느 조각인지만 안다.
// 조각이 오지 않는 상태에서는 딱지 자체가 없다(catalog의 '없으면 오지 않는다').
function Chip({ label, tone }: { label: string; tone: string }) {
  if (label === '') {
    return null
  }
  return (
    <span
      data-design-state
      data-design-rule="state-chip"
      className={`rounded px-2 py-0.5 text-xs font-medium ${STATE_CHIP[tone] ?? NEUTRAL_CHIP}`}
    >
      {label}
    </span>
  )
}

// 개수만 다른 요약 딱지. 상태 딱지와 달리 데이터가 색 이름을 주지 않는다 —
// 무엇이냐가 아니라 몇이냐를 말하는 자리라 언제나 같은 무채색이다.
function CountChip({ label }: { label: string }) {
  if (label === '') {
    return null
  }
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATE_CHIP.gray}`}>{label}</span>
  )
}

// 머리 카드 오른쪽의 값 타일. 라벨은 명세가, 값은 데이터가 갖는다.
function StatCell({ nodeId, label, value }: { nodeId: string; label: string; value: string }) {
  return (
    <span data-node-id={nodeId} className="block text-right">
      <span className="block text-xs text-gray-400">{label}</span>
      <span className="block pt-1 text-sm font-bold text-gray-800">{value}</span>
    </span>
  )
}

export function OPSMEET07Screen({
  screenParams,
  screenId = SCREEN,
  onNavigate,
}: OPSMEET07ScreenProps) {
  const absent = screenId === ABSENTEE.screen
  const submitAction = useSubmitAction()
  const [note, setNote] = useState<string | null>(null)

  const exportButton = elementByNodeId(opsMeet07, NODE.export).spec as ButtonSpec
  const banner = summaryAt(NODE.banner)
  const head = summaryAt(NODE.head)
  const decisionTile = summaryAt(NODE.decisionTile)
  const followUpTile = summaryAt(NODE.followUpTile)
  const minutes = summaryAt(NODE.minutes)
  const agendas = listAt(NODE.agendas)
  const followUpHeader = summaryAt(NODE.followUpHeader)
  const followUps = listAt(NODE.followUps)
  const people = listAt(NODE.people)
  const documents = listAt(NODE.documents)
  const documentDownload = documents.itemFields?.[0]?.spec as ButtonSpec | undefined

  // 변형이 더하는 것들. 바탕에서는 셋 다 없다.
  const acknowledge = absent
    ? (elementByNodeId(opsMeet08, ABSENTEE.acknowledge.node).spec as ButtonSpec)
    : null
  const myFollowUpHeader = absent
    ? (elementByNodeId(opsMeet08, ABSENTEE.myFollowUpHeader).spec as SummarySpec)
    : null
  const myFollowUps = absent
    ? (elementByNodeId(opsMeet08, ABSENTEE.myFollowUps).spec as ItemListSpec)
    : null

  // **제목이 그림마다 다르다.** 참석한 사람은 '완료된 회의록'을, 참석하지 않은
  // 사람은 '회의 요약 확인'을 본다 — 같은 회의록이지만 그 사람에게 남은 일이
  // 다르기 때문이다. 그래서 카피도 그 그림의 것을 읽는다.
  const meta = (absent ? opsMeet08 : opsMeet07).meta
  if (meta === undefined) {
    throw new Error(`${screenId}의 화면 카피가 없습니다.`)
  }

  // 무엇의 회의록인지 모르면 회의록이 없다. 인자가 비면 묻지도 않는다 — 인자가
  // 없는 채로 물으면 출처가 첫 줄을 집어 와 남의 회의록을 자기 것으로 읽는다.
  const missingParam = (opsMeet07.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )
  const query = resolveParams(banner.params, { screenParams })
  const detail =
    missingParam === undefined ? readObjectSourceOrNull(banner.dataSourceKey ?? '', query) : null

  if (missingParam !== undefined || detail === null) {
    return (
      <AppShell
        screenId={opsMeet07.screenId}
        activeNavigationScreenId={opsMeet07.activeNavigationScreenId}
        eyebrow={meta.eyebrow}
        title={meta.title}
        description={meta.description}
        footerNote={meta.footerNote}
        onNavigate={onNavigate}
      >
        <p role="alert" className="text-sm text-red-700">
          {missingParam !== undefined
            ? missingParam.missingNote
            : findDataSource(banner.dataSourceKey ?? '').messages.empty}
        </p>
      </AppShell>
    )
  }

  // 전체 요약은 없을 수 있다 — 06B가 빈 상태를 그렸고 '요약이 없어도 정리 완료가
  // 막히지는 않습니다'라고 적어 두었다.
  const minutesRow = readObjectSourceOrNull(
    minutes.dataSourceKey ?? '',
    resolveParams(minutes.params, { screenParams }),
  )
  const agendaRows = readListSource(
    agendas.dataSourceKey ?? '',
    resolveParams(agendas.params, { screenParams }),
  )
  const followUpRows = readListSource(
    followUps.dataSourceKey ?? '',
    resolveParams(followUps.params, { screenParams }),
  )
  // 같은 출처를 '내 것만'으로 한 번 더 묻는다 — 그 인자는 명세가 들고 있다
  // (params의 onlyMine). 화면이 걸러 내면 무엇으로 거르는지가 화면의 것이 된다.
  const myFollowUpRows =
    myFollowUps === null
      ? []
      : readListSource(
          myFollowUps.dataSourceKey ?? '',
          resolveParams(myFollowUps.params, { screenParams }),
        )
  const peopleRows = readListSource(
    people.dataSourceKey ?? '',
    resolveParams(people.params, { screenParams }),
  )
  const documentRows = readListSource(
    documents.dataSourceKey ?? '',
    resolveParams(documents.params, { screenParams }),
  )

  const bannerTone = scalar(detail, banner.toneField)
  const headItem = (at: number) => (head.items ?? [])[at]?.field
  const agendaField = (at: number) => agendas.columns?.[at]?.fields?.[0]
  const personField = (at: number) => people.columns?.[at]?.fields?.[0]
  const followUpField = (at: number) => followUps.columns?.[at]?.fields?.[0]

  // 받아 가는 것은 서버의 파일이다. 명세가 아는 것은 '어느 파일인가'까지이고,
  // 어떻게 건네는지는 플랫폼의 답이다 — 여기서는 어느 파일인지만 드러낸다.
  const download = (spec: ButtonSpec | undefined, row: DataRow) => () => {
    if (spec === undefined || spec.action.type !== 'download') {
      return
    }
    setNote(`${spec.label}: ${scalar(row, spec.action.downloadField)}`)
  }

  // 후속 업무 항목을 누르면 어디로 가는지 그림이 말하지 않는다. 지어낸 화면으로
  // 데려가는 대신 무엇이 정해지지 않았는지를 드러낸다.
  const pressFollowUp = () => {
    const action = followUps.itemAction
    if (action?.type === 'pending') {
      setNote(action.note)
    }
  }

  const breadcrumb = opsMeet07.breadcrumb

  return (
    <AppShell
      screenId={opsMeet07.screenId}
      activeNavigationScreenId={opsMeet07.activeNavigationScreenId}
      eyebrow={meta.eyebrow}
      title={meta.title}
      description={meta.description}
      footerNote={meta.footerNote}
      breadcrumb={
        breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={BREADCRUMB_SEPARATORS}
            items={breadcrumb.items.map((item) =>
              item.field === undefined ? (item.value ?? '') : scalar(detail, item.field),
            )}
          />
        )
      }
      // 머리 오른쪽은 한 자리다. 여기서는 회의록을 받아 가는 단추가 오고,
      // 08에서는 같은 자리에 '회의 요약 확인 완료'가 온다.
      headerAction={
        // 머리 오른쪽은 **한 자리**다. 참석한 사람에게는 회의록을 받는 단추가,
        // 참석하지 않은 사람에게는 요약을 확인했다고 알리는 단추가 온다.
        acknowledge === null ? (
          <button
            type="button"
            data-node-id={NODE.export}
            onClick={download(exportButton, detail)}
            className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.export} className="size-3.5" />
            {exportButton.label}
          </button>
        ) : (
          <button
            type="button"
            data-node-id={ABSENTEE.acknowledge.node}
            disabled={acknowledge.initiallyDisabled}
            onClick={() => {
              void submitAction.run(acknowledge.action as SubmitAction, {
                payload: { meetingId: screenParams.meetingId ?? '' },
                onNavigate,
              })
            }}
            className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            <FigmaAsset
              screenId={ABSENTEE.screen}
              nodeId={ABSENTEE.acknowledge.asset}
              className="size-3.5"
            />
            {submitAction.labelOf(acknowledge.action as SubmitAction, acknowledge.label)}
          </button>
        )
      }
      onNavigate={onNavigate}
    >
      <div className="mx-auto flex w-full max-w-[1010px] flex-col gap-4 pb-8">
        {/* 보내고 나면 어디로 가는지가 아직 정해지지 않았다고 명세가 적어 두었다.
            조용히 아무 일도 안 하는 대신 그 사실을 내놓는다. */}
        {submitAction.pendingNote === null ? null : (
          <p
            role="status"
            className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-xs text-yellow-800"
          >
            {submitAction.pendingNote}
          </p>
        )}
        {submitAction.errorMessage === null ? null : (
          <p role="alert" className="text-xs font-medium text-red-500">
            {submitAction.errorMessage}
          </p>
        )}
        {note === null ? null : (
          <p
            role="status"
            className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-xs text-yellow-800"
          >
            {note}
          </p>
        )}

        {/* 상태 띠 20:2197. 딱지가 둘이다 — 회의록의 상태('완료')와 보는 사람의
            참석 기록('15:07 참석')은 다른 사실이고, 개수는 명세가 안다. 08에서는
            회의록 상태 딱지가 오지 않아 하나만 그려진다. */}
        <section
          data-node-id={NODE.banner}
          data-design-rule="state-banner"
          className={`flex items-start gap-2.5 rounded-xl border p-5 ${
            BANNER_TONE[bannerTone] ?? NEUTRAL_BORDER
          }`}
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.banner} className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span
                data-design-rule="state-banner"
                className={`text-xs font-bold ${BANNER_TEXT[bannerTone]?.title ?? NEUTRAL_VALUE}`}
              >
                {scalar(detail, banner.titleField)}
              </span>
              {(banner.status ?? []).map((chip) => (
                <Chip
                  key={chip.field}
                  label={scalar(detail, chip.field)}
                  tone={scalar(detail, chip.toneField)}
                />
              ))}
            </span>
            <span
              data-design-rule="state-banner"
              className={`block pt-1.5 text-xs ${BANNER_TEXT[bannerTone]?.note ?? NEUTRAL_VALUE}`}
            >
              {scalar(detail, banner.descriptionField)}
            </span>
          </span>
        </section>

        {/* 회의 머리 20:2213 + 값 타일 20:2231·20:2236. */}
        <section className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white px-6 py-5">
          <div data-node-id={NODE.head} className="min-w-0">
            <span className="block text-xs font-semibold text-blue-600">
              {scalar(detail, head.eyebrowField)}
            </span>
            <h2 className="pt-1 text-lg font-bold text-gray-900">
              {scalar(detail, head.titleField)}
            </h2>
            {/* 실제 진행 시각과 장소는 각각 제 조각이다. 한 덩이로 그리면 대조가
                어느 값이 어긋났는지 짚지 못한다. */}
            <span className="block pt-2 text-xs text-gray-500">
              <span>{scalar(detail, headItem(0))}</span>
              <span> · </span>
              <span>{scalar(detail, headItem(1))}</span>
            </span>
          </div>
          <div className="flex shrink-0 items-start gap-6">
            <StatCell
              nodeId={NODE.decisionTile}
              label={(decisionTile.items ?? [])[0]?.label ?? ''}
              value={scalar(detail, (decisionTile.items ?? [])[0]?.field)}
            />
            <StatCell
              nodeId={NODE.followUpTile}
              label={(followUpTile.items ?? [])[0]?.label ?? ''}
              value={scalar(detail, (followUpTile.items ?? [])[0]?.field)}
            />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.8fr_1fr]">
          <div className="flex flex-col gap-4">
            {/* 회의 전체 요약 20:2243. 안건마다의 기록과 다른 물건이라 출처도 다르다. */}
            <section
              data-node-id={NODE.minutes}
              className="rounded-xl border border-gray-200 bg-white px-5 py-5"
            >
              <h2 className="text-sm font-bold text-gray-900">{minutes.title}</h2>
              <p className="pt-3 text-xs leading-6 text-gray-700">
                {minutesRow === null
                  ? findDataSource(minutes.dataSourceKey ?? '').messages.empty
                  : scalar(minutesRow, (minutes.items ?? [])[0]?.field)}
              </p>
            </section>

            {/* 안건 20:2248. 끝난 회의의 안건이 갖는 것은 순서·제목·본문·확정된
                결정뿐이다 — 진행 중에 있던 상태와 예상 소요는 오지 않는다.
                되풀이되는 자리는 첫 것의 nodeId를 본으로 쓴다. */}
            {agendaRows.length === 0 ? (
              <p
                data-node-id={NODE.agendas}
                className="rounded-xl border border-gray-200 bg-white px-5 py-5 text-xs text-gray-500"
              >
                {findDataSource(agendas.dataSourceKey ?? '').messages.empty}
              </p>
            ) : (
              agendaRows.map((row, at) => {
                const decision = String(row[agendaField(3) ?? ''] ?? '')
                return (
                  <section
                    key={String(row.agendaId)}
                    data-node-id={at === 0 ? NODE.agendas : undefined}
                    className="rounded-xl border border-gray-200 bg-white px-5 py-5"
                  >
                    <span className="flex items-center gap-2">
                      <span className="inline-flex size-5 items-center justify-center rounded bg-gray-100 text-xs font-bold text-gray-600">
                        {scalar(row, agendaField(0))}
                      </span>
                      <span className="text-xs font-bold text-gray-800">
                        {scalar(row, agendaField(1))}
                      </span>
                    </span>
                    <span className="block pt-3 text-xs leading-5 text-gray-600">
                      {scalar(row, agendaField(2))}
                    </span>
                    {/* 확정된 결정은 없으면 오지 않는다. 오지 않은 자리에 '아직
                        없습니다'를 그리면 그것은 디자인에 없는 카피가 된다. */}
                    {decision === '' ? null : (
                      <span
                        data-design-rule="soft-box"
                        className={`mt-4 block rounded-lg border px-3 py-3 ${SOFT_BOX.green}`}
                      >
                        <span
                          className={`block text-xs font-semibold ${SOFT_BOX_TEXT.green.label}`}
                        >
                          {agendas.columns?.[3]?.label}
                        </span>
                        <span
                          data-design-rule="soft-box-value"
                          className={`block pt-1 text-xs ${SOFT_BOX_TEXT.green.value}`}
                        >
                          {decision}
                        </span>
                      </span>
                    )}
                  </section>
                )
              })
            )}
          </div>

          <div className="flex flex-col gap-4">
            {/* 후속 업무 20:2286·20:2291. 와이어프레임은 0건 빈 상태만 그렸다 —
                항목이 어떻게 생겼는지도, 눌러서 어디로 가는지도 그림에 없다. */}
            <section className="rounded-xl border border-gray-200 bg-white px-5 py-4">
              <div
                data-node-id={NODE.followUpHeader}
                className="flex items-center justify-between gap-2"
              >
                <h3 className="text-xs font-bold text-gray-800">{followUpHeader.title}</h3>
                <CountChip label={scalar(detail, (followUpHeader.items ?? [])[0]?.field)} />
              </div>
              <ul data-node-id={NODE.followUps} className="pt-3">
                {followUpRows.length === 0 ? (
                  <li className="text-xs leading-5 text-gray-500">
                    {findDataSource(followUps.dataSourceKey ?? '').messages.empty}
                  </li>
                ) : (
                  followUpRows.map((task) => (
                    <li key={String(task.taskId)} className="py-1.5">
                      <button
                        type="button"
                        onClick={pressFollowUp}
                        className="block w-full text-left"
                      >
                        <span className="block text-xs font-bold text-gray-800">
                          {scalar(task, followUpField(0))}
                        </span>
                        <span className="block pt-0.5 text-xs text-gray-500">
                          {scalar(task, followUpField(1))}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </section>

            {/* 참석하지 않은 사람에게만 한 칸 더 붙는다(20:2553). 몇 건인지는
                서버가 세고, 목록은 '내 것만'으로 걸러 온다. */}
            {myFollowUpHeader === null || myFollowUps === null ? null : (
              <section className="rounded-xl border border-gray-200 bg-white px-5 py-4">
                <div
                  data-node-id={ABSENTEE.myFollowUpHeader}
                  className="flex items-center justify-between gap-2"
                >
                  <h3 className="text-xs font-bold text-gray-900">{myFollowUpHeader.title}</h3>
                  <CountChip label={scalar(detail, (myFollowUpHeader.items ?? [])[0]?.field)} />
                </div>
                <ul data-node-id={ABSENTEE.myFollowUps} className="pt-3">
                  {myFollowUpRows.length === 0 ? (
                    <li className="text-xs leading-5 text-gray-500">
                      {findDataSource(myFollowUps.dataSourceKey ?? '').messages.empty}
                    </li>
                  ) : (
                    myFollowUpRows.map((task) => (
                      <li key={String(task.taskId)} className="py-1.5">
                        <span className="block text-xs font-bold text-gray-800">
                          {scalar(task, myFollowUps.columns?.[0]?.fields?.[0])}
                        </span>
                        <span className="block pt-0.5 text-xs text-gray-500">
                          {scalar(task, myFollowUps.columns?.[1]?.fields?.[0])}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            )}

            {/* 참석 결과 20:2293. 딱지의 글은 시각까지 붙어서 온다 — '15:00 참석'을
                화면이 시각과 상태로 이으면 잇는 방법이 명세의 일이 된다. */}
            <section
              data-node-id={NODE.people}
              className="rounded-xl border border-gray-200 bg-white px-5 py-4"
            >
              <h3 className="text-xs font-bold text-gray-800">{people.title}</h3>
              <ul className="pt-2">
                {peopleRows.length === 0 ? (
                  <li className="py-2 text-xs text-gray-500">
                    {findDataSource(people.dataSourceKey ?? '').messages.empty}
                  </li>
                ) : (
                  peopleRows.map((person) => (
                    <li
                      key={String(person.memberId)}
                      className="flex items-center justify-between gap-2 py-1.5"
                    >
                      <span className="min-w-0 text-xs text-gray-700">
                        {scalar(person, personField(0))}
                      </span>
                      <Chip
                        label={scalar(person, personField(1))}
                        tone={scalar(person, people.columns?.[1]?.toneField)}
                      />
                    </li>
                  ))
                )}
              </ul>
            </section>

            {/* 관련 자료 20:2317. 안건의 사전 자료와 같은 물건이고, 줄 끝의 그림이
                받아 가는 자리다. 파일 이름은 제 요소를 갖는다 — 옆의 조작과 한
                덩이로 잡히면 대조가 그 글을 찾지 못한다(05A에서 실제로 그랬다). */}
            <section
              data-node-id={NODE.documents}
              className="rounded-xl border border-gray-200 bg-white px-5 py-4"
            >
              <h3 className="text-xs font-bold text-gray-800">{documents.title}</h3>
              <ul className="pt-2">
                {documentRows.length === 0 ? (
                  <li className="py-2 text-xs text-gray-500">
                    {findDataSource(documents.dataSourceKey ?? '').messages.empty}
                  </li>
                ) : (
                  documentRows.map((file, at) => (
                    <li
                      key={String(file.documentId)}
                      className="flex items-center gap-2 py-1.5"
                    >
                      <FigmaAsset
                        screenId={SCREEN}
                        nodeId={ASSET.document}
                        className="size-3.5 shrink-0"
                      />
                      <span className="min-w-0 flex-1 text-xs text-gray-600">
                        {scalar(file, documents.columns?.[0]?.fields?.[0])}
                      </span>
                      <button
                        type="button"
                        // 되풀이되는 자리는 첫 것의 nodeId를 본으로 쓴다.
                        data-node-id={at === 0 ? NODE.documentDownload : undefined}
                        aria-label={documentDownload?.label}
                        onClick={download(documentDownload, file)}
                        className="shrink-0"
                      >
                        <FigmaAsset
                          screenId={SCREEN}
                          nodeId={ASSET.download}
                          className="size-3.5"
                        />
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
