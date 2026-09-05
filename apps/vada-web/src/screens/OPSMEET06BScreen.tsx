import { useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Built } from '../components/Built'
import { NotBuiltYet } from '../data-sources/server'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FigmaAsset } from '../components/FigmaAsset'
import { BANNER_TEXT, BANNER_TONE, NEUTRAL_BORDER, NEUTRAL_CHIP, NEUTRAL_VALUE, STATE_CHIP } from '../design/tones'
import {
  findDataSource,
  readFieldRows,
  readListSource,
  readObjectSourceOrNull,
} from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { fetchOptions, getOptionSource } from '../option-sources/catalog'
import type { Option } from '../option-sources/catalog'
import { resolveParams } from '../spec/params'
import { elementByNodeId, opsMeet06a, opsMeet06b } from '../spec/screens'
import { columnFieldOf } from '../spec/types'
import type { ButtonSpec, InputSpec, ItemListSpec, SelectSpec, SubmitAction, SummarySpec } from '../spec/types'
import { useFieldDraft } from '../spec/useFieldDraft'
import { useSubmitAction } from '../spec/useSubmitAction'
import type { ScopeDraft } from '../state/scopes'

// 회의록 정리 — 진행 권한자(OPS-MEET-06B).
//
// **06A와 같은 화면이고 보는 사람이 다르다**(meeting.detail의 canEditMinutes).
// 그런데 06A가 읽기만 하는 것과 달리 여기는 고쳐 쓰는 자리라, 왼쪽 기둥의 안건 카드가
// 한 줄 요약 대신 논의 내용과 결정을 통째로 펴고 오른쪽 기둥이 통째로 바뀐다. 다른
// 변형들처럼 바탕 화면에 갈래를 넣기에는 겹치는 자리가 너무 적어 파일을 따로 둔다.
//
// **띠는 06A의 것을 읽는다.** 변형은 '다른 부분만' 등록하므로 띠의 명세는 바탕이
// 갖고 있다 — 여기서 다시 적으면 두 벌이 되고 하나가 늦게 고쳐진다.
//
// **그림이 그린 회의가 06A와 다르다.** 와이어프레임이 두 프레임을 서로 다른 회의로
// 그렸고(06A는 신입생 환영 행사, 여기는 체육대회), 명세의 params.example이 어느
// 것인지 말한다.
//
// 명세가 침묵해서 이 화면이 스스로 아는 것이 둘이다.
//   1. 정리 완료 조건의 그림. 찬 것은 초록 체크, 안 찬 것은 주황, 없어도 되는 것은
//      회색이다 — 어느 그림인지를 가리킬 자리가 명세에 없다(EXT-01B의 iconName과
//      같은 구멍). done·optional은 카탈로그가 갖고 있으므로 그것을 읽는다.
//   2. 고른 안건이 없을 때. 그림은 셋째 안건이 골라진 상태만 그렸고, 아무것도
//      고르지 않았을 때 오른쪽 아래가 어떻게 되는지 그리지 않았다.

const SCREEN = 'OPS-MEET-06B'
const BASE = 'OPS-MEET-06A'

const NODE = {
  blockedNote: '20:1802',
  complete: '20:1804',
  facts: '20:1824',
  summaryHeader: '20:1849',
  aiDisclaimer: '20:1858',
  generate: '20:1861',
  writeByHand: '20:1869',
  agendas: '20:1877',
  agendaFollowUps: '20:1904',
  panelHeader: '20:1995',
  picker: '20:2000',
  panel: '20:2016',
  progressHeader: '20:2055',
  conditions: '20:2060',
} as const

// 바탕 화면이 갖는 자리. 띠는 06A의 것이다.
const BASE_NODE = { banner: '20:1592' } as const

const ASSET = {
  banner: '20:1812',
  complete: '20:1805',
  generate: '20:1862',
  followUp: '20:1908',
  linkTask: '20:2040',
  // 정리 완료 조건의 그림 셋. 같은 그림은 하나만 지목한다 — 대조가 내용으로 묶는다.
  conditionDone: '20:2062',
  conditionTodo: '20:2068',
  conditionOptional: '20:2090',
} as const

const BREADCRUMB_SEPARATORS = ['20:1785', '20:1790', '20:1795']

interface OPSMEET06BScreenProps {
  screenParams: Record<string, string>
  /** 명세가 stateScopeKey로 말한 자리(meetingMinutesDraft). */
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

function summaryAt(nodeId: string): SummarySpec {
  return elementByNodeId(opsMeet06b, nodeId).spec as SummarySpec
}

function listAt(nodeId: string): ItemListSpec {
  return elementByNodeId(opsMeet06b, nodeId).spec as ItemListSpec
}

function buttonAt(nodeId: string): ButtonSpec {
  return elementByNodeId(opsMeet06b, nodeId).spec as ButtonSpec
}

function scalar(row: DataRow, field: string | undefined): string {
  const value = field === undefined ? undefined : row[field]
  if (value === undefined || Array.isArray(value)) {
    return ''
  }
  return String(value)
}

// **자리마다 따로 두른다.** 정리 완료 조건(`meeting.minutesProgress`)과 안건 고르기
// (`meeting.agendaPicker`)는 저마다 제 부품으로 갈라 `Built`로 둘렀다 — 하나가 서버에서
// 안 오는 날 그 자리만 닫히고 나머지(띠·회의록 요약·안건·후속 업무)는 그대로 보인다.
// 지금은 다 붙어 있어 전부 열려 있다.
//
// **화면 안에서 읽어야 두를 수 있다.** 부모가 읽으면 그리기 전에 터지고, 그때는
// 바깥 그물(`SourceGate`)이 화면을 통째로 가린다.

/**
 * 머리 오른쪽의 '무엇이 남았는지'와 '정리 완료'.
 *
 * **무엇이 막는지는 서버가 말한다** — 화면이 세면 조직의 규칙이 화면에 적힌다.
 * 그래서 막혔는지를 모르는 동안에는 단추도 함께 가린다: 보낼 수 있는지 모르는 채로
 * 보내면 조용히 실패하거나 조용히 지나간다.
 */
function CompleteMinutesAction({
  screenParams,
  submitAction,
  onNavigate,
}: {
  screenParams: Record<string, string>
  submitAction: ReturnType<typeof useSubmitAction>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}) {
  const blockedNote = summaryAt(NODE.blockedNote)
  const complete = buttonAt(NODE.complete)
  const progress = readObjectSourceOrNull(
    blockedNote.dataSourceKey ?? '',
    resolveParams(blockedNote.params, { screenParams }),
  )

  return (
    <span className="flex items-center gap-3">
      <span data-node-id={NODE.blockedNote} className="text-xs text-orange-600">
        {progress === null ? '' : scalar(progress, (blockedNote.items ?? [])[0]?.field)}
      </span>
      <button
        type="button"
        data-node-id={NODE.complete}
        onClick={() => {
          const action = complete.action as SubmitAction
          if (
            action.executeWhen?.type === 'sourceAllows' &&
            progress !== null &&
            scalar(progress, action.executeWhen.blockedNoteField) !== ''
          ) {
            // 막혔다는 것을 서버가 이미 말했다. 그 글이 머리에 그려져 있으므로
            // 화면은 보내지 않기만 한다(onExecutionBlocked: showBlockedNote).
            return
          }
          void submitAction.run(action, {
            payload: { meetingId: screenParams.meetingId ?? '' },
            onNavigate,
          })
        }}
        className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.complete} className="size-3.5" />
        {submitAction.labelOf(complete.action as SubmitAction, complete.label)}
      </button>
    </span>
  )
}

/**
 * 무엇이 남았는지.
 *
 * **명세가 조건의 목록을 들지 않는다** — 무엇이 정리를 막는지는 조직의 규칙이
 * 정하고, 명세가 목록을 들면 규칙이 하나 늘 때마다 명세가 틀린다.
 */
function MinutesCompletionConditions({
  screenParams,
}: {
  screenParams: Record<string, string>
}) {
  const progressHeader = summaryAt(NODE.progressHeader)
  const conditions = listAt(NODE.conditions)
  const progress = readObjectSourceOrNull(
    progressHeader.dataSourceKey ?? '',
    resolveParams(progressHeader.params, { screenParams }),
  )
  const conditionRows = readFieldRows(
    conditions.dataSourceKey,
    conditions.itemsField,
    resolveParams(conditions.params, { screenParams }),
  )

  return (
    <section className="rounded-xl border border-gray-200 bg-white px-5 py-4">
      <div
        data-node-id={NODE.progressHeader}
        className="flex items-center justify-between gap-2"
      >
        <h3 className="text-xs font-bold text-gray-800">{progressHeader.title}</h3>
        <span className="text-xs font-semibold text-orange-600">
          {progress === null ? '' : scalar(progress, (progressHeader.items ?? [])[0]?.field)}
        </span>
      </div>
      <ul data-node-id={NODE.conditions} className="flex flex-col gap-2 pt-3">
        {conditionRows.map((row, at) => (
          <li
            key={at}
            className={`flex items-center gap-2 ${
              scalar(row, 'optional') === '' ? '' : 'rounded-lg border border-gray-100 px-2 py-1'
            }`}
          >
            <FigmaAsset
              screenId={SCREEN}
              nodeId={
                scalar(row, 'done') !== ''
                  ? ASSET.conditionDone
                  : scalar(row, 'optional') !== ''
                    ? ASSET.conditionOptional
                    : ASSET.conditionTodo
              }
              className="size-4"
            />
            <span className="text-xs font-normal text-gray-600">
              {scalar(row, columnFieldOf(conditions, 0))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * 어느 안건을 열지 고르는 묶음.
 *
 * `ChoiceGroup`과 같은 규칙으로 받아 오되 그 부품을 쓰지 않는다 — 선택지마다 곁에
 * 붙는 말('확인 필요')을 함께 그려야 해서다. 그래서 그 부품이 하는 셋을 여기서 한 번
 * 더 한다. **못 받은 것을 빈 목록으로 대신하지 않는다**: '고를 것이 없다'와 '못
 * 받았다'와 '아직 안 지었다'가 화면에서 똑같이 보이면 사람은 고를 것이 없는 줄 알고
 * 넘어간다. 아직 안 지은 것은 그물(`Built`)이 말하고 못 받은 것은 카탈로그의 글이
 * 말한다. 그리고 아무것도 안 골랐으면 **서버가 표시한 것을 연다**(initiallySelected).
 */
function AgendaPicker({
  picker,
  label,
  sourceParams,
  chosen,
  onSelect,
}: {
  picker: SelectSpec
  label: string | undefined
  sourceParams: Record<string, string>
  chosen: string | null
  onSelect: (option: Option) => void
}) {
  const source = getOptionSource(picker.optionsSource.key)
  const [options, setOptions] = useState<Option[]>(
    source.type === 'static' ? source.options : [],
  )
  const [failed, setFailed] = useState(false)
  const [notBuilt, setNotBuilt] = useState<NotBuiltYet | null>(null)
  const messages = source.type === 'remote' ? source.messages : null
  const paramsKey = JSON.stringify(sourceParams)

  // 펼친 형태라 목록이 처음부터 화면에 있어야 한다. 원격 출처는 즉시 불러온다.
  useEffect(() => {
    if (source.type === 'static') {
      return
    }
    let cancelled = false
    setFailed(false)
    setNotBuilt(null)
    fetchOptions(picker.optionsSource.key, JSON.parse(paramsKey) as Record<string, string>)
      .then((loaded) => {
        if (!cancelled) {
          setOptions(loaded)
        }
      })
      .catch((thrown: unknown) => {
        if (cancelled) return
        setOptions([])
        // **아직 안 지은 것은 실패가 아니다.** 그 말은 그물이 한다 — 여기서 '못 받았다'로
        // 바꿔 말하면 서버가 죽은 것과 구분이 안 된다.
        if (thrown instanceof NotBuiltYet) setNotBuilt(thrown)
        else setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [source.type, picker.optionsSource.key, paramsKey])

  // **아직 아무것도 고르지 않았으면 서버가 표시한 안건이 열린다.** 무엇이 열려
  // 있어야 하는지는 그 회의의 정리 상태가 정하고 그것은 서버만 안다. 사람이 한 번
  // 고르고 나면 다시 끼어들지 않는다.
  useEffect(() => {
    if (chosen !== null) {
      return
    }
    const marked = options.find((option) => option.initiallySelected === true)
    if (marked !== undefined) {
      onSelect(marked)
    }
    // onSelect는 그릴 때마다 새로 만들어진다. 보는 사실은 '목록이 왔는가'와
    // '아직 안 골랐는가' 둘뿐이다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, chosen])

  // 그물이 받을 수 있는 자리는 그리는 중이다. 효과 안에서 던지면 아무 데도 안 닿는다.
  if (notBuilt !== null) throw notBuilt

  // 못 받았으면 못 받았다고 한다. 카탈로그가 그 말을 갖고 있다.
  if (failed) {
    return (
      <div
        id={picker.fieldKey}
        data-node-id={NODE.picker}
        data-design-state="error"
        className="border-b border-gray-100 px-5 py-4 text-xs text-red-600"
      >
        {messages?.error}
      </div>
    )
  }

  return (
    <div
      id={picker.fieldKey}
      role="radiogroup"
      aria-label={label}
      data-node-id={NODE.picker}
      className="flex flex-col gap-2 border-b border-gray-100 px-5 py-4"
    >
      {options.map((option) => {
        const selected = option.value === chosen
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(option)}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left ${
              selected ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
            }`}
          >
            <span
              className={`text-xs font-bold ${selected ? 'text-blue-600' : 'text-gray-500'}`}
            >
              {option.label}
            </span>
            <span className="text-xs font-medium text-orange-600">{option.description}</span>
          </button>
        )
      })}
    </div>
  )
}

export function OPSMEET06BScreen({
  screenParams,
  draft,
  onChangeDraft,
  onNavigate,
}: OPSMEET06BScreenProps) {
  const submitAction = useSubmitAction()
  // 눌러 갈 곳이 아직 없는 자리가 둘 있다('직접 작성'·'업무 연결'). 조용히 아무
  // 일도 안 하는 대신 명세가 적어 둔 까닭을 내놓는다.
  const [note, setNote] = useState<string | null>(null)
  const field = useFieldDraft({
    elements: opsMeet06b.elements,
    draft,
    onChangeDraft,
    screenParams,
  })

  const banner = elementByNodeId(opsMeet06a, BASE_NODE.banner).spec as SummarySpec
  const facts = summaryAt(NODE.facts)
  const summaryHeader = summaryAt(NODE.summaryHeader)
  const aiDisclaimer = summaryAt(NODE.aiDisclaimer)
  const generate = buttonAt(NODE.generate)
  const writeByHand = buttonAt(NODE.writeByHand)
  const agendas = listAt(NODE.agendas)
  const agendaFollowUps = listAt(NODE.agendaFollowUps)
  const panelHeader = summaryAt(NODE.panelHeader)
  const picker = elementByNodeId(opsMeet06b, NODE.picker).spec as SelectSpec
  const panel = listAt(NODE.panel)

  const meta = opsMeet06b.meta
  if (meta === undefined) {
    throw new Error('OPS-MEET-06B의 화면 카피가 없습니다.')
  }

  // 무엇을 정리하는지 모르면 정리할 것이 없다. 인자가 비면 묻지도 않는다.
  const missingParam = (opsMeet06b.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )
  const query = resolveParams(banner.params, { screenParams })
  const detail =
    missingParam === undefined ? readObjectSourceOrNull(banner.dataSourceKey ?? '', query) : null

  if (missingParam !== undefined || detail === null) {
    return (
      <AppShell
        screenId={opsMeet06b.screenId}
        activeNavigationScreenId={opsMeet06a.activeNavigationScreenId}
        eyebrow={meta.eyebrow}
        title={meta.title}
        onNavigate={onNavigate}
      >
        <p role="alert" className="text-sm text-gray-500">
          {missingParam !== undefined
            ? missingParam.missingNote
            : findDataSource(banner.dataSourceKey).messages.empty}
        </p>
      </AppShell>
    )
  }

  const agendaRows = readListSource(
    agendas.dataSourceKey,
    resolveParams(agendas.params, { screenParams }),
  )
  const followUpRows = readListSource(
    agendaFollowUps.dataSourceKey,
    resolveParams(agendaFollowUps.params, { screenParams }),
  )
  const minutesRow = readObjectSourceOrNull(
    aiDisclaimer.dataSourceKey ?? '',
    resolveParams(aiDisclaimer.params, { screenParams }),
  )

  const chosen = draft.values[picker.fieldKey] ?? null
  // 목록을 받아 오고 처음 열 것을 여는 일은 `AgendaPicker`가 한다. 여기는 무엇을
  // 골랐는지만 안다 — 오른쪽 아래가 그 값으로 그려진다.
  const pickerParams = field.resolveSourceParams(picker)
  const openValue = chosen
  const chosenAgenda = agendaRows.find((row) => scalar(row, 'agendaId') === openValue)

  const bannerTone = scalar(detail, banner.toneField)
  const agendaField = (at: number) => columnFieldOf(agendas, at)
  const panelField = (at: number) => columnFieldOf(panel, at)
  const followUpField = (at: number) => columnFieldOf(agendaFollowUps, at)

  // 되풀이되는 칸의 값은 '묶음이름.항목id.칸이름'으로 담긴다(spec/compute의 규칙).
  const itemKeyOf = (agendaId: string, fieldKey: string) =>
    `${panel.fieldKey ?? ''}.${agendaId}.${fieldKey}`

  const decisionInput = (panel.itemFields ?? [])[0]?.spec as InputSpec | undefined
  const noDecision = (panel.itemFields ?? [])[1]?.spec as InputSpec | undefined
  const panelFollowUps = (panel.itemFields ?? [])[2]?.spec as ItemListSpec | undefined
  const linkTask = (panel.itemFields ?? [])[3]?.spec as ButtonSpec | undefined
  const noFollowUp = (panel.itemFields ?? [])[4]?.spec as InputSpec | undefined

  const breadcrumb = opsMeet06b.breadcrumb

  return (
    <AppShell
      screenId={opsMeet06b.screenId}
      activeNavigationScreenId={opsMeet06a.activeNavigationScreenId}
      eyebrow={meta.eyebrow}
      title={meta.title}
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
      // 머리 오른쪽은 한 자리다. 06A에서는 '읽기 전용'이 오고 여기서는 무엇이
      // 남았는지와 '정리 완료'가 온다. **무엇이 막는지는 서버가 말한다** —
      // 화면이 세면 조직의 규칙이 화면에 적힌다. 그 자리가 안 오면 **그 자리만** 가린다.
      headerAction={
        <Built what="정리 완료">
          <CompleteMinutesAction
            screenParams={screenParams}
            submitAction={submitAction}
            onNavigate={onNavigate}
          />
        </Built>
      }
      onNavigate={onNavigate}
    >
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 pb-8">
        {/* **보냈는데 실패하면 말한다.** 아무 말도 안 하면 눌린 것인지 아닌지 사람이
            모른다 — 오늘 배포에서 겪은 '가짜 성공'의 다른 얼굴이다. 글은 갈고리가 고른다. */}
        {submitAction.errorMessage === null ? null : (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            {submitAction.errorMessage}
          </p>
        )}
        {submitAction.pendingNote === null ? null : (
          <p
            role="status"
            className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-xs text-yellow-800"
          >
            {submitAction.pendingNote}
          </p>
        )}

        {/* 상태 띠. 06A의 명세를 그대로 읽는다 — 변형은 다른 부분만 갖는다. */}
        <section
          data-design-rule="state-banner"
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${
            BANNER_TONE[bannerTone] ?? NEUTRAL_BORDER
          }`}
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.banner} className="mt-0.5 size-4" />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span
                className={`text-xs font-bold ${BANNER_TEXT[bannerTone]?.title ?? NEUTRAL_VALUE}`}
              >
                {scalar(detail, banner.titleField)}
              </span>
              {(banner.status ?? []).map((badge) => (
                <span
                  key={badge.field}
                  data-design-state
                  data-design-rule="state-chip"
                  className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                    STATE_CHIP[scalar(detail, badge.toneField)] ?? NEUTRAL_CHIP
                  }`}
                >
                  {scalar(detail, badge.field)}
                </span>
              ))}
            </span>
            <span
              className={`block pt-1 text-xs font-normal ${
                BANNER_TEXT[bannerTone]?.note ?? NEUTRAL_VALUE
              }`}
            >
              {scalar(detail, banner.descriptionField)}
            </span>
          </span>
        </section>

        {/* 회의가 어떻게 열렸고 어떻게 닫혔는지 넷. 값은 전부 완성된 글로 온다. */}
        <div data-node-id={NODE.facts} className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(facts.items ?? []).map((item) => (
            <span key={item.field} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <span className="block text-xs font-normal text-gray-400">{item.label}</span>
              <span className="block pt-1 text-xs font-bold text-gray-800">
                {scalar(detail, item.field)}
              </span>
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-4">
            {/* 전체 요약. **아직 없는 상태만 그려져 있다** — 요약이 있을 때 이 카드가
                어떻게 생기는지는 그림이 말하지 않는다. */}
            <section className="rounded-xl border border-gray-200 bg-white px-5 py-4">
              <div data-node-id={NODE.summaryHeader}>
                <h2 className="text-sm font-bold text-gray-900">{summaryHeader.title}</h2>
                <p className="pt-1 text-xs font-normal text-gray-400">
                  {summaryHeader.description}
                </p>
              </div>

              <div className="mt-4 rounded-lg border border-gray-300 px-4 py-4">
                <p className="text-xs font-semibold text-gray-700">
                  {minutesRow === null ? '' : scalar(minutesRow, 'summaryText')}
                </p>
                {/* 줄바꿈은 글 안에 있다 — 몇 줄로 그릴지는 표현이라 명세가 정하지 않는다. */}
                <p
                  data-node-id={NODE.aiDisclaimer}
                  className="whitespace-pre-line pt-2 text-xs font-normal text-gray-400"
                >
                  {minutesRow === null
                    ? ''
                    : scalar(minutesRow, (aiDisclaimer.items ?? [])[0]?.field)}
                </p>
                <div className="flex items-center gap-3 pt-3">
                  <button
                    type="button"
                    data-node-id={NODE.generate}
                    onClick={() => {
                      void submitAction.run(generate.action as SubmitAction, {
                        payload: { meetingId: screenParams.meetingId ?? '' },
                        onNavigate,
                      })
                    }}
                    className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    <FigmaAsset screenId={SCREEN} nodeId={ASSET.generate} className="size-3.5" />
                    {submitAction.labelOf(generate.action as SubmitAction, generate.label)}
                  </button>
                  <button
                    type="button"
                    data-node-id={NODE.writeByHand}
                    onClick={() => {
                      if (writeByHand.action.type === 'pending') {
                        setNote(writeByHand.action.note)
                      }
                    }}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    {writeByHand.label}
                  </button>
                </div>
              </div>
            </section>

            {note === null ? null : (
              <p role="status" className="text-xs font-medium text-gray-500">
                {note}
              </p>
            )}

            {/* 안건마다 한 장. **논의 내용과 결정을 통째로 편다** — 06A는 같은 자리에
                한 줄 요약만 그린다. 되풀이되는 자리는 첫 것의 nodeId를 본으로 쓴다. */}
            {agendaRows.map((row, at) => (
              <section
                key={scalar(row, 'agendaId')}
                data-node-id={at === 0 ? NODE.agendas : undefined}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
                <div className="flex items-start justify-between gap-4 border-b border-gray-100 bg-gray-50 px-5 py-4">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-blue-600">
                        {scalar(row, agendaField(0))}
                      </span>
                      <span
                        data-design-state
                        data-design-rule="state-chip"
                        className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                          STATE_CHIP[scalar(row, agendas.columns?.[1]?.toneField)] ?? NEUTRAL_CHIP
                        }`}
                      >
                        {scalar(row, agendaField(1))}
                      </span>
                    </span>
                    <span className="block pt-2 text-sm font-bold text-gray-900">
                      {scalar(row, agendaField(3))}
                    </span>
                    <span className="block pt-1 text-xs font-normal text-gray-500">
                      {scalar(row, agendaField(4))}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-normal text-gray-400">
                    {scalar(row, agendaField(2))}
                  </span>
                </div>

                <div className="px-5 py-4">
                  <p className="text-xs font-bold text-gray-400">
                    {agendas.columns?.[5]?.label}
                  </p>
                  <p className="pt-2 text-xs font-normal text-gray-700">
                    {scalar(row, agendaField(5))}
                  </p>

                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <p className="text-xs font-bold text-gray-400">
                      {agendas.columns?.[6]?.label}
                    </p>
                    {/* 결정이 있으면 초록 상자로, 없으면 없다는 말로. **없다는 말도
                        서버가 준다** — 무엇을 하라고 이르는 문장이라 조직의 것이다. */}
                    {scalar(row, agendaField(6)) === '' ? (
                      <p className="pt-2 text-xs font-normal text-orange-600">
                        {scalar(row, agendas.columns?.[6]?.fields?.[1])}
                      </p>
                    ) : (
                      <p className="mt-2 rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-xs font-semibold text-green-900">
                        {scalar(row, agendaField(6))}
                      </p>
                    )}
                  </div>

                  {/* 후속 업무. **어느 안건의 것인지를 말하는 조각이 없어** 회의의
                      것을 그대로 그린다(design/deviations.ts에 그 사실이 있다). */}
                  <div
                    data-node-id={at === 0 ? NODE.agendaFollowUps : undefined}
                    className="mt-4 border-t border-gray-100 pt-4"
                  >
                    <p className="text-xs font-bold text-gray-400">{agendaFollowUps.title}</p>
                    <ul className="pt-2">
                      {followUpRows.length === 0 ? (
                        <li className="text-xs font-normal text-gray-400">
                          {findDataSource(agendaFollowUps.dataSourceKey).messages.empty}
                        </li>
                      ) : (
                        followUpRows.map((task) => (
                          <li
                            key={String(task.taskId)}
                            className="flex items-start gap-2 py-1.5"
                          >
                            <FigmaAsset
                              screenId={SCREEN}
                              nodeId={ASSET.followUp}
                              className="mt-0.5 size-3.5"
                            />
                            <span className="min-w-0">
                              <span className="block text-xs font-semibold text-gray-800">
                                {scalar(task, followUpField(0))}
                              </span>
                              <span className="block text-xs font-normal text-gray-500">
                                {scalar(task, followUpField(1))}
                              </span>
                            </span>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              </section>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            <section className="rounded-xl border border-gray-200 bg-white">
              <div data-node-id={NODE.panelHeader} className="border-b border-gray-100 px-5 py-4">
                <h2 className="text-sm font-bold text-gray-900">{panelHeader.title}</h2>
                <p className="pt-1 text-xs font-normal text-gray-400">{panelHeader.description}</p>
              </div>

              {/* 어느 안건을 여는지. 곁에 붙는 '확인 필요'도 처음 열려 있을 것도 선택지가
                  갖고 온다. 안 오면 **이 자리만** 가린다. */}
              <Built what="안건 목록">
                <AgendaPicker
                  picker={picker}
                  label={panelHeader.title}
                  sourceParams={pickerParams}
                  chosen={chosen}
                  onSelect={(option) =>
                    field.setFieldValue(picker.fieldKey, option.value, option.label)
                  }
                />
              </Built>

              {/* 고른 안건의 정리. **아무것도 고르지 않았을 때가 그림에 없다** —
                  그래서 그 자리에 무엇을 그릴지도 명세에 없다. */}
              <div data-node-id={NODE.panel} className="px-5 py-4">
                {chosenAgenda === undefined ? null : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {scalar(chosenAgenda, panelField(0))}
                      </span>
                      <span
                        data-design-state
                        data-design-rule="state-chip"
                        className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                          STATE_CHIP[scalar(chosenAgenda, panel.columns?.[1]?.toneField)] ??
                          NEUTRAL_CHIP
                        }`}
                      >
                        {scalar(chosenAgenda, panelField(1))}
                      </span>
                    </div>
                    <p className="pt-2 text-xs font-bold text-gray-900">
                      {scalar(chosenAgenda, panelField(2))}
                    </p>

                    {decisionInput === undefined ? null : (
                      <div data-node-id="20:2025" className="pt-4">
                        <label
                          htmlFor={itemKeyOf(scalar(chosenAgenda, 'agendaId'), decisionInput.fieldKey)}
                          className="block text-xs font-semibold text-gray-800"
                        >
                          {decisionInput.label}
                        </label>
                        <textarea
                          id={itemKeyOf(scalar(chosenAgenda, 'agendaId'), decisionInput.fieldKey)}
                          value={
                            draft.values[
                              itemKeyOf(scalar(chosenAgenda, 'agendaId'), decisionInput.fieldKey)
                            ] ?? ''
                          }
                          placeholder={decisionInput.placeholder ?? undefined}
                          onChange={(event) =>
                            field.setFieldValue(
                              itemKeyOf(scalar(chosenAgenda, 'agendaId'), decisionInput.fieldKey),
                              event.target.value === '' ? null : event.target.value,
                            )
                          }
                          className="mt-2 block w-full rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-xs text-gray-900 placeholder:text-gray-900"
                        />
                      </div>
                    )}

                    {noDecision === undefined ? null : (
                      <label
                        data-node-id="20:2029"
                        htmlFor={itemKeyOf(scalar(chosenAgenda, 'agendaId'), noDecision.fieldKey)}
                        className="flex items-center gap-2 pt-3 text-xs font-medium text-gray-600"
                      >
                        <input
                          type="checkbox"
                          id={itemKeyOf(scalar(chosenAgenda, 'agendaId'), noDecision.fieldKey)}
                          checked={
                            (draft.values[
                              itemKeyOf(scalar(chosenAgenda, 'agendaId'), noDecision.fieldKey)
                            ] ?? null) !== null
                          }
                          onChange={(event) =>
                            field.setFieldValue(
                              itemKeyOf(scalar(chosenAgenda, 'agendaId'), noDecision.fieldKey),
                              event.target.checked ? 'y' : null,
                            )
                          }
                          className="size-3.5 shrink-0 accent-blue-600"
                        />
                        <span>{noDecision.label}</span>
                      </label>
                    )}

                    {panelFollowUps === undefined ? null : (
                      <div data-node-id="20:2035" className="mt-4 border-t border-gray-100 pt-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-gray-800">
                            {panelFollowUps.title}
                          </span>
                          {linkTask === undefined ? null : (
                            <button
                              type="button"
                              data-node-id="20:2039"
                              onClick={() => {
                                if (linkTask.action.type === 'pending') {
                                  setNote(linkTask.action.note)
                                }
                              }}
                              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"
                            >
                              <FigmaAsset
                                screenId={SCREEN}
                                nodeId={ASSET.linkTask}
                                className="size-3.5"
                              />
                              {linkTask.label}
                            </button>
                          )}
                        </div>
                        <div className="mt-2 rounded-lg border border-gray-300 px-3 py-3">
                          <ul>
                            {followUpRows.map((task) => (
                              <li
                                key={String(task.taskId)}
                                className="py-1 text-xs font-normal text-gray-500"
                              >
                                {scalar(task, columnFieldOf(panelFollowUps, 0))}
                              </li>
                            ))}
                          </ul>
                          {noFollowUp === undefined ? null : (
                            <label
                              data-node-id="20:2048"
                              htmlFor={itemKeyOf(
                                scalar(chosenAgenda, 'agendaId'),
                                noFollowUp.fieldKey,
                              )}
                              className="flex items-center gap-2 pt-2 text-xs font-medium text-gray-500"
                            >
                              <input
                                type="checkbox"
                                id={itemKeyOf(
                                  scalar(chosenAgenda, 'agendaId'),
                                  noFollowUp.fieldKey,
                                )}
                                checked={
                                  (draft.values[
                                    itemKeyOf(scalar(chosenAgenda, 'agendaId'), noFollowUp.fieldKey)
                                  ] ?? null) !== null
                                }
                                onChange={(event) =>
                                  field.setFieldValue(
                                    itemKeyOf(
                                      scalar(chosenAgenda, 'agendaId'),
                                      noFollowUp.fieldKey,
                                    ),
                                    event.target.checked ? 'y' : null,
                                  )
                                }
                                className="size-3.5 shrink-0 accent-blue-600"
                              />
                              <span>{noFollowUp.label}</span>
                            </label>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

            {/* 무엇이 남았는지. 안 오면 **여기만** 가린다. */}
            <Built what="정리 완료 조건">
              <MinutesCompletionConditions screenParams={screenParams} />
            </Built>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

// 이 화면은 06A의 변형이지만 파일이 따로 있다. 검사가 변형의 배선을 볼 때 바탕
// 화면의 원문을 보므로(screen-honors-spec), 그쪽이 이 파일을 먼저 찾도록 해 두었다.
export { BASE }
