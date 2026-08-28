import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { FigmaAsset } from '../components/FigmaAsset'
import { NEUTRAL_CHIP, STATE_CHIP } from '../design/tones'
import { findDataSource, readListSource, readObjectSourceOrNull } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, elementByNodeId, opsMeet05a } from '../spec/screens'
import type { ButtonSpec, InputSpec, ItemListSpec, SummarySpec } from '../spec/types'

// 진행 중 회의(OPS-MEET-05A).
//
// 이 그림도 보는 사람에 따라 갈린다(05A 일반 참가자 · 05B 진행 권한자). 주소는
// 하나이므로 여기서 그리는 것은 둘이 함께 갖는 자리뿐이다 — '회의 종료'·'이 안건
// 논의 완료'·'다음 안건 시작'·'내용 수정'은 05B 명세에 있고 아직 구현에 없다.
//
// **상태 이름도 안건 상태도 참가 딱지도 이 파일에 없다.** '진행 중'도 '논의 완료'도
// '15:00 참가'도 서버가 글과 색 이름을 함께 준다 — 상태가 하나 늘 때 화면이 조용히
// 틀리지 않는 유일한 모양이다.
//
// 명세가 가리킬 자리가 없어 화면이 데이터를 직접 보는 곳이 하나 있다:
// **지금 어느 안건인가**(meeting.agendas의 isCurrent)다. 본문은 그 안건 하나를
// 그리고 목록에서는 그 줄만 파랗다. 목록에서 하나를 골라 본문을 바꾸는 어휘가
// 아직 없어서(docs/decisions/meeting-model.md의 '보류') 명세는 이 사실을 말하지
// 못한다. 눌러서 다른 안건으로 바꾸는 것도 같은 이유로 아직 없다.
//
// 확정된 결정 카드의 초록(green-50 바탕 · green-950 글)은 design/tones.ts에 이름이
// 없어 여기 그대로 적는다. 하나뿐이고 데이터가 색 이름을 주지도 않는 자리다.

const SCREEN = 'OPS-MEET-05A'

const NODE = {
  viewerChip: '20:961',
  liveStrip: '20:967',
  agenda: '20:995',
  documents: '20:1007',
  documentOpen: '20:1015',
  discussionHeader: '20:1019',
  discussion: '20:1043',
  savedNote: '20:1045',
  attach: '20:1047',
  decisionHeader: '20:1056',
  addDecision: '20:1061',
  decision: '20:1071',
  followUpHeader: '20:1078',
  addTask: '20:1083',
  followUps: '20:1089',
  agendaListHeader: '20:1105',
  agendaList: '20:1110',
  peopleHeader: '20:1151',
  people: '20:1154',
} as const

// 어느 자리에 어떤 그림이 오는지는 명세가 아니라 design이 갖는다. 되풀이되는
// 자리는 첫 것의 nodeId를 본으로 쓴다.
const ASSET = {
  viewerChip: '20:962',
  present: '20:982',
  document: '20:1008',
  coeditors: '20:1026',
  attach: '20:1048',
  addDecision: '20:1062',
  addTask: '20:1084',
  followUpMark: '20:1090',
  followUpMenu: '20:1099',
} as const

const BREADCRUMB_SEPARATORS = ['20:950', '20:955']

// 줄 앞머리의 참가 점(20:1156 green-500 · 20:1174 gray-300). design/tones.ts에
// 아직 이 배합의 표가 없어 여기 둔다 — 딱지(STATE_CHIP)의 -50 바탕은 점으로
// 그리면 보이지 않는다. 톤 이름은 데이터가 준다(meeting.participants의
// attendanceTone): 두 번째 화면이 같은 점을 그리면 표로 옮길 자리다.
const PRESENCE_DOT: Record<string, string> = {
  green: 'bg-green-500',
  gray: 'bg-gray-300',
}
const NEUTRAL_DOT = 'bg-gray-300'

interface OPSMEET05AScreenProps {
  screenParams: Record<string, string>
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

function summaryAt(nodeId: string): SummarySpec {
  return elementByNodeId(opsMeet05a, nodeId).spec as SummarySpec
}

function listAt(nodeId: string): ItemListSpec {
  return elementByNodeId(opsMeet05a, nodeId).spec as ItemListSpec
}

function buttonAt(nodeId: string): ButtonSpec {
  return elementByNodeId(opsMeet05a, nodeId).spec as ButtonSpec
}

function scalar(row: DataRow, field: string | undefined): string {
  const value = field === undefined ? undefined : row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`OPS-MEET-05A의 '${field}' 조각은 한 줄의 값이어야 합니다.`)
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

export function OPSMEET05AScreen({ screenParams, onNavigate }: OPSMEET05AScreenProps) {
  // 논의 내용은 참가자가 함께 쓰는 칸이다. 보내는 단추가 그림에 없고(자동 저장)
  // 그 계약이 아직 없으므로 값은 이 화면 안에만 머문다.
  const [discussion, setDiscussion] = useState('')
  const [note, setNote] = useState<string | null>(null)

  const viewerChip = summaryAt(NODE.viewerChip)
  const liveStrip = summaryAt(NODE.liveStrip)
  const agenda = listAt(NODE.agenda)
  const documents = listAt(NODE.documents)
  const discussionHeader = summaryAt(NODE.discussionHeader)
  const discussionInput = elementByNodeId(opsMeet05a, NODE.discussion).spec as InputSpec
  const savedNote = summaryAt(NODE.savedNote)
  const decisionHeader = summaryAt(NODE.decisionHeader)
  const decision = listAt(NODE.decision)
  const followUpHeader = summaryAt(NODE.followUpHeader)
  const followUps = listAt(NODE.followUps)
  const agendaListHeader = summaryAt(NODE.agendaListHeader)
  const agendaList = listAt(NODE.agendaList)
  const peopleHeader = summaryAt(NODE.peopleHeader)
  const people = listAt(NODE.people)

  const meta = opsMeet05a.meta
  if (meta === undefined) {
    throw new Error('OPS-MEET-05A의 화면 카피가 없습니다.')
  }

  const press = (spec: ButtonSpec) => () => {
    if (spec.action.type === 'pending') {
      setNote(spec.action.note)
      return
    }
    if (spec.action.type === 'navigate') {
      onNavigate(spec.action.targetScreenId, resolveParams(spec.action.params, { screenParams }))
    }
  }

  // 무엇의 상세인지 모르면 상세가 없다. 인자가 비면 묻지도 않는다.
  const missingParam = (opsMeet05a.params ?? []).find(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )
  const detail =
    missingParam === undefined
      ? readObjectSourceOrNull(
          liveStrip.dataSourceKey,
          resolveParams(liveStrip.params, { screenParams }),
        )
      : null

  if (missingParam !== undefined || detail === null) {
    return (
      <AppShell
        screenId={opsMeet05a.screenId}
        activeNavigationScreenId={opsMeet05a.activeNavigationScreenId}
        eyebrow={meta.eyebrow}
        title={meta.title}
        description={meta.description}
        footerNote={meta.footerNote}
        onNavigate={onNavigate}
      >
        <p role="alert" className="text-sm text-red-700">
          {missingParam !== undefined
            ? missingParam.missingNote
            : findDataSource(liveStrip.dataSourceKey).messages.empty}
        </p>
      </AppShell>
    )
  }

  const agendaRows = readListSource(
    agenda.dataSourceKey,
    resolveParams(agenda.params, { screenParams }),
  )
  const documentRows = readListSource(
    documents.dataSourceKey,
    resolveParams(documents.params, { screenParams }),
  )
  const followUpRows = readListSource(
    followUps.dataSourceKey,
    resolveParams(followUps.params, { screenParams }),
  )
  const peopleRows = readListSource(
    people.dataSourceKey,
    resolveParams(people.params, { screenParams }),
  )

  // 본문이 그리는 것은 지금 진행 중인 안건 하나다. 어느 것인지는 데이터가 안다.
  const current = agendaRows.find((row) => String(row.isCurrent ?? '') !== '')
  const agendaField = (at: number) => agenda.columns?.[at]?.fields?.[0]
  const cardField = (at: number) => agendaList.columns?.[at]?.fields?.[0]
  const personField = (at: number) => people.columns?.[at]?.fields?.[0]
  const followUpField = (at: number) => followUps.columns?.[at]?.fields?.[0]
  const stripItem = (at: number) => (liveStrip.items ?? [])[at]?.field
  const openSpec = documents.itemFields?.[0]?.spec as ButtonSpec | undefined
  // 자료를 여는 것은 받아 가는 일이다. 이 저장소에는 파일을 건네줄 곳이 아직
  // 없으므로 어느 파일인지만 드러낸다 — 조용히 아무 일도 안 하면 아무도 모른다.
  const openDocument = (file: DataRow) => {
    const action = openSpec?.action
    if (action === undefined || action.type !== 'download') {
      return
    }
    setNote(`${openSpec?.label}: ${scalar(file, action.downloadField)}`)
  }
  const currentDocuments =
    current === undefined
      ? []
      : documentRows.filter((file) => file.agendaId === current.agendaId)

  const breadcrumb = opsMeet05a.breadcrumb

  return (
    <AppShell
      screenId={opsMeet05a.screenId}
      activeNavigationScreenId={opsMeet05a.activeNavigationScreenId}
      eyebrow={meta.eyebrow}
      title={drawnTitleOf(opsMeet05a, screenParams)}
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
      // 머리 오른쪽은 한 자리다. 여기서는 보는 사람과 이 회의의 관계를 말하는
      // 딱지가 오고, 05B에서는 같은 자리에 '회의 종료'가 온다.
      headerAction={
        <span
          data-node-id={NODE.viewerChip}
          data-design-state
          data-design-rule="state-chip"
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs ${
            STATE_CHIP[scalar(detail, viewerChip.toneField)] ?? NEUTRAL_CHIP
          }`}
        >
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.viewerChip} className="size-3.5" />
          {scalar(detail, viewerChip.titleField)}
        </span>
      }
      onNavigate={onNavigate}
    >
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 pb-8">
        {note === null ? null : (
          <p
            role="status"
            className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-xs text-yellow-800"
          >
            {note}
          </p>
        )}

        {/* 회의가 지금 어떤지. '진행 27분'은 사람이 아무것도 안 해도 자라는 값이라
            서버가 준 그대로 그리고 화면이 다시 세지 않는다. */}
        <section
          data-node-id={NODE.liveStrip}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3"
        >
          <span className="flex flex-wrap items-center gap-2">
            {(liveStrip.status ?? []).map((badge) => (
              <Chip
                key={badge.field}
                label={scalar(detail, badge.field)}
                tone={scalar(detail, badge.toneField)}
              />
            ))}
            <span className="text-xs font-semibold text-gray-700">
              {scalar(detail, stripItem(0))}
            </span>
            <span className="text-xs font-normal text-gray-400">·</span>
            <span className="text-xs font-normal text-gray-500">
              {scalar(detail, stripItem(1))}
            </span>
            <span className="text-xs font-normal text-gray-400">·</span>
            <span className="text-xs font-normal text-gray-500">
              {scalar(detail, stripItem(2))}
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.present} className="size-4" />
            <span className="text-xs font-semibold text-gray-700">
              {scalar(detail, stripItem(3))}
            </span>
            <span className="text-xs font-normal text-gray-400">
              {scalar(detail, stripItem(4))}
            </span>
          </span>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
          <div className="flex flex-col gap-4">
            {/* 지금 진행 중인 안건 하나. 안건이 갖는 것은 단계마다 다르고, 진행
                중에는 상태와 논의 내용과 결정이 함께 온다. */}
            <section className="rounded-xl border border-gray-200 bg-white px-5 py-5">
              {current === undefined ? (
                <p data-node-id={NODE.agenda} className="text-xs font-normal text-gray-400">
                  {findDataSource(agenda.dataSourceKey).messages.empty}
                </p>
              ) : (
                <div data-node-id={NODE.agenda}>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-blue-600">
                      {scalar(current, agendaField(0))}
                    </span>
                    <Chip
                      label={scalar(current, agendaField(1))}
                      tone={scalar(current, agenda.columns?.[1]?.toneField)}
                    />
                    <span className="text-xs font-normal text-gray-400">
                      {scalar(current, agendaField(2))}
                    </span>
                  </span>
                  <span className="block pt-3 text-lg font-bold text-gray-900">
                    {scalar(current, agendaField(3))}
                  </span>
                  <span className="block pt-2 text-xs font-normal text-gray-500">
                    {scalar(current, agendaField(4))}
                  </span>

                  {/* 사전 자료. 어느 안건의 것인지는 그 조각(agendaId)이 안다. */}
                  <span data-node-id={NODE.documents} className="block">
                    {currentDocuments.map((file) => (
                      <span
                        key={String(file.documentId)}
                        className="flex items-center gap-2 pt-4 text-xs font-normal text-blue-600"
                      >
                        <FigmaAsset
                          screenId={SCREEN}
                          nodeId={ASSET.document}
                          className="size-3.5"
                        />
                        <span>{scalar(file, documents.columns?.[0]?.fields?.[0])}</span>
                        {/* 받아 가는 것은 서버의 파일이다 — 보내는 것도 가는 것도
                            아니라 pending이 아니고 download다. 명세가 아는 것은
                            '어느 파일인가'까지이고 어떻게 건네는지는 플랫폼의 답이다. */}
                        <button
                          type="button"
                          data-node-id={NODE.documentOpen}
                          onClick={() => openDocument(file)}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          {openSpec?.label}
                        </button>
                      </span>
                    ))}
                  </span>
                </div>
              )}
            </section>

            {/* 논의 내용. '공동 작성 중'과 '15:24 정하늘 수정 · 자동 저장됨'은
                출처가 아직 없어 명세가 디자인의 글을 그대로 들고 있다. */}
            <section className="rounded-xl border border-gray-200 bg-white px-5 py-5">
              <div
                data-node-id={NODE.discussionHeader}
                className="flex items-start justify-between gap-4"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-gray-900">
                    {discussionHeader.title}
                  </span>
                  <span className="block pt-1 text-xs font-normal text-gray-400">
                    {discussionHeader.description}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <FigmaAsset screenId={SCREEN} nodeId={ASSET.coeditors} className="h-5" />
                  <span className="text-xs font-normal text-gray-400">
                    {drawnValue(discussionHeader, 0)}
                  </span>
                </span>
              </div>

              <textarea
                data-node-id={NODE.discussion}
                aria-label={discussionInput.label}
                value={discussion}
                onChange={(event) => setDiscussion(event.target.value)}
                rows={10}
                className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800"
              />

              <div className="flex items-center justify-between gap-4 pt-3">
                <span data-node-id={NODE.savedNote} className="text-xs font-normal text-gray-400">
                  {drawnValue(savedNote, 0)}
                </span>
                <button
                  type="button"
                  data-node-id={NODE.attach}
                  onClick={press(buttonAt(NODE.attach))}
                  className="flex items-center gap-1.5 text-xs font-medium text-blue-600"
                >
                  <FigmaAsset screenId={SCREEN} nodeId={ASSET.attach} className="size-3.5" />
                  {buttonAt(NODE.attach).label}
                </button>
              </div>
            </section>

            {/* 결정사항. 딱지('확정')와 '관련 담당자 · …'는 카탈로그에 조각이 없어
                명세가 가리키지 못한다 — 지어내지 않고 비워 둔다. */}
            <section className="rounded-xl border border-gray-200 bg-white px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <span data-node-id={NODE.decisionHeader} className="min-w-0">
                  <span className="block text-sm font-bold text-gray-900">
                    {decisionHeader.title}
                  </span>
                  <span className="block pt-1 text-xs font-normal text-gray-400">
                    {decisionHeader.description}
                  </span>
                </span>
                <button
                  type="button"
                  data-node-id={NODE.addDecision}
                  onClick={press(buttonAt(NODE.addDecision))}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <FigmaAsset screenId={SCREEN} nodeId={ASSET.addDecision} className="size-3.5" />
                  {buttonAt(NODE.addDecision).label}
                </button>
              </div>

              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-4">
                <p
                  data-node-id={NODE.decision}
                  className="text-sm font-semibold text-green-950"
                >
                  {current === undefined
                    ? findDataSource(decision.dataSourceKey).messages.empty
                    : scalar(current, decision.columns?.[0]?.fields?.[0])}
                </p>
              </div>
            </section>

            {/* 후속 업무. meeting.followUps에는 어느 안건의 것인지를 말하는 조각이
                없어 이 회의의 것을 그대로 그린다. */}
            <section className="rounded-xl border border-gray-200 bg-white px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <span data-node-id={NODE.followUpHeader} className="min-w-0">
                  <span className="block text-sm font-bold text-gray-900">
                    {followUpHeader.title}
                  </span>
                  <span className="block pt-1 text-xs font-normal text-gray-400">
                    {followUpHeader.description}
                  </span>
                </span>
                <button
                  type="button"
                  data-node-id={NODE.addTask}
                  onClick={press(buttonAt(NODE.addTask))}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <FigmaAsset screenId={SCREEN} nodeId={ASSET.addTask} className="size-3.5" />
                  {buttonAt(NODE.addTask).label}
                </button>
              </div>

              <ul className="pt-4">
                {followUpRows.length === 0 ? (
                  <li className="text-xs font-normal text-gray-400">
                    {findDataSource(followUps.dataSourceKey).messages.empty}
                  </li>
                ) : (
                  followUpRows.map((task, at) => (
                    <li
                      key={String(task.taskId)}
                      // 되풀이되는 자리는 첫 것의 nodeId를 본으로 쓴다.
                      data-node-id={at === 0 ? NODE.followUps : undefined}
                      className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3"
                    >
                      <FigmaAsset
                        screenId={SCREEN}
                        nodeId={ASSET.followUpMark}
                        className="size-5 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-gray-800">
                          {scalar(task, followUpField(0))}
                        </span>
                        <span className="block pt-0.5 text-xs font-normal text-gray-500">
                          {scalar(task, followUpField(1))}
                        </span>
                      </span>
                      <FigmaAsset
                        screenId={SCREEN}
                        nodeId={ASSET.followUpMenu}
                        className="size-4 shrink-0"
                      />
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>

          <div className="flex flex-col gap-4">
            <section className="rounded-xl border border-gray-200 bg-white">
              <div data-node-id={NODE.agendaListHeader} className="border-b border-gray-100 px-5 py-4">
                <span className="block text-sm font-bold text-gray-800">
                  {agendaListHeader.title}
                </span>
                <span className="block pt-1 text-xs font-normal text-gray-400">
                  {drawnValue(agendaListHeader, 0)}
                </span>
              </div>

              {/* 어느 줄이 '지금 이것'인지는 데이터가 안다. 눌러서 다른 안건으로
                  바꾸는 어휘가 아직 없어 명세는 이 목록을 읽기만 한다고 말한다. */}
              <ul data-node-id={NODE.agendaList} className="flex flex-col gap-2 px-4 py-4">
                {agendaRows.length === 0 ? (
                  <li className="text-xs font-normal text-gray-400">
                    {findDataSource(agendaList.dataSourceKey).messages.empty}
                  </li>
                ) : (
                  agendaRows.map((row) => {
                    const isCurrent = String(row.isCurrent ?? '') !== ''
                    return (
                      <li
                        key={String(row.agendaId)}
                        className={`rounded-lg border px-4 py-3 ${
                          isCurrent ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span
                            className={`text-xs font-bold ${
                              isCurrent ? 'text-blue-600' : 'text-gray-400'
                            }`}
                          >
                            {scalar(row, cardField(0))}
                          </span>
                          <Chip
                            label={scalar(row, cardField(1))}
                            tone={scalar(row, agendaList.columns?.[1]?.toneField)}
                          />
                        </span>
                        <span className="block pt-2 text-xs font-semibold text-gray-800">
                          {scalar(row, cardField(2))}
                        </span>
                        <span className="flex gap-3 pt-2">
                          <span className="text-xs font-medium text-gray-400">
                            {scalar(row, cardField(3))}
                          </span>
                          <span className="text-xs font-medium text-gray-400">
                            {scalar(row, cardField(4))}
                          </span>
                        </span>
                      </li>
                    )
                  })
                )}
              </ul>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white">
              <div data-node-id={NODE.peopleHeader} className="border-b border-gray-100 px-5 py-4">
                <span className="block text-sm font-bold text-gray-800">
                  {peopleHeader.title}
                </span>
              </div>

              {/* 참가 딱지의 글도 색 이름도 서버가 준다. design은 그 색을 줄
                  앞머리의 점으로 그렸다 — 딱지로 그릴지 점으로 그릴지는 명세가
                  정하지 않는다. */}
              <ul data-node-id={NODE.people} className="px-5 py-3">
                {peopleRows.length === 0 ? (
                  <li className="text-xs font-normal text-gray-400">
                    {findDataSource(people.dataSourceKey).messages.empty}
                  </li>
                ) : (
                  peopleRows.map((person) => (
                    <li key={String(person.memberId)} className="flex items-center gap-2 py-2">
                      <span
                        data-design-state
                        data-design-rule="state-chip"
                        aria-hidden="true"
                        className={`size-2 shrink-0 rounded-full ${
                          PRESENCE_DOT[scalar(person, people.columns?.[1]?.toneField)] ??
                          NEUTRAL_DOT
                        }`}
                      />
                      <span className="min-w-0 flex-1 text-xs font-normal text-gray-700">
                        {scalar(person, personField(0))}
                      </span>
                      <span className="shrink-0 text-xs font-normal text-gray-400">
                        {scalar(person, personField(1))}
                      </span>
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
