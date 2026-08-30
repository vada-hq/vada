import { useState } from 'react'
import type { ReactNode } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FigmaAsset } from '../components/FigmaAsset'
import { NEUTRAL_CHIP, STATE_CHIP, STATE_TEXT } from '../design/tones'
import { findDataSource, readListSource, readObjectSource } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { elementByNodeId, rec02 } from '../spec/screens'
import { targetScreenOf, paramsOf } from '../spec/types'
import type { DisplayAction, InputSpec, ItemListSpec, SummarySpec } from '../spec/types'
import type { ScopeDraft } from '../state/scopes'

// 행사 아카이브(REC-02). 발행된 인수인계 문서를 읽는 자리다.
//
// **명세가 침묵해서 화면이 알고 있는 것이 셋이다.**
//
// 1. **목차를 눌러 절로 가는 동작에 어휘가 없다.** navigate는 다른 화면으로 가는
//    것이고 pending은 '아직 안 정했다'라 거짓말이 된다 — 이 화면의 목차 여덟(그중
//    하나는 갈래 셋)과 REC-02A의 일곱이 그 어휘의 첫 두 사례다(보고서 참조).
//    그래서 목차는 이름만 그리고 누르는 자리가 아니며, **지금 어느 절에 있는지**는
//    design이 그린 그 자리(개요)에서 움직이지 않는다.
// 2. 인수인계 줄의 색. 주의사항만 주황이고 나머지는 무채색인데, 그것을 아는 것은
//    columns[0].toneField뿐이다 — 이름을 색으로 옮기는 일은 design/tones가 한다.
// 3. 묶음마다의 앞머리 그림(회고의 체크·경고·화살표). 어느 그림이 오는지는
//    design의 것이고 명세는 묶음 이름까지만 말한다.
//
// **체크리스트에는 저장 단추가 없다.** 그림 어디에도 없다 — 체크가 눌리는 순간
// 가는지 다른 무엇이 한꺼번에 보내는지 그림이 말하지 않으므로, 값은 명세가 말한
// 자리(archiveChecklistDraft)에 담기고 아무 데도 보내지 않는다. 회의록 정리
// (meetingMinutesDraft)가 이미 같은 처지다.

const SCREEN = 'REC-02'

const NODE = {
  head: '30:3595',
  toc: '30:3615',
  overview: '30:3649',
  outcome: '30:3679',
  timeline: '30:3704',
  onSite: '30:3757',
  evidence: '30:3782',
  evidenceNote: '30:3819',
  retro: '30:3821',
  handover: '30:3887',
  nextOwner: '30:3921',
  checklistHead: '30:3925',
  checklist: '30:3930',
} as const

const ASSET = {
  breadcrumbSeparators: ['30:3582', '30:3587'],
  // 회고 묶음의 앞머리. 줄마다 노드가 따로 뽑혀 있지만 그림은 묶음마다 하나뿐이라
  // 첫 벌만 지목한다(대조는 같은 그림을 묶어 본다).
  retro: ['30:3830', '30:3846', '30:3870'],
} as const

// 지금 어느 절에 있는가. **화면 안의 상태인데 옮길 방법이 없다** — 목차가 절로
// 데려가는 동작에 어휘가 없기 때문이다. design이 그린 자리를 처음 값으로 둔다.
const INITIAL_SECTION = 0

function scalar(row: DataRow, field: string | undefined): string {
  const value = row[field ?? '']
  if (value === undefined || Array.isArray(value)) {
    return ''
  }
  return String(value)
}

function rowsOf(row: DataRow, field: string | undefined): DataRow[] {
  const value = row[field ?? '']
  return Array.isArray(value) ? value : []
}

interface REC02ScreenProps {
  screenParams: Record<string, string>
  /** 명세가 stateScopeKey로 말한 자리(archiveChecklistDraft). 체크가 여기 산다. */
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

export function REC02Screen({
  screenParams,
  draft,
  onChangeDraft,
  onNavigate,
}: REC02ScreenProps) {
  const [note, setNote] = useState<string | null>(null)

  const missing = (rec02.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )

  if (missing.length > 0) {
    return (
      <AppShell
        screenId={rec02.screenId}
        activeNavigationScreenId={rec02.activeNavigationScreenId}
        eyebrow={rec02.meta?.eyebrow}
        title={rec02.meta?.title ?? rec02.screenId}
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

  const summaryAt = (nodeId: string) => elementByNodeId(rec02, nodeId).spec as SummarySpec
  const listAt = (nodeId: string) => elementByNodeId(rec02, nodeId).spec as ItemListSpec
  const objectOf = (spec: SummarySpec) =>
    readObjectSource(spec.dataSourceKey, resolveParams(spec.params, { screenParams }))
  const listOf = (spec: ItemListSpec) =>
    readListSource(spec.dataSourceKey, resolveParams(spec.params, { screenParams }))

  const head = summaryAt(NODE.head)
  const headRow = objectOf(head)
  const [schedule, owner, published, author, reviewer] = head.items ?? []

  const toc = listAt(NODE.toc)
  const tocRows = listOf(toc)
  const [tocLabel] = toc.columns ?? []
  const tocHeader = (toc.group?.headerFields ?? [])[0]
  const activeKey = scalar(tocRows[INITIAL_SECTION] ?? {}, 'key')

  const timeline = listAt(NODE.timeline)
  const [timelineDate, timelineTitle, timelineDescription] = timeline.columns ?? []

  const evidence = listAt(NODE.evidence)
  const [evidenceTitle, evidenceDetail] = evidence.columns ?? []

  const retro = listAt(NODE.retro)
  const [retroLabel, retroCause, retroOwner] = retro.columns ?? []

  const handover = listAt(NODE.handover)
  const [handoverLabel, handoverValue] = handover.columns ?? []

  const checklist = listAt(NODE.checklist)
  const checklistGroups = listOf(checklist)
  // 어느 열이 고치는 칸인지도 명세가 말한다(columns[].fieldKey). 그 이름으로
  // itemFields의 요소를 찾는다 — 자리로 집으면 열이 하나 늘 때 조용히 어긋난다.
  const [checkColumn, checkLabel] = checklist.columns ?? []
  const checklistField = (checklist.itemFields ?? []).find(
    (entry) => (entry.spec as InputSpec).fieldKey === checkColumn?.fieldKey,
  )
  const checklistBox = checklistField?.spec as InputSpec

  const openEvidence = (action: DisplayAction, row: DataRow) => () => {
    if (action.type === 'pending') {
      setNote(action.note)
      return
    }
    const target = targetScreenOf(action, row)
    if (target === null) return
    onNavigate(target, resolveParams(paramsOf(action), { screenParams, row }))
  }

  // 체크 값은 '목록이름.항목id.칸이름' 꼴로 담긴다 — 판정의 단위가 항목이다.
  const checkKey = (rowKey: string) =>
    `${checklist.fieldKey}.${rowKey}.${checklistBox.fieldKey}`
  const toggleCheck = (rowKey: string, next: boolean) =>
    onChangeDraft({
      values: { ...draft.values, [checkKey(rowKey)]: next ? 'true' : null },
      labels: draft.labels,
    })

  const breadcrumb = rec02.breadcrumb

  return (
    <AppShell
      screenId={rec02.screenId}
      activeNavigationScreenId={rec02.activeNavigationScreenId}
      eyebrow={rec02.meta?.eyebrow}
      title={rec02.meta?.title ?? rec02.screenId}
      onNavigate={onNavigate}
      breadcrumb={
        breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={[...ASSET.breadcrumbSeparators]}
            items={breadcrumb.items.map((item) =>
              item.value ?? scalar(headRow, item.field),
            )}
          />
        )
      }
    >
      {/* 문서의 머리. 누가 언제 쓰고 검토했는지는 서버가 완성한 문장으로 준다 —
          역할 이름을 명세가 들면 역할이 하나 늘 때마다 명세가 틀린다. */}
      <section
        data-node-id={NODE.head}
        className="flex items-start justify-between gap-6 rounded-xl border border-gray-200 bg-white px-6 py-5"
      >
        <div>
          <span className="flex items-center gap-3">
            <span
              data-design-rule="state-chip"
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                STATE_CHIP[scalar(headRow, (head.status ?? [])[0]?.toneField)] ?? NEUTRAL_CHIP
              }`}
            >
              {scalar(headRow, (head.status ?? [])[0]?.field)}
            </span>
            <span className="text-xs text-gray-400">{scalar(headRow, schedule?.field)}</span>
          </span>
          <h2 className="pt-2 text-xl font-bold text-gray-900">
            {scalar(headRow, head.titleField)}
          </h2>
          <p className="pt-1 text-sm text-gray-500">{scalar(headRow, owner?.field)}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className="block text-xs text-gray-400">
            {scalar(headRow, published?.field)}
          </span>
          <span className="block pt-1 text-xs text-gray-500">
            {scalar(headRow, author?.field)}
          </span>
          <span className="block pt-1 text-xs text-gray-500">
            {scalar(headRow, reviewer?.field)}
          </span>
        </div>
      </section>

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
              const current = scalar(section, 'key') === activeKey
              return (
                <li key={scalar(section, 'key')}>
                  <span
                    aria-current={current ? 'true' : undefined}
                    className={`block rounded px-2 py-1.5 text-xs ${
                      current
                        ? 'bg-blue-50 font-semibold text-blue-700'
                        : 'font-medium text-gray-600'
                    }`}
                  >
                    {scalar(section, (tocHeader?.fields ?? [])[0])}
                  </span>
                  {rowsOf(section, toc.group?.itemsField).map((child) => (
                    <span
                      key={scalar(child, 'key')}
                      className="block px-4 py-1.5 text-xs font-medium text-gray-500"
                    >
                      {scalar(child, (tocLabel?.fields ?? [])[0])}
                    </span>
                  ))}
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="flex flex-col gap-4">
          <LabelledSection
            nodeId={NODE.overview}
            spec={summaryAt(NODE.overview)}
            row={objectOf(summaryAt(NODE.overview))}
            current={activeKey === 'overview'}
          />
          <LabelledSection
            nodeId={NODE.outcome}
            spec={summaryAt(NODE.outcome)}
            row={objectOf(summaryAt(NODE.outcome))}
            current={activeKey === 'outcome'}
          />

          <SectionCard nodeId={NODE.timeline} title={timeline.title} current={false}>
            {listOf(timeline).map((row) => (
              <div key={scalar(row, 'id')} className="flex gap-4 px-6 py-3">
                <span className="w-14 shrink-0 pt-0.5 text-xs text-gray-400">
                  {scalar(row, (timelineDate?.fields ?? [])[0])}
                </span>
                <span className="block border-l border-gray-100 pl-4">
                  <span className="block text-sm font-semibold text-gray-800">
                    {scalar(row, (timelineTitle?.fields ?? [])[0])}
                  </span>
                  <span className="block pt-0.5 text-xs text-gray-500">
                    {scalar(row, (timelineDescription?.fields ?? [])[0])}
                  </span>
                </span>
              </div>
            ))}
          </SectionCard>

          <LabelledSection
            nodeId={NODE.onSite}
            spec={summaryAt(NODE.onSite)}
            row={objectOf(summaryAt(NODE.onSite))}
            current={activeKey === 'onSite'}
          />

          <SectionCard nodeId={NODE.evidence} title={evidence.title} current={false}>
            {listOf(evidence).map((row) => {
              const label =
                evidence.itemAction?.labelField === undefined
                  ? ''
                  : scalar(row, evidence.itemAction.labelField)
              return (
                <div
                  key={scalar(row, 'id')}
                  className="flex items-center justify-between gap-4 border-b border-gray-100 px-6 py-3 last:border-b-0"
                >
                  <span>
                    <span className="block text-sm font-semibold text-gray-800">
                      {scalar(row, (evidenceTitle?.fields ?? [])[0])}
                    </span>
                    <span className="block pt-0.5 text-xs text-gray-500">
                      {scalar(row, (evidenceDetail?.fields ?? [])[0])}
                    </span>
                  </span>
                  {label === '' || evidence.itemAction === undefined ? null : (
                    <button
                      type="button"
                      onClick={openEvidence(evidence.itemAction, row)}
                      className="shrink-0 rounded text-xs font-medium text-blue-600 hover:underline focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
                    >
                      {label}
                    </button>
                  )}
                </div>
              )
            })}
            <p data-node-id={NODE.evidenceNote} className="px-6 py-3 text-xs text-gray-400">
              {summaryAt(NODE.evidenceNote).title}
            </p>
          </SectionCard>

          <SectionCard nodeId={NODE.retro} title={retro.title} current={false}>
            {listOf(retro).map((group, index) => (
              <div
                key={scalar(group, 'groupLabel')}
                className={`px-6 py-4 ${index === 0 ? '' : 'border-t border-gray-100'}`}
              >
                <span className="block text-xs font-bold text-gray-400">
                  {scalar(group, ((retro.group?.headerFields ?? [])[0]?.fields ?? [])[0])}
                </span>
                {rowsOf(group, retro.group?.itemsField).map((row) => (
                  <div key={scalar(row, 'key')} className="flex items-start gap-2 pt-2">
                    <FigmaAsset
                      screenId={SCREEN}
                      nodeId={ASSET.retro[index] ?? ASSET.retro[0]}
                      className="mt-0.5 size-3.5 shrink-0"
                    />
                    <span className="block">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-gray-700">
                          {scalar(row, (retroLabel?.fields ?? [])[0])}
                        </span>
                        {scalar(row, (retroOwner?.fields ?? [])[0]) === '' ? null : (
                          <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {scalar(row, (retroOwner?.fields ?? [])[0])}
                          </span>
                        )}
                      </span>
                      {scalar(row, (retroCause?.fields ?? [])[0]) === '' ? null : (
                        <span className="block pt-1 text-xs text-gray-500">
                          {scalar(row, (retroCause?.fields ?? [])[0])}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </SectionCard>

          <SectionCard nodeId={NODE.handover} title={handover.title} current={false}>
            {listOf(handover).map((group, index) => (
              <div
                key={scalar(group, 'groupLabel')}
                className={`px-6 py-4 ${index === 0 ? '' : 'border-t border-gray-100'}`}
              >
                <span className="block text-xs font-bold text-gray-400">
                  {scalar(group, ((handover.group?.headerFields ?? [])[0]?.fields ?? [])[0])}
                </span>
                {rowsOf(group, handover.group?.itemsField).map((row) => {
                  const value = scalar(row, (handoverValue?.fields ?? [])[0])
                  const tone = scalar(row, handoverLabel?.toneField)
                  return (
                    <span
                      key={scalar(row, 'key')}
                      className="flex items-baseline gap-4 pt-2"
                    >
                      <span
                        className={`text-sm ${
                          value === ''
                            ? (STATE_TEXT[tone] ?? 'text-gray-700')
                            : 'w-28 shrink-0 text-xs text-gray-400'
                        }`}
                      >
                        {scalar(row, (handoverLabel?.fields ?? [])[0])}
                      </span>
                      {value === '' ? null : (
                        <span className="text-sm text-gray-700">{value}</span>
                      )}
                    </span>
                  )
                })}
              </div>
            ))}
            <p
              data-node-id={NODE.nextOwner}
              className="border-t border-gray-100 px-6 py-3 text-sm font-semibold text-gray-700"
            >
              {scalar(
                objectOf(summaryAt(NODE.nextOwner)),
                (summaryAt(NODE.nextOwner).items ?? [])[0]?.field,
              )}
            </p>
          </SectionCard>
        </div>

        {/* 인수인계 체크리스트. 부서별로 묶여 오고, 무엇을 확인하는지는 그 행사의
            인수인계 내용이 정한다. */}
        <aside className="h-fit rounded-xl border border-gray-200 bg-white">
          <div data-node-id={NODE.checklistHead} className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-bold text-gray-800">
              {summaryAt(NODE.checklistHead).title}
            </h2>
            <p className="pt-0.5 text-xs text-gray-400">
              {summaryAt(NODE.checklistHead).description}
            </p>
          </div>
          <div data-node-id={NODE.checklist} className="px-5 py-4">
            {checklistGroups.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-500">
                {findDataSource(checklist.dataSourceKey).messages.empty}
              </p>
            ) : (
              checklistGroups.map((group, groupIndex) => (
                <div key={scalar(group, 'groupLabel')} className="pb-4 last:pb-0">
                  <span className="block text-xs font-bold text-blue-600">
                    {scalar(group, ((checklist.group?.headerFields ?? [])[0]?.fields ?? [])[0])}
                  </span>
                  {rowsOf(group, checklist.group?.itemsField).map((row, rowIndex) => {
                    const rowKey = scalar(row, 'key')
                    const stored = draft.values[checkKey(rowKey)]
                    const checked =
                      stored === undefined || stored === null
                        ? scalar(row, 'done') === 'true'
                        : stored === 'true'
                    return (
                      <label
                        key={rowKey}
                        // 되풀이되는 칸은 **첫 벌만** 등록 노드를 갖는다.
                        data-node-id={
                          groupIndex === 0 && rowIndex === 0
                            ? checklistField?.source?.nodeId
                            : undefined
                        }
                        className="flex items-center gap-2 pt-2"
                      >
                        <input
                          type={checklistBox.inputType}
                          checked={checked}
                          aria-label={scalar(row, (checkLabel?.fields ?? [])[0])}
                          onChange={(event) => toggleCheck(rowKey, event.target.checked)}
                          className="size-3.5 shrink-0 rounded border-gray-300"
                        />
                        <span className="text-xs font-medium text-gray-600">
                          {scalar(row, (checkLabel?.fields ?? [])[0])}
                        </span>
                      </label>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      {note === null ? null : (
        <p role="status" className="pb-6 text-xs text-gray-500">
          {note}
        </p>
      )}
    </AppShell>
  )
}

interface SectionCardProps {
  nodeId: string
  title: string | undefined
  /** 지금 있는 절인가. design이 그 칸만 파란 테두리로 그린다. */
  current: boolean
  children: ReactNode
}

function SectionCard({ nodeId, title, current, children }: SectionCardProps) {
  return (
    <section
      data-node-id={nodeId}
      className={`overflow-hidden rounded-xl border bg-white ${
        current ? 'border-blue-300' : 'border-gray-200'
      }`}
    >
      <header className="border-b border-gray-100 bg-gray-50 px-6 py-3">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      </header>
      {children}
    </section>
  )
}

interface LabelledSectionProps {
  nodeId: string
  spec: SummarySpec
  row: DataRow
  current: boolean
}

// 라벨이 명세에 고정된 절(개요·성과·현장 운영). 무엇을 적는 자리인지가 문서
// 서식으로 정해져 있어 라벨은 명세가 갖고 값만 서버가 준다.
function LabelledSection({ nodeId, spec, row, current }: LabelledSectionProps) {
  return (
    <SectionCard nodeId={nodeId} title={spec.title} current={current}>
      <dl className="px-6 py-4">
        {(spec.items ?? []).map((item) => (
          <div key={item.field} className="flex items-baseline gap-4 py-1.5">
            <dt className="w-32 shrink-0 text-xs text-gray-400">{item.label}</dt>
            <dd className="text-sm text-gray-700">{scalar(row, item.field)}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  )
}
