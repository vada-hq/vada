import { useState } from 'react'
import type { ReactNode } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { Built } from '../components/Built'
import { FigmaAsset } from '../components/FigmaAsset'
import { SearchSelect } from '../components/SearchSelect'
import { NEUTRAL_CHIP, STATE_CHIP } from '../design/tones'
import { findDataSource, readListSource, readObjectSource } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { elementByNodeId, rec02a } from '../spec/screens'
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

// 아카이브 작성·검토(REC-02A). 발행된 문서를 읽는 REC-02와 주소가 다른 화면이다 —
// 그리는 글이 사실상 하나도 겹치지 않고 요소 구성이 통째로 다르다.
//
// **이 화면에는 발행 단추가 없다.** 오른쪽 기둥이 '발행 조건 0 / 6'과 '조건을 모두
// 충족해야 발행할 수 있습니다.'를 그리는데, 정작 발행을 누르는 자리가 그림 어디에도
// 없다. 지어내지 않는다 — 그래서 record.archive.publish도 만들지 않았다.
//
// **막는 것은 서버다.** '검토 요청'은 executeWhen: sourceAllows로 record.archiveGate를
// 읽고, 화면이 하는 일은 서버가 준 까닭을 그대로 내놓는 것뿐이다. 무엇이 모자란지를
// 화면이 세면 문서 서식이 바뀔 때마다 화면이 틀린다.
//
// **명세가 침묵해서 화면이 알고 있는 것이 셋이다.**
//
// 1. **목차를 눌러 절로 가는 동작에 어휘가 없다**(REC-02와 같은 자리, 보고서 참조).
//    그래서 목차는 이름과 진행 상태만 그리고, 지금 어느 절에 있는지는 design이 그린
//    그 자리(현장 운영)에서 움직이지 않는다.
// 2. 조건 줄의 앞머리 그림. 명세는 columns[].toneField로 '이 줄에 색 이름이 있다'
//    까지만 말하고, 그 이름이 어떤 그림으로 그려지는지는 design의 것이다.
// 3. '검토 요청' 단추가 흐리게 그려져 있다(opacity 0.4). 무엇을 채우면 켜지는지는
//    그림이 말하지 않는다 — 여섯 조건이 '발행'의 것인지 '검토 요청'의 것인지도.

const SCREEN = 'REC-02A'

const NODE = {
  statusChip: '30:4083',
  saveDraft: '30:4085',
  requestReview: '30:4087',
  banner: '30:4094',
  toc: '30:4106',
  autoFilled: '30:4146',
  onSite: '30:4173',
  retroGroup: '30:4182',
  retroGood: '30:4187',
  retroIssues: '30:4191',
  retroImprovements: '30:4195',
  improvementDepartment: '30:4199',
  handoverGroup: '30:4203',
  aiDisclaimer: '30:4211',
  generateDraft: '30:4213',
  handover: '30:4221',
  nextOwner: '30:4224',
  gate: '30:4232',
  gateConditions: '30:4237',
  gateNote: '30:4286',
  review: '30:4288',
  reviewer: '30:4291',
  reviewComment: '30:4294',
} as const

const ASSET = {
  breadcrumbSeparators: ['30:4066', '30:4071', '30:4076'],
  requestReview: '30:4088',
  banner: '30:4095',
  generateDraft: '30:4214',
  condition: '30:4239',
} as const

// 목차 줄의 색. 톤 이름은 데이터가 준다(record.archiveSections의 statusTone) —
// 저절로 채워지는 절과 사람이 써야 하는 절이 갈린다. design/tones.ts에 이 배합의
// 표가 아직 없어 여기 둔다(두 번째 화면에서 다시 나오면 그때 올릴 자리다).
const SECTION_TONE: Record<string, { label: string; status: string }> = {
  gray: { label: 'text-gray-400', status: 'text-gray-300' },
  orange: { label: 'text-gray-600', status: 'text-orange-500' },
}

// 조건 줄 앞머리. design은 여섯 줄을 전부 '못 채움'으로 그려서 그림이 하나뿐이다 —
// 채운 줄의 그림은 이 프레임에 없다.
const CONDITION_ICON: Record<string, string> = { orange: ASSET.condition }

// 지금 어느 절에 있는가. **화면 안의 상태인데 옮길 방법이 없다** — 목차가 절로
// 데려가는 동작에 어휘가 없기 때문이다. design이 그린 자리를 처음 값으로 둔다.
const INITIAL_SECTION_KEY = 'onSite'

function scalar(row: DataRow, field: string | undefined): string {
  const value = row[field ?? '']
  if (value === undefined || Array.isArray(value)) {
    return ''
  }
  return String(value)
}

// 읽어 온 초안을 화면의 칸으로 옮긴다(draftFrom). 조각 이름이 칸 이름과 같으면
// 그 값으로 시작한다.
function draftFromRow(row: DataRow): ScopeDraft {
  const values: Record<string, string | null> = {}
  for (const [key, value] of Object.entries(row)) {
    values[key] = String(value)
  }
  return { values, labels: {} }
}

interface REC02AScreenProps {
  screenParams: Record<string, string>
  /** 명세가 stateScopeKey로 말한 자리(archiveDraft). 쓰는 칸이 전부 여기 산다. */
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function REC02AScreen({
  screenParams,
  draft: scopeDraft,
  onChangeDraft,
  onNavigate,
}: REC02AScreenProps) {
  const submitAction = useSubmitAction()
  const [note, setNote] = useState<string | null>(null)

  const missing = (rec02a.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )

  // 인자가 없는데 초안을 읽으러 가면 readObjectSource가 먼저 던진다. 갈고리는
  // 조건 없이 불러야 하므로 판정을 여기 안에서 한다(EVT-05와 같은 자리).
  const [seed] = useState<ScopeDraft>(() =>
    missing.length > 0
      ? { values: {}, labels: {} }
      : draftFromRow(
          readObjectSource(
            rec02a.draftFrom!.dataSourceKey,
            resolveParams(rec02a.draftFrom!.params, { screenParams }),
          ),
        ),
  )
  const draft = Object.keys(scopeDraft.values).length === 0 ? seed : scopeDraft
  const field = useFieldDraft({
    elements: rec02a.elements,
    draft,
    onChangeDraft,
    screenParams,
  })

  if (missing.length > 0) {
    return (
      <AppShell
        screenId={rec02a.screenId}
        activeNavigationScreenId={rec02a.activeNavigationScreenId}
        eyebrow={rec02a.meta?.eyebrow}
        title={rec02a.meta?.title ?? rec02a.screenId}
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

  const buttonAt = (nodeId: string) => elementByNodeId(rec02a, nodeId).spec as ButtonSpec
  const summaryAt = (nodeId: string) => elementByNodeId(rec02a, nodeId).spec as SummarySpec
  const inputAt = (nodeId: string) => elementByNodeId(rec02a, nodeId).spec as InputSpec
  const selectAt = (nodeId: string) => elementByNodeId(rec02a, nodeId).spec as SelectSpec
  const listAt = (nodeId: string) => elementByNodeId(rec02a, nodeId).spec as ItemListSpec
  const objectOf = (spec: SummarySpec) =>
    readObjectSource(spec.dataSourceKey, resolveParams(spec.params, { screenParams }))

  const statusChip = summaryAt(NODE.statusChip)
  const archiveRow = objectOf(statusChip)

  const saveDraft = buttonAt(NODE.saveDraft)
  const requestReview = buttonAt(NODE.requestReview)
  const generateDraft = buttonAt(NODE.generateDraft)

  // 서버가 막았는지. 조각에 글이 있으면 막힌 것이고 그 글이 까닭이다.
  const gateCheck =
    requestReview.action.type === 'submit' ? requestReview.action.executeWhen : undefined
  const blockedNote =
    gateCheck?.type === 'sourceAllows'
      ? scalar(
          readObjectSource(
            gateCheck.dataSourceKey,
            resolveParams(gateCheck.params, { screenParams }),
          ),
          gateCheck.blockedNoteField,
        )
      : ''

  const banner = summaryAt(NODE.banner)

  const toc = listAt(NODE.toc)
  const tocRows = readListSource(toc.dataSourceKey, resolveParams(toc.params, { screenParams }))
  const [tocLabel, tocStatus] = toc.columns ?? []

  const autoFilled = summaryAt(NODE.autoFilled)
  const autoFilledRow = objectOf(autoFilled)

  const gate = summaryAt(NODE.gate)
  const gateRow = objectOf(gate)
  const conditions = listAt(NODE.gateConditions)
  const [conditionLabel] = conditions.columns ?? []

  const reviewComment = summaryAt(NODE.reviewComment)
  const reviewCommentItem = (reviewComment.items ?? [])[0]

  const valueOf = (fieldKey: string) => draft.values[fieldKey] ?? ''
  const setValue = (fieldKey: string, next: string) =>
    field.setFieldValue(fieldKey, next === '' ? null : next)

  const send = (button: ButtonSpec) => {
    if (button.action.type !== 'submit') return
    setNote(null)
    void submitAction.run(button.action as SubmitAction, {
      payload: draft.values,
      onNavigate,
      paramSources: { screenParams },
    })
  }

  function pressRequestReview() {
    // 판정은 한 곳에서만 돈다. 서버가 막았으면 그 까닭을 그대로 내놓는다.
    if (blockedNote !== '') {
      setNote(blockedNote)
      return
    }
    send(requestReview)
  }

  const breadcrumb = rec02a.breadcrumb

  return (
    <AppShell
      screenId={rec02a.screenId}
      activeNavigationScreenId={rec02a.activeNavigationScreenId}
      eyebrow={rec02a.meta?.eyebrow}
      title={rec02a.meta?.title ?? rec02a.screenId}
      onNavigate={onNavigate}
      breadcrumb={
        breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={[...ASSET.breadcrumbSeparators]}
            items={breadcrumb.items.map((item) => item.value ?? scalar(archiveRow, item.field))}
          />
        )
      }
      headerAction={
        <span className="flex items-center gap-2">
          <span
            data-node-id={NODE.statusChip}
            data-design-rule="state-chip"
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              STATE_CHIP[scalar(archiveRow, statusChip.toneField)] ?? NEUTRAL_CHIP
            }`}
          >
            {scalar(archiveRow, (statusChip.items ?? [])[0]?.field)}
          </span>
          <button
            type="button"
            data-node-id={NODE.saveDraft}
            onClick={() => send(saveDraft)}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            {submitAction.labelOf(saveDraft.action as SubmitAction, saveDraft.label)}
          </button>
          <button
            type="button"
            data-node-id={NODE.requestReview}
            onClick={pressRequestReview}
            // design이 이 단추를 흐리게 그렸다(opacity 0.4). 무엇을 채우면 켜지는지는
            // 그림이 말하지 않으므로 색은 그린 대로 두고, 막는 판정만 서버에 묻는다.
            className={`flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 ${
              blockedNote === '' ? 'hover:bg-gray-50' : 'opacity-40'
            }`}
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.requestReview} className="size-3" />
            {submitAction.labelOf(requestReview.action as SubmitAction, requestReview.label)}
          </button>
        </span>
      }
    >
      <div
        data-node-id={NODE.banner}
        className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4"
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.banner} className="mt-0.5 size-4 shrink-0" />
        <span className="block">
          <span className="block text-sm font-bold text-blue-900">{banner.title}</span>
          <span className="block pt-1 text-sm text-blue-800">{banner.description}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 pt-4 pb-12 lg:grid-cols-[180px_1fr_260px]">
        {/* 목차. 누르는 자리가 아니다 — 절로 데려가는 동작에 어휘가 없다. */}
        <nav
          data-node-id={NODE.toc}
          aria-label={toc.title}
          className="h-fit rounded-xl border border-gray-200 bg-white px-3 py-4"
        >
          <span className="block px-2 text-xs font-bold text-gray-400">{toc.title}</span>
          <ul className="pt-2">
            {tocRows.map((section) => {
              const tone = SECTION_TONE[scalar(section, tocStatus?.toneField)]
              const current = scalar(section, 'key') === INITIAL_SECTION_KEY
              return (
                <li
                  key={scalar(section, 'key')}
                  aria-current={current ? 'true' : undefined}
                  className={`flex items-center justify-between rounded px-2 py-1.5 ${
                    current ? 'bg-blue-50' : ''
                  }`}
                >
                  <span
                    className={`text-xs ${
                      current
                        ? 'font-semibold text-blue-700'
                        : `font-medium ${tone?.label ?? 'text-gray-600'}`
                    }`}
                  >
                    {scalar(section, (tocLabel?.fields ?? [])[0])}
                  </span>
                  <span
                    className={`text-xs ${current ? 'font-semibold' : 'font-medium'} ${
                      tone?.status ?? 'text-gray-400'
                    }`}
                  >
                    {scalar(section, (tocStatus?.fields ?? [])[0])}
                  </span>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="flex flex-col gap-4">
          {/* 사람이 고칠 수 없는 부분. 행사 데이터에서 서버가 줄여 만든 네 줄이다. */}
          <section
            data-node-id={NODE.autoFilled}
            className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
          >
            <header className="flex items-baseline justify-between border-b border-gray-200 px-6 py-3">
              <h2 className="text-sm font-bold text-gray-700">{autoFilled.title}</h2>
              <span className="text-xs text-gray-400">{autoFilled.description}</span>
            </header>
            <dl className="px-6 py-4">
              {(autoFilled.items ?? []).map((item) => (
                <div key={item.field} className="flex items-baseline gap-4 py-1.5">
                  <dt className="w-20 shrink-0 text-xs text-gray-400">{item.label}</dt>
                  <dd className="text-xs text-gray-600">{scalar(autoFilledRow, item.field)}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* 현장 운영. 절 하나가 곧 칸 하나라 라벨이 절의 제목이다. */}
          <FormSection
            nodeId={NODE.onSite}
            title={inputAt(NODE.onSite).label}
            description={inputAt(NODE.onSite).helperText}
            labelFor={inputAt(NODE.onSite).fieldKey}
            current
          >
            <div className="px-6 py-4">
              {textArea(inputAt(NODE.onSite), valueOf, setValue)}
            </div>
          </FormSection>

          <FormSection
            nodeId={NODE.retroGroup}
            title={(elementByNodeId(rec02a, NODE.retroGroup).spec as GroupSpec).title}
            current={false}
          >
            <div data-node-id={NODE.retroGood} className="px-6 py-4">
              <label
                htmlFor={inputAt(NODE.retroGood).fieldKey}
                className="block pb-2 text-sm font-semibold text-gray-800"
              >
                {inputAt(NODE.retroGood).label}
              </label>
              {textArea(inputAt(NODE.retroGood), valueOf, setValue)}
            </div>
            <div data-node-id={NODE.retroIssues} className="border-t border-gray-100 px-6 py-4">
              <label
                htmlFor={inputAt(NODE.retroIssues).fieldKey}
                className="block pb-2 text-sm font-semibold text-gray-800"
              >
                {inputAt(NODE.retroIssues).label}
              </label>
              {textArea(inputAt(NODE.retroIssues), valueOf, setValue)}
            </div>
            <div
              data-node-id={NODE.retroImprovements}
              className="border-t border-gray-100 px-6 py-4"
            >
              <label
                htmlFor={inputAt(NODE.retroImprovements).fieldKey}
                className="block pb-2 text-sm font-semibold text-gray-800"
              >
                {inputAt(NODE.retroImprovements).label}
              </label>
              {textArea(inputAt(NODE.retroImprovements), valueOf, setValue)}
              <div data-node-id={NODE.improvementDepartment} className="pt-3">
                <label
                  htmlFor={selectAt(NODE.improvementDepartment).fieldKey}
                  className="block pb-1.5 text-xs text-gray-500"
                >
                  {selectAt(NODE.improvementDepartment).label}
                </label>
                {dropdown(selectAt(NODE.improvementDepartment), field)}
              </div>
            </div>
          </FormSection>

          <FormSection
            nodeId={NODE.handoverGroup}
            title={(elementByNodeId(rec02a, NODE.handoverGroup).spec as GroupSpec).title}
            description={
              (elementByNodeId(rec02a, NODE.handoverGroup).spec as GroupSpec).description
            }
            current={false}
          >
            <div className="px-6 py-4">
              {/* AI 초안이 무엇을 하고 무엇을 하지 않는지. **화면에 적힌 이 글이 곧
                  그 동작의 계약이다** — 그래서 명세가 아니라 서버가 갖는다. */}
              <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <p data-node-id={NODE.aiDisclaimer} className="text-xs text-gray-500">
                  {scalar(archiveRow, (summaryAt(NODE.aiDisclaimer).items ?? [])[0]?.field)}
                </p>
                <button
                  type="button"
                  data-node-id={NODE.generateDraft}
                  onClick={() => send(generateDraft)}
                  className="flex shrink-0 items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <FigmaAsset
                    screenId={SCREEN}
                    nodeId={ASSET.generateDraft}
                    className="size-3"
                  />
                  {submitAction.labelOf(
                    generateDraft.action as SubmitAction,
                    generateDraft.label,
                  )}
                </button>
              </div>
              <div data-node-id={NODE.handover} className="pt-3">
                {textArea(inputAt(NODE.handover), valueOf, setValue)}
              </div>
            </div>
            <div data-node-id={NODE.nextOwner} className="border-t border-gray-100 px-6 py-4">
              <label
                htmlFor={inputAt(NODE.nextOwner).fieldKey}
                className="block pb-1.5 text-xs font-medium text-gray-700"
              >
                {inputAt(NODE.nextOwner).label}
              </label>
              <input
                id={inputAt(NODE.nextOwner).fieldKey}
                type={inputAt(NODE.nextOwner).inputType}
                value={valueOf(inputAt(NODE.nextOwner).fieldKey)}
                placeholder={inputAt(NODE.nextOwner).placeholder ?? undefined}
                onChange={(event) =>
                  setValue(inputAt(NODE.nextOwner).fieldKey, event.target.value)
                }
                className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-xs text-gray-800 placeholder:text-gray-800 focus:outline-none"
              />
            </div>
          </FormSection>
        </div>

        <aside className="flex h-fit flex-col gap-4">
          <section className="rounded-xl border border-gray-200 bg-white px-5 py-4">
            <div data-node-id={NODE.gate} className="flex items-baseline justify-between">
              <h2 className="text-sm font-bold text-gray-800">{gate.title}</h2>
              {/* 몇 개를 채웠는지는 서버가 센다 — 화면이 세면 조건이 하나 늘 때 틀린다. */}
              <span className="text-xs font-semibold text-orange-600">
                {scalar(gateRow, (gate.items ?? [])[0]?.field)}
              </span>
            </div>
            <ul data-node-id={NODE.gateConditions} className="pt-3">
              {readListSource(
                conditions.dataSourceKey,
                resolveParams(conditions.params, { screenParams }),
              ).map((row) => (
                <li key={scalar(row, 'key')} className="flex items-center gap-2 py-1">
                  <FigmaAsset
                    screenId={SCREEN}
                    nodeId={
                      CONDITION_ICON[scalar(row, conditionLabel?.toneField)] ?? ASSET.condition
                    }
                    className="size-3 shrink-0"
                  />
                  <span className="text-xs text-gray-600">
                    {scalar(row, (conditionLabel?.fields ?? [])[0])}
                  </span>
                </li>
              ))}
            </ul>
            <p data-node-id={NODE.gateNote} className="pt-3 text-xs text-orange-600">
              {summaryAt(NODE.gateNote).title}
            </p>
          </section>

          <section
            data-node-id={NODE.review}
            className="rounded-xl border border-gray-200 bg-white px-5 py-4"
          >
            <h2 className="text-sm font-bold text-gray-800">{summaryAt(NODE.review).title}</h2>
            <div data-node-id={NODE.reviewer} className="pt-3">
              <label
                htmlFor={selectAt(NODE.reviewer).fieldKey}
                className="block pb-1.5 text-xs font-medium text-gray-500"
              >
                {selectAt(NODE.reviewer).label}
              </label>
              {dropdown(selectAt(NODE.reviewer), field)}
            </div>
            {/* 검토 의견은 검토자가 적는다 — 쓰는 사람의 칸이 아니다. 아직 없으면
                출처의 messages.empty가 그 자리를 말한다. */}
            <div data-node-id={NODE.reviewComment} className="pt-3">
              <span className="block pb-1.5 text-xs font-medium text-gray-500">
                {reviewCommentItem?.label}
              </span>
              {/* **이 자리만 따로 가린다.** 검토 단계가 명세에서 빠지므로 서버가 이 자리를
                  짓지 않는다 — 그 하나 때문에 쓰는 화면이 통째로 닫히면 지어 놓은 나머지를
                  아무도 못 본다(components/Built.tsx가 그 까닭을 적어 두었다). */}
              <Built what="검토 의견">
                <ReviewCommentBox
                  load={() => objectOf(reviewComment)}
                  field={reviewCommentItem?.field}
                  emptyNote={findDataSource(reviewComment.dataSourceKey).messages.empty}
                />
              </Built>
            </div>
          </section>
        </aside>
      </div>

      {submitAction.submittingMessage === null ? null : (
        <p role="status" className="pb-2 text-xs text-gray-500">
          {submitAction.submittingMessage}
        </p>
      )}
      {submitAction.errorMessage === null ? null : (
        <p role="alert" className="pb-2 text-xs text-red-500">
          {submitAction.errorMessage}
        </p>
      )}
      {/* 보내고 나면 어디로 가는지가 아직 정해지지 않았다는 글. 적어만 두고 아무도
          안 보여주면 명세에만 있는 사실이 된다. */}
      {submitAction.pendingNote === null ? null : (
        <p role="status" className="pb-6 text-xs text-gray-500">
          {submitAction.pendingNote}
        </p>
      )}
      {note === null ? null : (
        <p role="status" className="pb-6 text-xs text-gray-500">
          {note}
        </p>
      )}
    </AppShell>
  )
}

interface ReviewCommentBoxProps {
  /** 읽는 순간에 부른다 — 안 지은 자리의 신호가 이 안에서 나야 `Built`가 받는다. */
  load: () => DataRow
  field: string | undefined
  emptyNote: string
}

// 검토자가 적은 의견. 아직 없으면 출처의 messages.empty가 그 자리를 말한다.
function ReviewCommentBox({ load, field, emptyNote }: ReviewCommentBoxProps) {
  const comment = scalar(load(), field)
  return (
    <p className="min-h-24 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
      {comment === '' ? emptyNote : comment}
    </p>
  )
}

// 여러 줄을 받는 칸. design이 placeholder를 값 색으로 그렸고(gray-900), 이 화면은
// 그린 대로 따른다 — EVT-00A의 검색 칸과 같은 자리다.
function textArea(
  spec: InputSpec,
  valueOf: (fieldKey: string) => string,
  setValue: (fieldKey: string, next: string) => void,
): ReactNode {
  return (
    <textarea
      id={spec.fieldKey}
      aria-label={spec.labelHidden === true ? spec.label : undefined}
      rows={4}
      value={valueOf(spec.fieldKey)}
      placeholder={spec.placeholder ?? undefined}
      onChange={(event) => setValue(spec.fieldKey, event.target.value)}
      className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs text-gray-900 placeholder:text-gray-900 focus:outline-none"
    />
  )
}

function dropdown(
  spec: SelectSpec,
  field: ReturnType<typeof useFieldDraft>,
): ReactNode {
  return (
    <SearchSelect
      id={spec.fieldKey}
      placeholder={spec.placeholder}
      searchable={spec.searchable}
      disabled={spec.initiallyDisabled}
      sourceKey={spec.optionsSource.key}
      sourceParams={field.resolveSourceParams(spec)}
      value={field.selectValue(spec.fieldKey)}
      onSelect={(option) => field.setFieldValue(spec.fieldKey, option.value, option.label)}
    />
  )
}

interface FormSectionProps {
  nodeId: string
  title: string | undefined
  description?: string
  /**
   * 절 하나가 곧 칸 하나인 자리에서는 제목이 그 칸의 라벨이다(현장 운영).
   * design은 그것을 Heading 3으로 그렸지만, 읽어 주는 이름은 있어야 한다.
   */
  labelFor?: string
  /** 지금 있는 절인가. design이 그 칸만 파란 테두리로 그린다. */
  current: boolean
  children: ReactNode
}

function FormSection({
  nodeId,
  title,
  description,
  labelFor,
  current,
  children,
}: FormSectionProps) {
  return (
    <section
      data-node-id={nodeId}
      aria-label={title}
      className={`overflow-hidden rounded-xl border bg-white ${
        current ? 'border-blue-300' : 'border-gray-200'
      }`}
    >
      <header className="border-b border-gray-100 bg-gray-50 px-6 py-3">
        {labelFor === undefined ? (
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        ) : (
          <label htmlFor={labelFor} className="block text-sm font-bold text-gray-900">
            {title}
          </label>
        )}
        {description === undefined ? null : (
          <p className="pt-0.5 text-xs text-gray-400">{description}</p>
        )}
      </header>
      {children}
    </section>
  )
}
