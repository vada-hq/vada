import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FigmaAsset } from '../components/FigmaAsset'
import {
  BANNER_TEXT,
  BANNER_TONE,
  NEUTRAL_BORDER,
  NEUTRAL_CHIP,
  NEUTRAL_VALUE,
  STATE_CHIP,
  STATE_TEXT,
} from '../design/tones'
import {
  findDataSource,
  readFieldRows,
  readListSource,
  readObjectSourceOrNull,
} from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, elementByNodeId, opsMeet06a } from '../spec/screens'
import { columnFieldOf } from '../spec/types'
import type { ItemListSpec, SummarySpec } from '../spec/types'

// 정리 중 회의(OPS-MEET-06A).
//
// 회의가 끝났고 회의록은 아직 정리 중이다. **조작 단추가 하나도 없다** — 이 그림은
// 일반 참가자의 것이고, 고치는 쪽은 변형(06B 회의록 정리 — 진행 권한자)이 갖는다.
// 머리 오른쪽의 '읽기 전용'이 그 사실을 말한다.
//
// 상태 이름을 화면이 알지 않는다. '정리 중'도 '정리됨'도 '15:07 참석'도 서버가 글과
// 색 이름을 함께 준다(meeting.detail의 status·statusTone·viewerChipLabel,
// meeting.agendas의 status·statusTone).
//
// **명세가 침묵해서 이 화면이 그리지 않는 자리가 둘 있다.** 지어내지 않고 비워
// 두는 것이 이 저장소의 규칙이다(05A의 결정 딱지가 같은 자리다).
//
// 1. 머리 카드 오른쪽의 '참석 8명 · 불참 2명 · 안건 5개'(20:1616). meeting.detail은
//    이것을 `attendanceResultNote`('8명 참석 · 2명 불참')와 `agendaCountNote`
//    ('총 5개')로 **이미 이어서** 준다. 화면이 그 문장을 다시 쪼개 라벨과 값으로
//    나누면, 잇고 쪼개는 방법이 명세가 아니라 화면의 것이 된다.
// 2. 오른쪽 기둥의 '현재 정리 현황'(20:1676)은 이제 목록이다 — 한 건을 조회하고
//    그 안의 조각을 항목으로 받는다(itemList의 dataSourceKey + itemsField).
//
//    **출처가 minutesProgress가 아니다.** 한동안 둘을 하나로 보았는데, 그러면 같은
//    회의를 06A와 06B가 서로 다른 목록으로 그린 것이 설명되지 않는다 — 여기는
//    '안건 내용 2 / 3 정리'를, 06B는 '안건별 논의 내용 ✓'을 그린다. 라벨도 개수도
//    다르고, 한쪽은 세어 온 문구이고 한쪽은 참·거짓이다. 다른 사실이므로 출처도
//    다르다(meeting.minutesStatus).
//
// 요약 초안 카드의 노란 테두리(border-yellow-200 · 흰 바탕)는 design/tones.ts에
// 이름이 없어 여기 그대로 적는다 — 옅은 상자 표(SOFT_BOX)는 바탕까지 칠하고,
// 이 카드의 바탕은 희다. 확정된 결정의 초록 선(border-green-400)도 같은 처지다.

const SCREEN = 'OPS-MEET-06A'

const NODE = {
  viewerChip: '20:1584',
  banner: '20:1592',
  meeting: '20:1609',
  minutes: '20:1634',
  agendas: '20:1642',
  progress: '20:1673',
  decisions: '20:1697',
  attendanceNote: '20:1704',
} as const

// 어느 자리에 어떤 그림이 오는지는 명세가 아니라 design이 갖는다.
const ASSET = {
  viewerChip: '20:1585',
  banner: '20:1593',
} as const

// 경로 조각 사이의 화살표. 조각보다 하나 적다.
const BREADCRUMB_SEPARATORS = ['20:1573', '20:1578']

interface OPSMEET06AScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

function summaryAt(nodeId: string): SummarySpec {
  return elementByNodeId(opsMeet06a, nodeId).spec as SummarySpec
}

function listAt(nodeId: string): ItemListSpec {
  return elementByNodeId(opsMeet06a, nodeId).spec as ItemListSpec
}

function scalar(row: DataRow, field: string | undefined): string {
  const value = field === undefined ? undefined : row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`OPS-MEET-06A의 '${field}' 조각은 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

// 출처가 아직 없어 명세가 디자인의 글을 그대로 든 자리(summary.items[].value).
function drawnValue(spec: SummarySpec, at: number): string {
  return (spec.items ?? [])[at]?.value ?? ''
}

// 딱지 하나. 글도 색 이름도 데이터가 준다 — 명세는 어느 조각인지만 안다.
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

export function OPSMEET06AScreen({ screenParams, onNavigate }: OPSMEET06AScreenProps) {
  const viewerChip = summaryAt(NODE.viewerChip)
  const banner = summaryAt(NODE.banner)
  const meeting = summaryAt(NODE.meeting)
  const minutes = summaryAt(NODE.minutes)
  const agendas = listAt(NODE.agendas)
  const progress = listAt(NODE.progress)
  const progressField = (at: number) => columnFieldOf(progress, at)
  const decisions = listAt(NODE.decisions)
  const attendanceNote = summaryAt(NODE.attendanceNote)

  const meta = opsMeet06a.meta
  if (meta === undefined) {
    throw new Error('OPS-MEET-06A의 화면 카피가 없습니다.')
  }

  // 무엇의 상세인지 모르면 상세가 없다. 인자가 비면 묻지도 않는다.
  const missingParam = (opsMeet06a.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )
  const detail =
    missingParam === undefined
      ? readObjectSourceOrNull(
          banner.dataSourceKey,
          resolveParams(banner.params, { screenParams }),
        )
      : null

  if (missingParam !== undefined || detail === null) {
    return (
      <AppShell
        screenId={opsMeet06a.screenId}
        activeNavigationScreenId={opsMeet06a.activeNavigationScreenId}
        eyebrow={meta.eyebrow}
        title={meta.title}
        description={meta.description}
        footerNote={meta.footerNote}
        onNavigate={onNavigate}
      >
        <p role="alert" className="text-sm text-red-700">
          {missingParam !== undefined
            ? missingParam.missingNote
            : findDataSource(banner.dataSourceKey).messages.empty}
        </p>
      </AppShell>
    )
  }

  // 전체 요약은 없을 수 있다 — 06B가 빈 상태를 그렸고 '요약이 없어도 정리 완료가
  // 막히지는 않습니다'라고 적어 두었다. 없으면 출처가 그 자리에 할 말을 갖는다.
  const minutesRow = readObjectSourceOrNull(
    minutes.dataSourceKey,
    resolveParams(minutes.params, { screenParams }),
  )
  const agendaRows = readListSource(
    agendas.dataSourceKey,
    resolveParams(agendas.params, { screenParams }),
  )
  // 확정된 결정은 안건에 붙는다. 아직 결정이 없는 안건은 그 조각이 오지 않으므로
  // 이 목록에도 오지 않는다 — 화면이 '없음'을 지어내지 않는다.
  const decisionRows = readListSource(
    decisions.dataSourceKey,
    resolveParams(decisions.params, { screenParams }),
  ).filter((row) => String(row[decisions.columns?.[0]?.fields?.[0] ?? ''] ?? '') !== '')

  const bannerTone = scalar(detail, banner.toneField)
  const minutesTone =
    minutesRow === null ? '' : scalar(minutesRow, minutes.status?.[0]?.toneField)
  const meetingItem = (at: number) => (meeting.items ?? [])[at]?.field
  const agendaField = (at: number) => agendas.columns?.[at]?.fields?.[0]
  const decisionField = decisions.columns?.[0]?.fields?.[0]

  const breadcrumb = opsMeet06a.breadcrumb

  return (
    <AppShell
      screenId={opsMeet06a.screenId}
      activeNavigationScreenId={opsMeet06a.activeNavigationScreenId}
      eyebrow={meta.eyebrow}
      title={drawnTitleOf(opsMeet06a, screenParams)}
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
      // 머리 오른쪽은 한 자리다. 여기서는 이 화면이 읽기만 하는 자리라는 표시가
      // 오고, 06B에서는 같은 자리에 '정리 완료'가 온다. 그 말을 담을 조각이
      // meeting.detail에 아직 없어 명세가 디자인의 글을 그대로 들고 있다.
      headerAction={
        <span
          data-node-id={NODE.viewerChip}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.viewerChip} className="size-3.5" />
          {drawnValue(viewerChip, 0)}
        </span>
      }
      onNavigate={onNavigate}
    >
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 pb-8">
        {/* 상태 띠. 제목도 본문도 색 이름도 서버가 준다 — 회의 상태는 조직 운영에
            따라 늘 수 있어서, 화면이 목록을 들고 있으면 늘 때마다 틀린다.
            딱지가 둘인 것은 서로 다른 사실 둘이기 때문이다: 회의가 어디까지
            왔는가(status)와 이 사람이 참석했는가(viewerChipLabel). */}
        <section
          data-node-id={NODE.banner}
          data-design-rule="state-banner"
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
            BANNER_TONE[bannerTone] ?? NEUTRAL_BORDER
          }`}
        >
          <FigmaAsset
            screenId={SCREEN}
            nodeId={ASSET.banner}
            className="mt-0.5 size-4 shrink-0"
          />
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

        {/* 회의 한 건. 실제 진행 시각과 장소는 서버가 각각 완성해 보내고 화면은
            가운뎃점으로 잇기만 한다 — 값마다 제 요소를 갖는다. */}
        <section className="rounded-xl border border-gray-200 bg-white px-5 py-5">
          <div data-node-id={NODE.meeting}>
            <span className="block text-xs font-semibold text-blue-600">
              {scalar(detail, meeting.eyebrowField)}
            </span>
            <span className="block pt-1 text-lg font-bold text-gray-900">
              {scalar(detail, meeting.titleField)}
            </span>
            <span className="block pt-2 text-xs text-gray-500">
              <span>{scalar(detail, meetingItem(0))}</span>
              <span>{' · '}</span>
              <span>{scalar(detail, meetingItem(1))}</span>
            </span>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
          <div className="flex flex-col gap-4">
            {/* 전체 요약 초안. 아직 확정된 글이 아니라는 것도 서버가 말한다
                (meeting.minutes의 statusLabel·statusTone). */}
            <section
              data-node-id={NODE.minutes}
              className="rounded-xl border border-yellow-200 bg-white px-5 py-5"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="text-sm font-bold text-gray-900">{minutes.title}</span>
                {minutesRow === null ? null : (
                  <span
                    className={`shrink-0 text-xs font-medium ${
                      STATE_TEXT[minutesTone] ?? NEUTRAL_VALUE
                    }`}
                  >
                    {scalar(minutesRow, minutes.status?.[0]?.field)}
                  </span>
                )}
              </div>
              <p className="pt-3 text-sm text-gray-700">
                {minutesRow === null
                  ? findDataSource(minutes.dataSourceKey).messages.empty
                  : scalar(minutesRow, (minutes.items ?? [])[0]?.field)}
              </p>
            </section>

            {/* 안건은 단계마다 갖는 것이 다르다. 정리 중에는 정리 상태와 한 줄
                요약이 오고, 논의 내용과 결정 편집은 06B의 것이다. */}
            {agendaRows.length === 0 ? (
              <p data-node-id={NODE.agendas} className="text-xs text-gray-400">
                {findDataSource(agendas.dataSourceKey).messages.empty}
              </p>
            ) : (
              agendaRows.map((row, at) => (
                <section
                  key={String(row.agendaId)}
                  // 되풀이되는 자리는 첫 것의 nodeId를 본으로 쓴다.
                  data-node-id={at === 0 ? NODE.agendas : undefined}
                  className="rounded-xl border border-gray-200 bg-white px-5 py-4"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-bold text-gray-600">
                      {scalar(row, agendaField(0))}
                    </span>
                    <span className="text-xs font-bold text-gray-800">
                      {scalar(row, agendaField(1))}
                    </span>
                    <Chip
                      label={scalar(row, agendaField(2))}
                      tone={scalar(row, agendas.columns?.[2]?.toneField)}
                    />
                  </span>
                  <span className="block pt-3 text-xs text-gray-600">
                    {scalar(row, agendaField(3))}
                  </span>
                </section>
              ))
            )}
          </div>

          <div className="flex flex-col gap-4">
            {/* 정리 현황. **몇 부분인지도 어디까지 왔는지도 서버가 말한다** —
                회의록이 몇 부분으로 이루어지는지는 조직의 양식이 정하고, 세는 단위가
                부분마다 달라(개·건·초안) 화면이 규칙을 가질 수 없다. */}
            <section
              data-node-id={NODE.progress}
              className="rounded-xl border border-gray-200 bg-white px-5 py-4"
            >
              <span className="text-sm font-bold text-gray-800">{progress.title}</span>
              <ul className="flex flex-col gap-2 pt-3">
                {readFieldRows(
                  progress.dataSourceKey,
                  progress.itemsField,
                  resolveParams(progress.params, { screenParams }),
                ).map((part, at) => (
                  <li key={at} className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {scalar(part, progressField(0))}
                    </span>
                    <span className="text-xs font-semibold text-gray-800">
                      {scalar(part, progressField(1))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* 확정된 결정. 회의가 아니라 안건에 붙는 것이라 안건에서 읽는다. */}
            <section
              data-node-id={NODE.decisions}
              className="rounded-xl border border-gray-200 bg-white px-5 py-4"
            >
              <span className="block text-sm font-bold text-gray-800">{decisions.title}</span>
              <ul className="pt-3">
                {decisionRows.length === 0 ? (
                  <li className="text-xs text-gray-400">
                    {findDataSource(decisions.dataSourceKey).messages.empty}
                  </li>
                ) : (
                  decisionRows.map((row) => (
                    <li
                      key={String(row.agendaId)}
                      className="border-l-4 border-green-400 py-1 pl-3 text-xs text-gray-700"
                    >
                      {scalar(row, decisionField)}
                    </li>
                  ))
                )}
              </ul>
            </section>

            {/* 참석 기록이 이미 확정되었다는 안내. 이 화면을 여는 것이 참석으로
                기록되지 않는다는 03A의 말과 짝이다. */}
            <p
              data-node-id={NODE.attendanceNote}
              data-design-rule="state-banner"
              className={`rounded-xl border px-4 py-3 text-xs ${
                BANNER_TONE.blue ?? NEUTRAL_BORDER
              } ${BANNER_TEXT.blue?.note ?? NEUTRAL_VALUE}`}
            >
              {drawnValue(attendanceNote, 0)}
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
