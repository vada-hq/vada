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
} from '../design/tones'
import { findDataSource, readListSource, readObjectSourceOrNull } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, elementByNodeId, opsMeet03a, opsMeet03b, opsMeet03c } from '../spec/screens'
import type { ButtonSpec, ItemListSpec, SummarySpec } from '../spec/types'

// 예정 회의 상세(OPS-MEET-03A).
//
// 이 그림은 **보는 사람에 따라 셋으로 갈린다**(03A 일반 참가자 · 03B 생성자 ·
// 03C 진행 권한자). 사람이 그 사이를 오갈 수 없으므로 화면이 아니라 변형이고
// 주소는 하나다. 여기서 그리는 것은 셋이 함께 갖는 자리뿐이며, 머리의 '회의
// 시작·수정'과 '진행 권한 관리'는 03B·03C 명세에 있고 아직 구현에 없다.
//
// **상태 이름도 역할 이름도 이 파일에 없다.** '예정'도 '진행 권한'도 서버가 글과
// 색 이름을 함께 준다 — 역할이 하나 늘 때 화면이 조용히 틀리지 않는 유일한 모양이다.
//
// 다만 **띠의 색은 명세가 가리킬 자리가 없어** design이 그린 그대로 파랗게 그린다.
// meeting.detail은 stateBannerTone을 갖는데 summary에는 그 이름을 담을 칸이 없다
// (OPS-MEET-09가 같은 자리에서 같은 말을 남겼다).

const SCREEN = 'OPS-MEET-03A'

const NODE = {
  viewerChip: '18:2871',
  roleNotice: '18:2879',
  meeting: '18:2889',
  facts: '18:2914',
  stateBanner: '18:2955',
  agendaHeader: '18:2967',
  agendas: '18:2975',
  documents: '18:2987',
  peopleHeader: '18:3035',
  people: '18:3040',
} as const

// 어느 자리에 어떤 그림이 오는지는 명세가 아니라 design이 갖는다. 되풀이되는
// 자리는 첫 것의 nodeId를 본으로 쓴다 — 같은 그림이면 하나만 그려도 대조가 붙는다.
const ASSET = {
  viewerChip: '18:2872',
  roleNotice: '18:2880',
  event: '18:2902',
  facts: ['18:2917', '18:2928', '18:2937', '18:2946'],
  stateBanner: '18:2956',
  document: '18:2988',
  person: '18:3042',
} as const

// 경로 조각 사이의 화살표. 조각보다 하나 적다.
const BREADCRUMB_SEPARATORS = ['18:2860', '18:2865']

// 보는 사람이 이 회의와 어떤 사이인지에 따라 자리 셋이 달라진다.
//
// **다른 화면이 아니라 다른 사람이 본 같은 화면이다** — 명세가 그렇게 말한다
// (meeting.detail의 canEdit·canCancel·canManageHostRole·canStart). 이 저장소에는
// 로그인한 사람이 없어 어느 그림을 열었는지가 그 자리를 대신하고, 가르는 조건의
// 이름은 명세에 남아 있다.
//
// 셋 다 **자리는 하나이고 무엇이 오는지가 다르다**. 03A는 딱지, 03C는 단추 하나,
// 03B는 단추 둘이 머리에 온다.
const VARIANTS = {
  'OPS-MEET-03B': {
    header: [
      { node: '20:92', asset: '20:93', look: 'secondary' },
      { node: '20:97', asset: '20:98', look: 'primary' },
    ],
    banner: { node: '20:187', asset: null, look: 'quiet' },
    people: { node: '20:264', asset: '20:265', look: 'secondary' },
  },
  'OPS-MEET-03C': {
    header: [{ node: '20:417', asset: '20:418', look: 'primary' }],
    banner: null,
    // 단추가 아니라 읽기만 한다는 표시다. 그래서 명세도 button이 아니라 summary다.
    people: { node: '20:581', asset: '20:582', look: 'readonly' },
  },
} as const

// 그림이 그린 세 벌. 굵기는 셋 다 500이고 크기는 10.5px(text-xs)다.
const BUTTON_LOOK: Record<string, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
  quiet: 'text-red-600 hover:underline',
}

interface OPSMEET03AScreenProps {
  screenParams: Record<string, string>
  /** 어느 그림을 그리는지. 변형은 주소가 같고 보는 사람이 가른다. */
  screenId?: string
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

type VariantSlot = { node: string; asset: string | null; look: string }

function summaryAt(nodeId: string): SummarySpec {
  return elementByNodeId(opsMeet03a, nodeId).spec as SummarySpec
}

function listAt(nodeId: string): ItemListSpec {
  return elementByNodeId(opsMeet03a, nodeId).spec as ItemListSpec
}

// 변형이 그 자리에 두는 단추 하나. 어디로 가는지도 무슨 글인지도 명세가 말한다.
function VariantButton({
  screenId,
  slot,
  screenParams,
  onNavigate,
}: {
  screenId: string
  slot: VariantSlot
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}) {
  const spec = elementByNodeId(specOfVariant(screenId), slot.node).spec as ButtonSpec
  return (
    <button
      type="button"
      data-node-id={slot.node}
      disabled={spec.initiallyDisabled}
      onClick={() => {
        if (spec.action.type === 'navigate') {
          onNavigate(spec.action.targetScreenId, resolveParams(spec.action.params, { screenParams }))
        }
      }}
      className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none ${
        BUTTON_LOOK[slot.look] ?? ''
      }`}
    >
      {slot.asset === null ? null : (
        <FigmaAsset screenId={screenId} nodeId={slot.asset} className="size-3.5" />
      )}
      {spec.label}
    </button>
  )
}

// 읽기만 한다는 표시(03C). 단추가 아니라 글이므로 명세도 summary다.
function ReadOnlyMark({
  screenId,
  slot,
}: {
  screenId: string
  slot: VariantSlot
}) {
  const spec = elementByNodeId(specOfVariant(screenId), slot.node).spec as SummarySpec
  return (
    <span
      data-node-id={slot.node}
      className="flex items-center gap-1.5 text-xs font-normal text-gray-400"
    >
      {slot.asset === null ? null : (
        <FigmaAsset screenId={screenId} nodeId={slot.asset} className="size-3.5" />
      )}
      {spec.title}
    </span>
  )
}

function specOfVariant(screenId: string) {
  return screenId === 'OPS-MEET-03B' ? opsMeet03b : opsMeet03c
}

function scalar(row: DataRow, field: string | undefined): string {
  const value = field === undefined ? undefined : row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`OPS-MEET-03A의 '${field}' 조각은 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

// 딱지 하나. 글도 색 이름도 데이터가 준다 — 명세는 어느 조각인지만 안다.
// 와이어프레임은 한 상태만 그리므로 색은 대조에서 뺀다(data-design-state).
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

export function OPSMEET03AScreen({
  screenParams,
  screenId = SCREEN,
  onNavigate,
}: OPSMEET03AScreenProps) {
  // 셋 중 어느 그림인지. 03A는 변형이 아니라 바탕이므로 null이다.
  const variant: (typeof VARIANTS)[keyof typeof VARIANTS] | null =
    screenId === 'OPS-MEET-03B'
      ? VARIANTS['OPS-MEET-03B']
      : screenId === 'OPS-MEET-03C'
        ? VARIANTS['OPS-MEET-03C']
        : null
  const viewerChip = summaryAt(NODE.viewerChip)
  const roleNotice = summaryAt(NODE.roleNotice)
  const meeting = summaryAt(NODE.meeting)
  const facts = summaryAt(NODE.facts)
  const stateBanner = summaryAt(NODE.stateBanner)
  const agendaHeader = summaryAt(NODE.agendaHeader)
  const agendas = listAt(NODE.agendas)
  const documents = listAt(NODE.documents)
  const peopleHeader = summaryAt(NODE.peopleHeader)
  const people = listAt(NODE.people)

  const meta = opsMeet03a.meta
  if (meta === undefined) {
    throw new Error('OPS-MEET-03A의 화면 카피가 없습니다.')
  }

  // 무엇의 상세인지 모르면 상세가 없다. 인자가 비면 묻지도 않는다 — 출처가 첫
  // 줄을 집어 오게 되면 사람이 남의 회의를 자기 것으로 읽는다.
  const missingParam = (opsMeet03a.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )
  const detail =
    missingParam === undefined
      ? readObjectSourceOrNull(
          meeting.dataSourceKey,
          resolveParams(meeting.params, { screenParams }),
        )
      : null

  // 띠의 색 이름은 명세가 가리킨 조각에서 온다. 상태가 색을 정하는데 상태는
  // 조직이 늘릴 수 있어서, 화면이 목록을 들고 있으면 늘 때마다 틀린다.
  const bannerTone = detail === null ? '' : scalar(detail, stateBanner.toneField ?? '')

  if (missingParam !== undefined || detail === null) {
    return (
      <AppShell
        screenId={opsMeet03a.screenId}
        activeNavigationScreenId={opsMeet03a.activeNavigationScreenId}
        eyebrow={meta.eyebrow}
        title={meta.title}
        description={meta.description}
        footerNote={meta.footerNote}
        onNavigate={onNavigate}
      >
        <p role="alert" className="text-sm text-red-700">
          {missingParam !== undefined
            ? missingParam.missingNote
            : findDataSource(meeting.dataSourceKey).messages.empty}
        </p>
      </AppShell>
    )
  }

  const agendaRows = readListSource(
    agendas.dataSourceKey,
    resolveParams(agendas.params, { screenParams }),
  )
  // 자료는 회의에 한 번 붙어 오고, 어느 안건의 것인지는 그 조각(agendaId)이 안다.
  // 안건마다 다시 물으면 같은 답을 안건 수만큼 받는다 — 카탈로그가 이 조각을 둔
  // 이유가 그것이다.
  const documentRows = readListSource(
    documents.dataSourceKey,
    resolveParams(documents.params, { screenParams }),
  )
  const peopleRows = readListSource(
    people.dataSourceKey,
    resolveParams(people.params, { screenParams }),
  )

  const breadcrumb = opsMeet03a.breadcrumb
  const agendaField = (at: number) => agendas.columns?.[at]?.fields?.[0]
  const personField = (at: number) => people.columns?.[at]?.fields?.[0]
  const documentField = documents.columns?.[0]?.fields?.[0]
  const meetingItem = (at: number) => (meeting.items ?? [])[at]
  // 딱지는 한 조각 안에 여럿으로 온다. 없으면 오지 않으므로 빈 목록으로 읽는다.
  const chipsOf = (person: DataRow): DataRow[] => {
    const value = person[personField(1) ?? '']
    return Array.isArray(value) ? value : []
  }

  return (
    <AppShell
      screenId={opsMeet03a.screenId}
      activeNavigationScreenId={opsMeet03a.activeNavigationScreenId}
      eyebrow={meta.eyebrow}
      title={drawnTitleOf(opsMeet03a, screenParams)}
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
      // 머리 오른쪽은 **한 자리**다. 여기서는 보는 사람과 이 회의의 관계를 말하는
      // 딱지가 오고, 03B·03C에서는 같은 자리에 단추가 온다 — 딱지든 단추든 무엇이
      // 오는지는 서버가 정한다(meeting.detail의 viewerChipLabel·canStart).
      headerAction={
        variant === null ? (
          <span
            data-node-id={NODE.viewerChip}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.viewerChip} className="size-3.5" />
            {scalar(detail, viewerChip.titleField)}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            {variant.header.map((slot) => (
              <VariantButton
                key={slot.node}
                screenId={screenId}
                slot={slot}
                screenParams={screenParams}
                onNavigate={onNavigate}
              />
            ))}
          </span>
        )
      }
      onNavigate={onNavigate}
    >
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4 pb-8">
        {/* 이 자리에서 무엇을 할 수 있는지. 누가 보느냐는 서버만 알므로 제목도
            설명도 서버가 준다(meeting.attention의 같은 이름과 같은 계급이다). */}
        <section
          data-node-id={NODE.roleNotice}
          className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.roleNotice} className="size-8 shrink-0" />
          <span className="min-w-0">
            <span className="block text-xs font-bold text-gray-800">
              {scalar(detail, roleNotice.titleField)}
            </span>
            <span className="block pt-0.5 text-xs font-normal text-gray-500">
              {scalar(detail, roleNotice.descriptionField)}
            </span>
          </span>
        </section>

        {/* 회의 한 건. 딱지가 둘이고 **개수가 데이터에 달렸다** — 분류가 없는
            회의에는 두 번째가 오지 않는다. */}
        <section
          data-node-id={NODE.meeting}
          className="flex items-start justify-between gap-6 rounded-xl border border-gray-200 bg-white px-5 py-4"
        >
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              {(meeting.status ?? []).map((badge) => (
                <Chip
                  key={badge.field}
                  label={scalar(detail, badge.field)}
                  tone={scalar(detail, badge.toneField)}
                />
              ))}
            </span>
            <span className="block pt-2.5 text-base font-bold text-gray-900">
              {scalar(detail, meeting.titleField)}
            </span>
            <span className="block pt-1.5 text-xs font-normal text-gray-500">
              {scalar(detail, meeting.descriptionField)}
            </span>
            {/* 딸린 행사를 알리는 자리. design은 이것을 링크로 그렸지만 그 행사로
                넘길 인자(eventId)를 이동에 실을 길이 아직 계약에 없다 — 명세가
                가리키는 것은 이 조각을 그리라는 것까지다. */}
            <span className="flex items-center gap-1.5 pt-3 text-xs font-normal text-blue-600">
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.event} className="size-3.5" />
              {scalar(detail, meetingItem(0)?.field)}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-xs font-normal text-gray-400">
              {meetingItem(1)?.label}
            </span>
            <span className="block pt-1 text-xs font-bold text-gray-800">
              {scalar(detail, meetingItem(1)?.field)}
            </span>
            <span className="block pt-2.5 text-xs font-normal text-gray-400">
              {scalar(detail, meetingItem(2)?.field)}
            </span>
          </span>
        </section>

        {/* 항목이 명세에 고정이라 summary다 — 예정 회의가 갖는 사실은 넷으로 정해져 있다. */}
        <div data-node-id={NODE.facts} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(facts.items ?? []).map((item, at) => (
            <span
              key={item.field}
              className="block rounded-xl border border-gray-200 bg-white px-4 py-3"
            >
              <span className="flex items-center gap-1.5">
                <FigmaAsset screenId={SCREEN} nodeId={ASSET.facts[at]} className="size-3.5" />
                <span className="text-xs font-semibold text-gray-400">{item.label}</span>
              </span>
              <span className="block pt-2 text-sm font-bold text-gray-800">
                {scalar(detail, item.field)}
              </span>
            </span>
          ))}
        </div>

        {/* 상태 띠. 제목도 본문도 **상태와 보는 사람 둘 다**에 매인 값이라 서버가 준다. */}
        <section
          data-node-id={NODE.stateBanner}
          data-design-rule="state-banner"
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
            BANNER_TONE[bannerTone] ?? NEUTRAL_BORDER
          }`}
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.stateBanner} className="mt-0.5 size-4" />
          <span className="min-w-0">
            <span
              className={`block text-xs font-semibold ${
                BANNER_TEXT[bannerTone]?.title ?? NEUTRAL_VALUE
              }`}
            >
              {scalar(detail, stateBanner.titleField)}
            </span>
            <span
              className={`block pt-1 text-xs font-normal ${
                BANNER_TEXT[bannerTone]?.note ?? NEUTRAL_VALUE
              }`}
            >
              {scalar(detail, stateBanner.descriptionField)}
            </span>
          </span>
          {/* 이 회의를 만든 사람에게만 띠 안에 취소가 온다(03B). */}
          {variant?.banner === undefined || variant?.banner === null ? null : (
            <span className="ml-auto shrink-0">
              <VariantButton
                screenId={screenId}
                slot={variant.banner}
                screenParams={screenParams}
                onNavigate={onNavigate}
              />
            </span>
          )}
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
          <section className="rounded-xl border border-gray-200 bg-white">
            {/* 안건 수와 자료 수는 안건 목록이 아니라 회의가 안다 — 목록이 쪽으로
                나뉘어도 그 수는 변하지 않기 때문이다. */}
            <div
              data-node-id={NODE.agendaHeader}
              className="flex items-end justify-between gap-4 border-b border-gray-100 px-5 py-4"
            >
              <span className="min-w-0">
                <span className="block text-sm font-bold text-gray-900">
                  {agendaHeader.title}
                </span>
                <span className="block pt-1 text-xs font-normal text-gray-400">
                  {scalar(detail, (agendaHeader.items ?? [])[0]?.field)}
                </span>
              </span>
              <span className="shrink-0 text-xs font-normal text-gray-400">
                {scalar(detail, (agendaHeader.items ?? [])[1]?.field)}
              </span>
            </div>

            <ul data-node-id={NODE.agendas}>
              {agendaRows.length === 0 ? (
                <li className="px-5 py-4 text-xs font-normal text-gray-400">
                  {findDataSource(agendas.dataSourceKey).messages.empty}
                </li>
              ) : (
                agendaRows.map((agenda, at) => (
                  <li
                    key={String(agenda.agendaId)}
                    className={`flex gap-3 px-5 py-4 ${
                      at === agendaRows.length - 1 ? '' : 'border-b border-gray-100'
                    }`}
                  >
                    {/* 몇 번째인지는 명세에 없다 — 이 목록에서의 자리가 곧 순서다
                        (OPS-MEET-01A의 '총 N건'과 같은 규칙). 서버의 orderLabel은
                        '안건 1'처럼 이름까지 붙은 다른 글이라 이 자리에 오지 않는다. */}
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-600">
                      {at + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-bold text-gray-800">
                          {scalar(agenda, agendaField(0))}
                        </span>
                        <span className="shrink-0 text-xs font-normal text-gray-400">
                          {scalar(agenda, agendaField(1))}
                        </span>
                      </span>
                      <span className="block pt-1 text-xs font-normal text-gray-500">
                        {scalar(agenda, agendaField(2))}
                      </span>
                      {/* 되풀이되는 자리는 첫 것의 nodeId를 본으로 쓴다. */}
                      <span
                        data-node-id={at === 0 ? NODE.documents : undefined}
                        className="block"
                      >
                        {documentRows
                          .filter((file) => file.agendaId === agenda.agendaId)
                          .map((file) => (
                            <span
                              key={String(file.documentId)}
                              className="flex items-center gap-1.5 pt-2 text-xs font-normal text-blue-600"
                            >
                              <FigmaAsset
                                screenId={SCREEN}
                                nodeId={ASSET.document}
                                className="size-3.5"
                              />
                              {scalar(file, documentField)}
                            </span>
                          ))}
                      </span>
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white">
            <div
              data-node-id={NODE.peopleHeader}
              className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4"
            >
              <span>
                <span className="block text-sm font-bold text-gray-900">{peopleHeader.title}</span>
                <span className="block pt-1 text-xs font-normal text-gray-400">
                  {scalar(detail, (peopleHeader.items ?? [])[0]?.field)}
                </span>
              </span>
              {/* 권한을 옮길 수 있는 사람에게는 단추가, 진행만 하는 사람에게는
                  읽기만 한다는 표시가 온다. 일반 참가자에게는 둘 다 없다. */}
              {variant === null ? null : variant.people.look === 'readonly' ? (
                <ReadOnlyMark screenId={screenId} slot={variant.people} />
              ) : (
                <VariantButton
                  screenId={screenId}
                  slot={variant.people}
                  screenParams={screenParams}
                  onNavigate={onNavigate}
                />
              )}
            </div>

            <ul data-node-id={NODE.people}>
              {peopleRows.length === 0 ? (
                <li className="px-5 py-4 text-xs font-normal text-gray-400">
                  {findDataSource(people.dataSourceKey).messages.empty}
                </li>
              ) : (
                peopleRows.map((person, at) => (
                  <li
                    key={String(person.memberId)}
                    className={`flex items-center gap-3 px-5 py-3 ${
                      at === peopleRows.length - 1 ? '' : 'border-b border-gray-100'
                    }`}
                  >
                    <FigmaAsset
                      screenId={SCREEN}
                      nodeId={ASSET.person}
                      className="size-7 shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-semibold text-gray-800">
                          {scalar(person, personField(0))}
                        </span>
                        {/* 한 사람에 딱지가 여럿일 수 있다 — 생성자는 '회의 생성자'와
                            '진행 권한'을 함께 단다. 개수도 글도 색도 데이터가 준다. */}
                        {chipsOf(person).map((one, index) => (
                          <Chip
                            key={`${String(person.memberId)}-${index}`}
                            label={String(one.label ?? '')}
                            tone={String(one.tone ?? '')}
                          />
                        ))}
                      </span>
                      <span className="block pt-0.5 text-xs font-normal text-gray-400">
                        {scalar(person, personField(2))}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-normal text-gray-400">
                      {scalar(person, personField(3))}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      </div>
    </AppShell>
  )
}
