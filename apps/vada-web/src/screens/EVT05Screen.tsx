import { useState } from 'react'
import type { ReactNode } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FigmaAsset } from '../components/FigmaAsset'
import { WorkspaceHeader } from '../components/WorkspaceHeader'
import { CHOICE_CHIP, MUTED_CHIP, NEUTRAL_CHIP, ROW_TONE, STATE_CHIP } from '../design/tones'
import { readListSource, readObjectSource } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { getOptionSource } from '../option-sources/catalog'
import type { Option } from '../option-sources/catalog'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, elementByNodeId, evt05 } from '../spec/screens'
import { targetScreenOf } from '../spec/types'
import { useFieldDraft } from '../spec/useFieldDraft'
import { useSubmitAction } from '../spec/useSubmitAction'
import type {
  ButtonSpec,
  GroupSpec,
  InputSpec,
  ItemListSpec,
  SelectSpec,
  SubmitAction,
  SummarySpec,
} from '../spec/types'
import type { ScopeDraft } from '../state/scopes'

// 참여 설문 생성·관리(EVT-05). 인원 관리 갈피 아래로 한 겹 더 들어간 화면이다.
//
// **이 화면에는 저장 단추가 없다.** 모집 설정 칸 여섯을 고치는데 그림 어디에도
// '저장'이 없고, 카탈로그의 event.survey.saveSettings를 부를 자리가 없다. 지어내지
// 않고 비워 둔다 - 무엇을 눌러야 저장되는지는 그림이 말해야 한다.
//
// **막는 것은 서버다.** '설문 링크 활성화'는 조건 열여섯을 다 채워야 눌리는데,
// 무엇이 모자란지는 조직의 규칙이라 화면이 셀 수 없다(executeWhen: sourceAllows).
// 화면이 하는 일은 서버가 준 까닭을 그대로 내놓는 것뿐이다.
//
// **명세가 침묵해서 화면이 알고 있는 것이 셋이다.**
//
// 1. 조건 줄의 색. 명세는 columns[0].toneField로 '이 칸의 글에 색 이름이 있다'까지
//    말하는데, 그림은 그 색으로 줄 바탕까지 칠하고 앞머리 그림도 바꾼다.
//    rowToneField를 쓸 수 없다 - 그것은 바깥 행(묶음)의 조각을 보는데 tone은
//    묶음 안 항목의 것이다(검증기가 '없는 조각'이라고 잡는다).
// 2. 문항 줄의 잠김. 응답이 있는 문항은 지울 수 없고(X가 없다) 손잡이 색도 다른데,
//    itemRemove는 목록 전체에 걸리는 선언이라 '어느 항목에'를 말할 자리가 없다.
//    그래서 화면이 event.surveyQuestions의 locked를 직접 읽는다.
// 3. 조각 사이의 '~'와 화살표. 명세는 칸 둘을 말하고 그 사이의 글자는 design의 것이다.

const SCREEN = 'EVT-05'

const NODE = {
  statusChip: '25:515',
  preview: '25:517',
  activate: '25:523',
  unmetBadge: '25:525',
  editBasics: '25:570',
  startEvent: '25:572',
  basics: '25:578',
  basicsLink: '25:636',
  recruitGroup: '25:642',
  applyStart: '25:646',
  applyEnd: '25:653',
  applyMethod: '25:666',
  waitlist: '25:674',
  duesCheck: '25:682',
  duesNote: '25:690',
  completionNote: '25:695',
  conditions: '25:700',
  unmetNote: '25:704',
  questions: '25:844',
  questionRow: '25:848',
  addQuestion: '25:963',
  questionPanel: '25:976',
} as const

const ASSET = {
  workspaceStatus: { startAt: '25:560' } as Record<string, string>,
  preview: '25:518',
  basicsInfo: '25:581',
  basicsFold: '25:588',
  basicsLink: '25:637',
  applyEndAlert: '25:655',
  applyEndNote: '25:661',
  duesNote: '25:691',
  // 조건 줄 앞머리. design은 줄마다 다른 노드로 뽑았지만 그림은 두 가지뿐이라
  // 첫 벌만 지목한다(대조는 같은 그림을 묶어 본다).
  conditionMet: '25:711',
  conditionUnmet: '25:754',
  // 문항 줄의 손잡이. 잠긴 문항의 것이 한 단계 옅다 - 다른 그림이다.
  questionGripLocked: '25:850',
  questionGrip: '25:882',
  questionRemove: '25:896',
} as const

// 경로 조각 사이의 화살표. 명세는 조각이 무엇인지만 말하고 그 사이의 그림은
// design이 갖는다(MY-REQ-01과 같은 방식).
const BREADCRUMB_SEPARATORS = ['25:498', '25:503', '25:508']

// 조건 줄이 톤 이름을 어떤 모습으로 옮기는지. design/tones.ts의 표들과 달리 이
// 자리에만 있어서 여기 둔다 - 두 번째 화면에서 다시 나오면 그때 올릴 자리다.
// (ROW_TONE은 줄 바탕만 갖고 있고, 여기서는 글자 색과 앞머리 그림까지 갈린다.)
const CONDITION_TONE: Record<
  string,
  { row: string; label: string; detail: string; icon: string }
> = {
  green: {
    row: '',
    label: 'text-gray-700',
    detail: 'text-gray-400',
    icon: ASSET.conditionMet,
  },
  red: {
    row: ROW_TONE.red,
    label: 'text-red-700',
    detail: 'text-red-500',
    icon: ASSET.conditionUnmet,
  },
}

// 서버가 막았을 때의 으뜸 단추. design이 그 상태만 그렸다(bg-blue-200·text-blue-400).
const BLOCKED_PRIMARY = 'bg-blue-200 text-blue-400'

interface EVT05ScreenProps {
  screenParams: Record<string, string>
  /** 명세가 stateScopeKey로 말한 자리(eventSurveyDraft). 모집 설정 초안이 여기 산다. */
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

function scalar(row: DataRow, field: string | undefined): string {
  const value = row[field ?? '']
  if (value === undefined || Array.isArray(value)) {
    return ''
  }
  return String(value)
}

function rowsOf(row: DataRow, field: string): DataRow[] {
  const value = row[field]
  return Array.isArray(value) ? value : []
}

// 읽어 온 설정을 초안으로 옮긴다(draftFrom). 조각 이름이 칸 이름과 같으면 그
// 값으로 시작한다.
function draftFromRow(row: DataRow): ScopeDraft {
  const values: Record<string, string | null> = {}
  for (const [key, value] of Object.entries(row)) {
    values[key] = String(value)
  }
  return { values, labels: {} }
}

export function EVT05Screen({
  screenParams,
  draft: scopeDraft,
  onChangeDraft,
  onNavigate,
}: EVT05ScreenProps) {
  const submitAction = useSubmitAction()
  const [note, setNote] = useState<string | null>(null)
  // 지운 문항. **아무 데도 보내지 않는다** — 문항을 고치는 제출 계약이 카탈로그에
  // 없고 그림에도 저장 단추가 없다. 지운 것이 화면에서 사라지는 것까지가 명세가
  // 말한 전부다(itemList.itemRemove).
  const [removed, setRemoved] = useState<string[]>([])

  const missing = (evt05.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )

  // 인자가 없는데 초안을 읽으러 가면 readObjectSource가 먼저 던진다. 갈고리는
  // 조건 없이 불러야 하므로 판정을 여기 안에서 한다(EVT-02B와 같은 자리).
  const [seed] = useState<ScopeDraft>(() =>
    missing.length > 0
      ? { values: {}, labels: {} }
      : draftFromRow(
          readObjectSource(
            evt05.draftFrom!.dataSourceKey,
            resolveParams(evt05.draftFrom!.params, { screenParams }),
          ),
        ),
  )
  const draft = Object.keys(scopeDraft.values).length === 0 ? seed : scopeDraft
  const field = useFieldDraft({ elements: evt05.elements, draft, onChangeDraft, screenParams })

  if (missing.length > 0) {
    return (
      <AppShell
        screenId={evt05.screenId}
        activeNavigationScreenId={evt05.activeNavigationScreenId}
        eyebrow={evt05.meta?.eyebrow}
        title={evt05.meta?.title ?? evt05.screenId}
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

  const buttonAt = (nodeId: string) => elementByNodeId(evt05, nodeId).spec as ButtonSpec
  const summaryAt = (nodeId: string) => elementByNodeId(evt05, nodeId).spec as SummarySpec
  const inputAt = (nodeId: string) => elementByNodeId(evt05, nodeId).spec as InputSpec
  const selectAt = (nodeId: string) => elementByNodeId(evt05, nodeId).spec as SelectSpec
  const listAt = (nodeId: string) => elementByNodeId(evt05, nodeId).spec as ItemListSpec

  // 명세가 navigate라고 말한 자리는 실제로 데려간다. pending이면 그 글을 내놓는다.
  const press = (spec: ButtonSpec) => () => {
    if (spec.action.type === 'navigate') {
      onNavigate(spec.action.targetScreenId, resolveParams(spec.action.params, { screenParams }))
      return
    }
    if (spec.action.type === 'pending') setNote(spec.action.note)
  }

  const statusChip = summaryAt(NODE.statusChip)
  const surveyRow = readObjectSource(
    statusChip.dataSourceKey,
    resolveParams(statusChip.params, { screenParams }),
  )

  const activate = buttonAt(NODE.activate)
  const gate = activate.action.type === 'submit' ? activate.action.executeWhen : undefined
  // 서버가 막았는지. 조각에 글이 있으면 막힌 것이고 그 글이 까닭이다.
  const blockedNote =
    gate?.type === 'sourceAllows'
      ? scalar(
          readObjectSource(gate.dataSourceKey, resolveParams(gate.params, { screenParams })),
          gate.blockedNoteField,
        )
      : ''

  const unmetBadge = summaryAt(NODE.unmetBadge)
  const activationRow = readObjectSource(
    unmetBadge.dataSourceKey,
    resolveParams(unmetBadge.params, { screenParams }),
  )
  const unmetNote = summaryAt(NODE.unmetNote)

  const basics = summaryAt(NODE.basics)
  const basicsRow = readObjectSource(
    basics.dataSourceKey,
    resolveParams(basics.params, { screenParams }),
  )

  const recruit = elementByNodeId(evt05, NODE.recruitGroup).spec as GroupSpec
  const applyStart = inputAt(NODE.applyStart)
  const applyEnd = inputAt(NODE.applyEnd)
  const completionNote = inputAt(NODE.completionNote)
  const duesNote = summaryAt(NODE.duesNote)

  const conditions = listAt(NODE.conditions)
  const conditionGroups = readListSource(
    conditions.dataSourceKey,
    resolveParams(conditions.params, { screenParams }),
  )

  const questions = listAt(NODE.questions)
  const questionRows = readListSource(
    questions.dataSourceKey,
    resolveParams(questions.params, { screenParams }),
  ).filter((row) => !removed.includes(String(row.id)))
  const questionCard = questions.itemFields![0].spec as SummarySpec

  const panel = summaryAt(NODE.questionPanel)

  const valueOf = (fieldKey: string) => draft.values[fieldKey] ?? ''
  const setValue = (fieldKey: string, next: string) =>
    field.setFieldValue(fieldKey, next === '' ? null : next)

  function pressActivate() {
    if (activate.action.type !== 'submit') return
    // 판정은 한 곳에서만 돈다. 서버가 막았으면 그 까닭을 그대로 내놓는다.
    if (blockedNote !== '') {
      setNote(blockedNote)
      return
    }
    setNote(null)
    void submitAction.run(activate.action as SubmitAction, {
      payload: draft.values,
      onNavigate,
      paramSources: { screenParams },
    })
  }

  // 날짜와 시각을 한 칸에서 받는다. ARIA가 이름을 정해 두지 않은 컨트롤이라
  // 라벨로만 찾힌다(EVT-02B와 같은 자리).
  function dateTimeInput(spec: InputSpec, invalid: boolean): ReactNode {
    return (
      <input
        id={spec.fieldKey}
        type={spec.inputType}
        value={valueOf(spec.fieldKey)}
        onChange={(event) => setValue(spec.fieldKey, event.target.value)}
        className={`w-full rounded border px-3 py-1.5 text-xs text-gray-800 ${
          invalid ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
        }`}
      />
    )
  }

  // 켜고 끄는 칸. 값은 참이냐 거짓이냐다(EVT-02B와 같은 규칙).
  function checkField(nodeId: string): ReactNode {
    const spec = inputAt(nodeId)
    return (
      <label
        data-node-id={nodeId}
        htmlFor={spec.fieldKey}
        className="flex items-center gap-2 text-xs font-medium text-gray-700"
      >
        <input
          id={spec.fieldKey}
          type={spec.inputType}
          // 체크 상자의 value는 기본이 'on'이라 대조기가 그 글을 칸의 내용으로
          // 읽는다. 켜짐은 checked가 말한다.
          value=""
          checked={valueOf(spec.fieldKey) === 'y'}
          onChange={(event) => field.setFieldValue(spec.fieldKey, event.target.checked ? 'y' : null)}
          className="size-3 shrink-0 accent-blue-600"
        />
        <span>{spec.label}</span>
      </label>
    )
  }

  // 펼친 선택지 묶음(select.presentation choiceGroup). 좁혀 보는 칩과 같은 배합이라
  // design/tones.ts의 CHOICE_CHIP을 그대로 쓴다.
  function choiceField(nodeId: string, labelClass: string): ReactNode {
    const spec = selectAt(nodeId)
    const source = getOptionSource(spec.optionsSource.key)
    const options: Option[] = source.type === 'static' ? source.options : []
    const chosen = draft.values[spec.fieldKey] ?? null
    return (
      <>
        <label id={`${spec.fieldKey}-label`} htmlFor={spec.fieldKey} className={labelClass}>
          <span>{spec.label}</span>
          {spec.required && <span className="text-red-500">*</span>}
        </label>
        <div
          id={spec.fieldKey}
          role="radiogroup"
          aria-labelledby={`${spec.fieldKey}-label`}
          className="flex flex-wrap gap-2"
        >
          {options.map((option) => {
            const selected = option.value === chosen
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => field.setFieldValue(spec.fieldKey, option.value, option.label)}
                className={`rounded border px-3 py-1.5 text-xs font-medium ${
                  selected ? CHOICE_CHIP.on : CHOICE_CHIP.off
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </>
    )
  }

  return (
    <AppShell
      screenId={evt05.screenId}
      activeNavigationScreenId={evt05.activeNavigationScreenId}
      eyebrow={evt05.meta?.eyebrow}
      title={drawnTitleOf(evt05, screenParams)}
      onNavigate={onNavigate}
      breadcrumb={
        evt05.breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={evt05.breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={BREADCRUMB_SEPARATORS}
            items={evt05.breadcrumb.items.map((item) =>
              item.field === undefined
                ? (item.value ?? '')
                : scalar(
                    readObjectSource(
                      evt05.breadcrumb!.dataSourceKey,
                      resolveParams(evt05.breadcrumb!.params, { screenParams }),
                    ),
                    item.field,
                  ),
            )}
          />
        )
      }
      headerAction={
        <div className="flex items-center gap-2">
          <span
            data-node-id={NODE.statusChip}
            data-design-rule="state-chip"
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              STATE_CHIP[scalar(surveyRow, statusChip.toneField)] ?? NEUTRAL_CHIP
            }`}
          >
            {scalar(surveyRow, (statusChip.items ?? [])[0]?.field)}
          </span>

          <button
            type="button"
            data-node-id={NODE.preview}
            onClick={press(buttonAt(NODE.preview))}
            className="flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.preview} className="size-3" />
            {buttonAt(NODE.preview).label}
          </button>

          <span className="relative inline-flex">
            <button
              type="button"
              data-node-id={NODE.activate}
              onClick={pressActivate}
              className={`rounded px-3 py-1.5 text-xs font-medium ${
                blockedNote === '' ? 'bg-blue-600 text-white hover:bg-blue-700' : BLOCKED_PRIMARY
              }`}
            >
              {submitAction.labelOf(activate.action as SubmitAction, activate.label)}
            </button>
            {/* 못 채운 조건 수. 서버가 세고 화면은 그 수만 그린다. */}
            <span
              data-node-id={NODE.unmetBadge}
              className="absolute -top-1.5 -right-1.5 rounded-full bg-red-500 px-1.5 text-xs font-bold text-white"
            >
              {scalar(activationRow, (unmetBadge.items ?? [])[0]?.field)}
            </span>
          </span>
        </div>
      }
    >
      <WorkspaceHeader
        screen={evt05}
        screenParams={screenParams}
        onNavigate={onNavigate}
        onPending={setNote}
        assetScreenId={SCREEN}
        statusAssets={ASSET.workspaceStatus}
        actions={
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              data-node-id={NODE.editBasics}
              onClick={press(buttonAt(NODE.editBasics))}
              className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {buttonAt(NODE.editBasics).label}
            </button>
            <button
              type="button"
              data-node-id={NODE.startEvent}
              onClick={press(buttonAt(NODE.startEvent))}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              {buttonAt(NODE.startEvent).label}
            </button>
          </div>
        }
      />

      {note === null ? null : (
        <p role="alert" className="mt-4 rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-600">
          {note}
        </p>
      )}
      {submitAction.errorMessage === null ? null : (
        <p role="alert" className="mt-4 text-sm text-red-500">
          {submitAction.errorMessage}
        </p>
      )}

      <div className="flex items-start gap-4 pt-5">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {/* 행사 기본정보. 이 화면에서 고치지 않는다 - 고치는 자리는 EVT-02B다. */}
          <section
            data-node-id={NODE.basics}
            className="rounded-md border border-gray-200 bg-white"
          >
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
              <span className="flex items-center gap-2">
                <FigmaAsset screenId={SCREEN} nodeId={ASSET.basicsInfo} className="size-3" />
                <span className="text-xs font-semibold text-gray-700">{basics.title}</span>
                <span className="text-xs text-gray-400">{basics.description}</span>
              </span>
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.basicsFold} className="size-3.5" />
            </div>

            <div className="border-t border-gray-100 px-3.5 py-2.5">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
                {(basics.items ?? []).map((item) => (
                  <div key={item.field} className="flex gap-4">
                    <dt className="w-14 shrink-0 text-xs text-gray-400">{item.label}</dt>
                    <dd className="min-w-0 text-xs text-gray-700">
                      {scalar(basicsRow, item.field)}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-2.5 flex justify-end border-t border-gray-50 pt-2.5">
                <button
                  type="button"
                  data-node-id={NODE.basicsLink}
                  onClick={press(buttonAt(NODE.basicsLink))}
                  className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"
                >
                  <FigmaAsset screenId={SCREEN} nodeId={ASSET.basicsLink} className="size-2.5" />
                  {buttonAt(NODE.basicsLink).label}
                </button>
              </div>
            </div>
          </section>

          {/* 모집 설정. 명세가 묶음으로 말한 칸 여섯이 여기 산다(group). */}
          <section
            data-node-id={NODE.recruitGroup}
            aria-labelledby="recruit-title"
            className="flex flex-col gap-3.5 rounded-md border border-gray-200 bg-white px-3.5 py-3.5"
          >
            <h3 id="recruit-title" className="text-xs font-semibold text-gray-700">
              {recruit.title}
            </h3>

            <div data-node-id={NODE.applyStart} className="flex flex-col gap-1.5">
              <label
                htmlFor={applyStart.fieldKey}
                className="text-xs font-medium text-gray-700"
              >
                <span>{applyStart.label}</span>
                {applyStart.required && <span className="text-red-500">*</span>}
              </label>
              <div className="flex items-center gap-2">
                {dateTimeInput(applyStart, false)}
                {/* 조각 사이의 글자는 design의 것이다. */}
                <span className="shrink-0 text-xs text-gray-400">~</span>
                <div data-node-id={NODE.applyEnd} className="relative w-full">
                  {/* 라벨이 이 자리에 그려지지 않는 칸이다(labelHidden). 그래도
                      읽어 주는 이름은 있어야 한다. */}
                  <label htmlFor={applyEnd.fieldKey} className="sr-only">
                    {applyEnd.label}
                  </label>
                  {dateTimeInput(applyEnd, valueOf(applyEnd.fieldKey) === '')}
                  <FigmaAsset
                    screenId={SCREEN}
                    nodeId={ASSET.applyEndAlert}
                    className="absolute top-1/2 right-2.5 size-2.5 -translate-y-1/2"
                  />
                </div>
              </div>
              {/* 명세의 helperText. 늘 그려지는 보조 설명이고, 색은 design이 정했다. */}
              <p className="flex items-center gap-1.5 text-xs text-red-500">
                <FigmaAsset
                  screenId={SCREEN}
                  nodeId={ASSET.applyEndNote}
                  className="size-2.5 shrink-0"
                />
                {applyEnd.helperText}
              </p>
            </div>

            <div data-node-id={NODE.applyMethod} className="flex flex-col gap-1.5">
              {choiceField(NODE.applyMethod, 'text-xs font-medium text-gray-700')}
            </div>

            {checkField(NODE.waitlist)}

            <div className="flex flex-col gap-2">
              {checkField(NODE.duesCheck)}
              <p
                data-node-id={NODE.duesNote}
                className="flex items-start gap-2 rounded border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700"
              >
                <FigmaAsset
                  screenId={SCREEN}
                  nodeId={ASSET.duesNote}
                  className="mt-0.5 size-3 shrink-0"
                />
                <span>{duesNote.title}</span>
              </p>
            </div>

            <div data-node-id={NODE.completionNote} className="flex flex-col gap-1.5">
              <label
                htmlFor={completionNote.fieldKey}
                className="text-xs font-medium text-gray-700"
              >
                {completionNote.label}
              </label>
              <textarea
                id={completionNote.fieldKey}
                rows={3}
                value={valueOf(completionNote.fieldKey)}
                placeholder={completionNote.placeholder ?? undefined}
                onChange={(event) => setValue(completionNote.fieldKey, event.target.value)}
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400"
              />
            </div>
          </section>

          {/* 설문 링크 활성화 조건. 묶음으로 오고, 켤 수 있는지는 서버가 센다. */}
          <section
            data-node-id={NODE.conditions}
            className="rounded-md border border-gray-200 bg-white px-3.5 py-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-gray-700">{conditions.title}</h3>
              <span
                data-node-id={NODE.unmetNote}
                className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-600"
              >
                {scalar(activationRow, (unmetNote.items ?? [])[0]?.field)}
              </span>
            </div>

            {conditionGroups.map((group) => (
              <div key={scalar(group, conditions.group!.headerFields![0].fields![0])}>
                <p className="pt-3.5 pb-1 text-xs font-semibold text-gray-400">
                  {scalar(group, conditions.group!.headerFields![0].fields![0])}
                </p>
                <ul>
                  {rowsOf(group, conditions.group!.itemsField).map((row) => {
                    const columns = conditions.columns ?? []
                    const tone =
                      CONDITION_TONE[scalar(row, columns[0]?.toneField)] ?? CONDITION_TONE.green
                    const label = scalar(row, columns[0]?.fields?.[0])
                    const detail = scalar(row, columns[1]?.fields?.[0])
                    const location = scalar(row, columns[2]?.fields?.[0])
                    const action = conditions.itemAction
                    const actionLabel =
                      action?.labelField === undefined ? '' : scalar(row, action.labelField)
                    return (
                      <li
                        key={scalar(row, 'key')}
                        className={`flex items-start gap-2.5 border-b border-gray-50 px-2.5 py-2 last:border-b-0 ${tone.row}`}
                      >
                        <FigmaAsset
                          screenId={SCREEN}
                          nodeId={tone.icon}
                          className="mt-0.5 size-3.5 shrink-0"
                        />
                        <span className="min-w-0 flex-1">
                          <span className={`block text-xs font-medium ${tone.label}`}>
                            {label}
                          </span>
                          {detail === '' ? null : (
                            <span className={`block pt-0.5 text-xs ${tone.detail}`}>
                              {detail}
                            </span>
                          )}
                          {location === '' ? null : (
                            <span className="block pt-0.5 text-xs text-gray-400">{location}</span>
                          )}
                        </span>
                        {/* 채우러 가는 곳은 명세가 든다 - 데이터는 열쇠만 준다. */}
                        {actionLabel === '' || action === undefined ? null : (
                          <button
                            type="button"
                            onClick={() => {
                              if (action.type !== 'navigate') return
                              const target = targetScreenOf(action, row)
                              if (target !== null) {
                                onNavigate(
                                  target,
                                  resolveParams(action.params, { screenParams, row }),
                                )
                              }
                            }}
                            className="shrink-0 rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-100"
                          >
                            {actionLabel}
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </section>

          {/* 설문 문항. 응답이 있는 문항은 잠긴다 - 그 사실은 데이터가 안다(locked). */}
          <section data-node-id={NODE.questions} className="flex flex-col gap-2.5">
            <h3 className="text-xs font-semibold text-gray-700">{questions.title}</h3>
            {questionRows.map((row, index) => {
              const locked = scalar(row, 'locked') !== ''
              return (
                <div
                  key={scalar(row, 'id')}
                  className="rounded-md border border-gray-200 bg-white px-3.5 py-3.5"
                >
                  <span
                    data-node-id={index === 0 ? NODE.questionRow : undefined}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <FigmaAsset
                        screenId={SCREEN}
                        nodeId={locked ? ASSET.questionGripLocked : ASSET.questionGrip}
                        className="size-3.5 shrink-0"
                      />
                      <span className="text-sm font-medium text-gray-800">
                        {scalar(row, questionCard.titleField)}
                      </span>
                      {rowsOf(row, questionCard.statusField ?? '').map((badge) => (
                        <span
                          key={String(badge.label)}
                          data-design-rule="state-chip"
                          className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                            STATE_CHIP[String(badge.tone)] ?? NEUTRAL_CHIP
                          }`}
                        >
                          {String(badge.label)}
                        </span>
                      ))}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${MUTED_CHIP}`}>
                        {scalar(row, (questionCard.items ?? [])[0]?.field)}
                      </span>
                      {/* 잠긴 문항에는 지우는 자리가 그려지지 않는다. */}
                      {locked ? null : (
                        <button
                          type="button"
                          aria-label={`${scalar(row, questionCard.titleField)} ${
                            questions.itemRemove?.label ?? ''
                          }`}
                          onClick={() =>
                            setRemoved((previous) => [...previous, scalar(row, 'id')])
                          }
                          className="rounded p-0.5 hover:bg-gray-100"
                        >
                          <FigmaAsset
                            screenId={SCREEN}
                            nodeId={ASSET.questionRemove}
                            className="size-3"
                          />
                        </button>
                      )}
                    </span>
                  </span>
                </div>
              )
            })}
          </section>

          {/* 질문 추가. 무엇을 더할 수 있는지는 명세가 정한다(event.surveyQuestionTypes).
              고른 뒤 오른쪽 '질문 설정'에 무엇이 그려지는지는 그림에 없다. */}
          <div
            data-node-id={NODE.addQuestion}
            className="flex items-center justify-center gap-2 rounded-md border-2 border-gray-200 px-3.5 py-3.5"
          >
            {choiceField(NODE.addQuestion, 'text-xs font-medium text-gray-400')}
          </div>
        </div>

        {/* 질문 설정 칸. design은 제목만 그리고 안을 비워 두었다 - 무엇이 오는지는
            그림이 말하지 않는다. */}
        <aside className="w-60 shrink-0 self-stretch rounded-md border border-gray-200 bg-white">
          <div data-node-id={NODE.questionPanel} className="border-b border-gray-100 px-3.5 py-2.5">
            <h3 className="text-sm font-semibold text-gray-800">{panel.title}</h3>
          </div>
        </aside>
      </div>
    </AppShell>
  )
}
