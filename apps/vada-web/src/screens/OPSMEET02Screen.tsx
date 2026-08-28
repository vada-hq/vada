import { useState } from 'react'
import type { ReactNode } from 'react'
import { AppShell } from '../components/AppShell'
import { ChoiceGroup } from '../components/ChoiceGroup'
import { Field } from '../components/Field'
import { FigmaAsset } from '../components/FigmaAsset'
import { SearchSelect } from '../components/SearchSelect'
import { TextInput } from '../components/TextInput'
import { STATE_CHIP } from '../design/tones'
import { readListSource, readObjectSource } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import {
  evaluateButtonExecution,
  getRequiredFieldCandidates,
  hasFieldValue,
} from '../../../../packages/contracts/src/button-execution.mjs'
import { computeNumber, formatComputed, itemKey, joinRowIds, rowIdsOf } from '../spec/compute'
import { getMutation } from '../spec/mutations'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, elementByNodeId, opsMeet02 } from '../spec/screens'
import { useSubmitAction } from '../spec/useSubmitAction'
import type {
  ButtonSpec,
  GroupSpec,
  InputSpec,
  ListSpec,
  SelectSpec,
  SubmitAction,
  SummarySpec,
} from '../spec/types'
import type { ScopeDraft } from '../state/scopes'

// 회의 생성·수정(OPS-MEET-02).
//
// 이 계열에서 가장 큰 화면이고, 되풀이되는 묶음이 **둘**이다. 그런데 둘의 성격이
// 갈린다 - 안건은 사람이 칸을 채우는 묶음이라 명세가 틀(list.itemFields)을 갖고,
// 참가자는 **고르는 것이지 쓰는 것이 아니라서** 명세에 담을 칸이 없다. 줄에
// 그려지는 이름·소속·딱지·단추 글은 전부 데이터가 준다(meeting.draft.participants).
//
// 그래서 참가자 목록은 list이되 itemFields가 없다. 지금 어휘로는 '항목이 무엇을
// 보여주는지'를 명세가 말할 방법이 없다 - summary는 field를 가리키려면 출처가
// 있어야 하는데(checkDataSource) list에는 출처가 없다. 지어내는 대신 비워 두었고
// 보고서에 적었다.
//
// 새 어휘 둘이 여기서 처음 쓰인다: inputType checkbox(비공개 회의 스위치)와
// multiline(회의 목적·안건 설명). 둘 다 명세가 이미 갖고 있던 자리인데 받을
// 조작이 없어 비어 있던 것이다.

const SCREEN = 'OPS-MEET-02'

const NODE = {
  heading: '18:2338',
  typeGroup: '18:2343',
  meetingType: '18:2352',
  linkedEventId: '18:2370',
  basicGroup: '18:2378',
  title: '18:2388',
  hostName: '18:2394',
  departmentId: '18:2400',
  statusLabel: '18:2408',
  purpose: '18:2415',
  scheduleGroup: '18:2420',
  date: '18:2430',
  startTime: '18:2435',
  endTime: '18:2440',
  mode: '18:2445',
  place: '18:2454',
  onlineLink: '18:2460',
  peopleGroup: '18:2467',
  selectedCount: '18:2477',
  isPrivate: '18:2479',
  memberQuery: '18:2492',
  participants: '18:2500',
  hostRoleNote: '18:2574',
  minutesNote: '18:2582',
  agendaGroup: '18:2584',
  agendaItems: '18:2599',
  cancel: '18:2774',
  saveDraft: '18:2776',
  create: '18:2778',
} as const

// 안건 항목의 칸. 명세가 적은 것은 첫째 안건의 노드이고, 화면도 첫째에만 끈을 단다.
const AGENDA_NODE = {
  agendaTitle: '18:2619',
  agendaNote: '18:2625',
  attachmentName: '18:2629',
  duration: '18:2649',
} as const

// 어떤 자리에 어떤 그림이 오는지는 명세가 아니라 design이 갖는다. 되풀이되는 자리는
// 첫 것의 nodeId를 본으로 쓴다 - 같은 그림이면 하나만 그려도 대조가 통과한다.
const ASSET = {
  chevron: '18:2376',
  search: '18:2489',
  addMember: '18:2496',
  avatar: '18:2502',
  removeRow: '18:2532',
  hostRoleNote: '18:2575',
  addAgenda: '18:2595',
  dragHandle: '18:2602',
  fileIcon: '18:2631',
  upload: '18:2643',
  createCheck: '18:2779',
} as const

const CHIP_SEPARATOR = ';'
const CHIP_FIELD_SEPARATOR = '|'

interface Chip {
  label: string
  tone: string
}

function encodeChips(value: unknown): string {
  if (!Array.isArray(value)) {
    return ''
  }
  return value
    .map((chip) => {
      const row = chip as DataRow
      return `${String(row.label ?? '')}${CHIP_FIELD_SEPARATOR}${String(row.tone ?? 'gray')}`
    })
    .join(CHIP_SEPARATOR)
}

function decodeChips(raw: string | null | undefined): Chip[] {
  if (!raw) {
    return []
  }
  return raw.split(CHIP_SEPARATOR).map((part) => {
    const [label, tone] = part.split(CHIP_FIELD_SEPARATOR)
    return { label, tone: tone ?? 'gray' }
  })
}

// 읽어 온 회의를 초안으로 옮긴다(draftFrom).
//
// 되풀이되는 묶음은 줄 이름을 하나씩 붙여 평평하게 담는다(compute.ts의 itemKey).
// 참가자 줄의 딱지만 한 겹 더 깊다 - 값이 글이 아니라 {말, 색 이름}의 목록이라
// 한 줄로 접어 담고 그릴 때 다시 편다.
function draftFromRow(row: DataRow): ScopeDraft {
  const values: Record<string, string | null> = {}

  for (const [key, value] of Object.entries(row)) {
    if (!Array.isArray(value)) {
      values[key] = String(value)
      continue
    }
    const rowIds: string[] = []
    value.forEach((item, index) => {
      const rowId = `r${index}`
      rowIds.push(rowId)
      for (const [field, fieldValue] of Object.entries(item as DataRow)) {
        values[itemKey(key, rowId, field)] = Array.isArray(fieldValue)
          ? encodeChips(fieldValue)
          : String(fieldValue)
      }
    })
    values[key] = joinRowIds(rowIds)
  }

  return { values, labels: {} }
}

function nextRowId(rowIds: string[]): string {
  const used = new Set(rowIds)
  for (let index = 0; ; index += 1) {
    const candidate = `r${index}`
    if (!used.has(candidate)) {
      return candidate
    }
  }
}

interface OPSMEET02ScreenProps {
  screenParams: Record<string, string>
  /** 명세가 stateScopeKey로 말한 자리(meetingDraft). 쓰던 것은 여기 남는다. */
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
}

export function OPSMEET02Screen({
  screenParams,
  draft: scopeDraft,
  onChangeDraft,
  onNavigate,
  onScopeEvent,
}: OPSMEET02ScreenProps) {
  const participantList = elementByNodeId(opsMeet02, NODE.participants).spec as ListSpec
  const agendaList = elementByNodeId(opsMeet02, NODE.agendaItems).spec as ListSpec

  // 새로 쓰는 것도 읽는다 - 아직 아무것도 적히지 않은 회의가 오고, 그 안에 서버가
  // 이미 아는 것(주최자·회의 상태)이 들어 있다.
  const [seed] = useState<ScopeDraft>(() =>
    draftFromRow(
      readObjectSource(
        opsMeet02.draftFrom!.dataSourceKey,
        resolveParams(opsMeet02.draftFrom!.params, { screenParams }),
      ),
    ),
  )
  const draft = Object.keys(scopeDraft.values).length === 0 ? seed : scopeDraft
  const setDraft = (update: (previous: ScopeDraft) => ScopeDraft) => {
    onChangeDraft(update(draft))
  }

  const [note, setNote] = useState<string | null>(null)
  const [blockedKeys, setBlockedKeys] = useState<string[]>([])
  const submitAction = useSubmitAction()

  const participantRowIds = rowIdsOf(draft, participantList.fieldKey)
  const agendaRowIds = rowIdsOf(draft, agendaList.fieldKey)
  const agendaFields = agendaList.itemFields ?? []

  function setValue(key: string, value: string, label?: string) {
    setDraft((previous) => ({
      values: { ...previous.values, [key]: value },
      labels: label === undefined ? previous.labels : { ...previous.labels, [key]: label },
    }))
  }

  function valueOf(key: string): string {
    return draft.values[key] ?? ''
  }

  // 참가자는 쓰는 것이 아니라 고르는 것이다. 검색어에 맞는 사람 중 아직 넣지 않은
  // 첫 사람을 넣는다 - **고른 뒤 무엇이 그려지는지를 design이 그리지 않았으므로**
  // 후보 목록을 지어내 그리지 않는다.
  function addParticipant() {
    const chosen = readListSource('meeting.memberCandidates', {
      query: valueOf('memberQuery'),
    }).find(
      (candidate) =>
        !participantRowIds.some(
          (rowId) =>
            valueOf(itemKey(participantList.fieldKey, rowId, 'memberId')) ===
            String(candidate.memberId),
        ),
    )
    if (chosen === undefined) {
      setNote('넣을 수 있는 구성원이 없습니다.')
      return
    }
    const rowId = nextRowId(participantRowIds)
    setDraft((previous) => ({
      values: {
        ...previous.values,
        [itemKey(participantList.fieldKey, rowId, 'memberId')]: String(chosen.memberId),
        [itemKey(participantList.fieldKey, rowId, 'name')]: String(chosen.name),
        [itemKey(participantList.fieldKey, rowId, 'departmentNote')]: String(
          chosen.departmentNote,
        ),
        // 딱지와 줄 단추의 글은 서버가 준다. 없는 것을 지어내지 않는다.
        [itemKey(participantList.fieldKey, rowId, 'chips')]: '',
        [itemKey(participantList.fieldKey, rowId, 'canRemove')]: 'y',
        [participantList.fieldKey]: joinRowIds([...participantRowIds, rowId]),
      },
      labels: previous.labels,
    }))
    setNote(null)
  }

  function removeRow(list: ListSpec, rowIds: string[], rowId: string) {
    setDraft((previous) => {
      const values = { ...previous.values }
      for (const key of Object.keys(values)) {
        if (key.startsWith(`${list.fieldKey}.${rowId}.`)) {
          delete values[key]
        }
      }
      values[list.fieldKey] = joinRowIds(rowIds.filter((id) => id !== rowId))
      return { values, labels: previous.labels }
    })
  }

  function addAgenda() {
    const rowId = nextRowId(agendaRowIds)
    setDraft((previous) => {
      const values = { ...previous.values }
      for (const field of agendaFields) {
        const spec = field.spec
        if (spec.type === 'input' || spec.type === 'select') {
          values[itemKey(agendaList.fieldKey, rowId, spec.fieldKey)] = spec.initialValue ?? ''
        }
      }
      values[agendaList.fieldKey] = joinRowIds([...agendaRowIds, rowId])
      return { values, labels: previous.labels }
    })
  }

  // 되풀이되는 묶음의 값이 찼는지는 이 화면만 안다(항목마다 값이 갈리고 몇 개인지는
  // 사람이 정한다). 참가자 목록에는 채울 칸이 없으므로 안건만 본다.
  const isFilled = (candidate: { fieldKey: string; inList: string | null }) => {
    if (candidate.inList === null) {
      return hasFieldValue(draft.values[candidate.fieldKey])
    }
    const rowIds = rowIdsOf(draft, candidate.inList)
    return rowIds.every((rowId) =>
      hasFieldValue(draft.values[itemKey(candidate.inList as string, rowId, candidate.fieldKey)]),
    )
  }

  // 사람에게는 fieldKey가 아니라 라벨로 말한다.
  const labelOfField = (fieldKey: string) =>
    getRequiredFieldCandidates(opsMeet02.elements).find(
      (candidate) => candidate.fieldKey === fieldKey,
    )?.label ?? fieldKey

  function pressButton(button: ButtonSpec) {
    if (button.action.type === 'pending') {
      setNote(button.action.note)
      return
    }
    const verdict = evaluateButtonExecution({
      action: button.action,
      elements: opsMeet02.elements,
      values: draft.values,
      isFilled,
    })
    if (!verdict.allowed) {
      setBlockedKeys(verdict.missingFieldKeys)
      return
    }
    setBlockedKeys([])
    setNote(null)
    void submitAction.run(button.action as SubmitAction, {
      payload: draft.values,
      onNavigate,
      onScopeEvent,
    })
  }

  // --- 자리 만들기 ----------------------------------------------------------

  const headingSpec = elementByNodeId(opsMeet02, NODE.heading).spec as SummarySpec
  const countSpec = elementByNodeId(opsMeet02, NODE.selectedCount).spec as SummarySpec
  const countItem = countSpec.items![0]
  // 항목 안의 칸도 명세의 요소다. elementByNodeId는 최상위만 보므로 안건의 틀은
  // 여기서 함께 찾는다 — 되풀이되는 칸의 라벨·필수 여부도 명세가 갖는다.
  const specOf = (nodeId: string) => {
    const inItem = agendaFields.find((entry) => entry.source.nodeId === nodeId)
    return inItem === undefined ? elementByNodeId(opsMeet02, nodeId).spec : inItem.spec
  }

  function sectionHeader(nodeId: string, step: number) {
    const group = specOf(nodeId) as GroupSpec
    return (
      <div className="flex items-start gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-xs font-bold text-blue-600">
          {step}
        </span>
        <span>
          <span className="block text-sm font-bold text-gray-900">{group.title}</span>
          <span className="block pt-0.5 text-xs text-gray-400">{group.description}</span>
        </span>
      </div>
    )
  }

  function section(nodeId: string, step: number, children: ReactNode) {
    const group = specOf(nodeId) as GroupSpec
    return (
      <section
        data-node-id={nodeId}
        aria-label={group.title}
        className="rounded-xl border border-gray-200 bg-white p-5"
      >
        {sectionHeader(nodeId, step)}
        <div className="pt-5">{children}</div>
      </section>
    )
  }

  function inputField(nodeId: string, options: { rowId?: string; listKey?: string } = {}) {
    const spec = specOf(nodeId) as InputSpec
    const key =
      options.rowId === undefined
        ? spec.fieldKey
        : itemKey(options.listKey!, options.rowId, spec.fieldKey)
    const id = options.rowId === undefined ? spec.fieldKey : key
    return (
      <Field
        htmlFor={id}
        nodeId={options.rowId === undefined || options.rowId === agendaRowIds[0] ? nodeId : undefined}
        label={spec.label}
        required={spec.required}
        helperText={spec.helperText}
      >
        {spec.multiline === true ? (
          // 디자인이 Text Area로 그린 자리(input.multiline). 한 줄짜리로 그리면
          // '긴 글'이라는 사실이 화면에서 사라진다.
          <textarea
            id={id}
            value={valueOf(key)}
            placeholder={spec.placeholder ?? undefined}
            rows={3}
            onChange={(event) => setValue(key, event.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none"
          />
        ) : (
          <TextInput
            id={id}
            value={valueOf(key)}
            placeholder={spec.placeholder}
            type={spec.inputType}
            readOnly={spec.readOnly}
            onChange={(next) => setValue(key, next)}
          />
        )}
      </Field>
    )
  }

  function selectField(nodeId: string, options: { rowId?: string; listKey?: string } = {}) {
    const spec = specOf(nodeId) as SelectSpec
    const key =
      options.rowId === undefined
        ? spec.fieldKey
        : itemKey(options.listKey!, options.rowId, spec.fieldKey)
    const stored = valueOf(key)
    return (
      <Field
        htmlFor={key}
        nodeId={options.rowId === undefined || options.rowId === agendaRowIds[0] ? nodeId : undefined}
        label={spec.label}
        required={spec.required}
        helperText={spec.helperText}
      >
        <SearchSelect
          id={key}
          placeholder={spec.placeholder}
          searchable={spec.searchable}
          disabled={spec.initiallyDisabled}
          sourceKey={spec.optionsSource.key}
          sourceParams={resolveParams(spec.optionsSource.params, { screenParams })}
          value={stored === '' ? null : { value: stored, label: draft.labels[key] ?? stored }}
          onSelect={(option) => setValue(key, option.value, option.label)}
          chevron={<FigmaAsset screenId={SCREEN} nodeId={ASSET.chevron} className="size-4" />}
        />
      </Field>
    )
  }

  function participantRow(rowId: string) {
    const at = (field: string) => valueOf(itemKey(participantList.fieldKey, rowId, field))
    const chips = decodeChips(at('chips'))
    const actionLabel = at('actionLabel')
    const actionEmphasis = at('actionEmphasis')
    return (
      <div
        key={rowId}
        className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"
      >
        <FigmaAsset screenId={SCREEN} nodeId={ASSET.avatar} className="size-7 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-gray-800">{at('name')}</span>
            {chips.map((chip) => (
              <span
                key={chip.label}
                className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  STATE_CHIP[chip.tone] ?? STATE_CHIP.gray
                }`}
              >
                {chip.label}
              </span>
            ))}
          </span>
          <span className="block pt-0.5 text-xs text-gray-400">{at('departmentNote')}</span>
        </span>
        {/* 줄 단추의 글은 줄마다 갈린다 - 명세가 들지 않고 데이터가 준다. */}
        {actionLabel === '' ? null : (
          <button
            type="button"
            onClick={() => setNote(`'${actionLabel}'가 무엇을 보내는지 디자인에 없습니다.`)}
            className={`shrink-0 text-xs font-medium ${
              actionEmphasis === 'danger' ? 'text-red-500' : 'text-blue-600'
            }`}
          >
            {actionLabel}
          </button>
        )}
        {at('canRemove') === '' ? null : (
          <button
            type="button"
            aria-label={`${at('name')} ${participantList.itemNoun}에서 빼기`}
            onClick={() => removeRow(participantList, participantRowIds, rowId)}
            className="shrink-0"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.removeRow} className="size-3.5" />
          </button>
        )}
      </div>
    )
  }

  function agendaCard(rowId: string, index: number) {
    const first = index === 0
    const attachmentSpec = specOf(AGENDA_NODE.attachmentName) as InputSpec
    const attachmentKey = itemKey(agendaList.fieldKey, rowId, attachmentSpec.fieldKey)
    const titleValue = valueOf(itemKey(agendaList.fieldKey, rowId, agendaList.itemTitleFieldKey!))
    return (
      <div
        key={rowId}
        data-node-id={first ? NODE.agendaItems : undefined}
        className="rounded-xl border border-gray-200 bg-white"
      >
        {/* 항목 머리는 순번과 이름이다. 순번은 자리에서 나오고 이름은 칸에서 나온다. */}
        <div className="flex items-center gap-2 rounded-t-xl border-b border-gray-200 bg-gray-50 px-4 py-2.5">
          <FigmaAsset screenId={SCREEN} nodeId={ASSET.dragHandle} className="size-3.5" />
          <span className="flex size-5 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-600">
            {index + 1}
          </span>
          <span className="flex-1 text-sm font-bold text-gray-800">{titleValue}</span>
          <button
            type="button"
            aria-label={`${agendaList.itemNoun} ${index + 1} 삭제`}
            onClick={() => removeRow(agendaList, agendaRowIds, rowId)}
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.removeRow} className="size-3.5" />
          </button>
        </div>

        <div className="flex gap-4 p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {inputField(AGENDA_NODE.agendaTitle, { rowId, listKey: agendaList.fieldKey })}
            {inputField(AGENDA_NODE.agendaNote, { rowId, listKey: agendaList.fieldKey })}
            {/* 사전 자료. 값이 글이 아니라 고른 파일이고, 그려지는 것은 그 이름이다. */}
            <div
              data-node-id={first ? AGENDA_NODE.attachmentName : undefined}
              className="flex items-center gap-3 rounded-lg border border-gray-300 px-3 py-2.5"
            >
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.fileIcon} className="size-3.5" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-gray-700">
                  {valueOf(attachmentKey) === ''
                    ? attachmentSpec.placeholder
                    : valueOf(attachmentKey)}
                </span>
                <span className="block text-xs text-gray-400">{attachmentSpec.label}</span>
              </span>
              <label
                htmlFor={attachmentKey}
                className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700"
              >
                <FigmaAsset screenId={SCREEN} nodeId={ASSET.upload} className="size-3" />
                자료 추가
                <input
                  id={attachmentKey}
                  type="file"
                  className="sr-only"
                  onChange={(event) =>
                    setValue(attachmentKey, event.target.files?.[0]?.name ?? '')
                  }
                />
              </label>
            </div>
          </div>
          <div className="w-40 shrink-0">
            {selectField(AGENDA_NODE.duration, { rowId, listKey: agendaList.fieldKey })}
          </div>
        </div>
      </div>
    )
  }

  function actionButton(nodeId: string, className: string, icon?: string) {
    const spec = specOf(nodeId) as ButtonSpec
    const running =
      spec.action.type === 'submit' && submitAction.runningKey === spec.action.mutationKey
    return (
      <button
        key={nodeId}
        type="button"
        data-node-id={nodeId}
        onClick={() => pressButton(spec)}
        className={className}
      >
        {icon === undefined ? null : (
          <FigmaAsset screenId={SCREEN} nodeId={icon} className="size-3.5" />
        )}
        {running
          ? getMutation((spec.action as SubmitAction).mutationKey).messages.submitting
          : spec.label}
      </button>
    )
  }

  const isPrivateSpec = specOf(NODE.isPrivate) as InputSpec
  const memberQuerySpec = specOf(NODE.memberQuery) as InputSpec
  const hostRoleNote = specOf(NODE.hostRoleNote) as SummarySpec
  const minutesNote = specOf(NODE.minutesNote) as SummarySpec

  return (
    <AppShell
      screenId={opsMeet02.screenId}
      activeNavigationScreenId={opsMeet02.activeNavigationScreenId}
      eyebrow={opsMeet02.meta?.eyebrow}
      title={drawnTitleOf(opsMeet02, screenParams)}
      onNavigate={onNavigate}
    >
      <div className="flex max-w-4xl flex-col gap-6">
        <div data-node-id={NODE.heading}>
          <h2 className="text-lg font-bold text-gray-900">{headingSpec.title}</h2>
          <p className="pt-1 text-xs text-gray-500">{headingSpec.description}</p>
        </div>

        {section(
          NODE.typeGroup,
          1,
          <div className="flex flex-col gap-4">
            <ChoiceGroup
              id="meetingType"
              nodeId={NODE.meetingType}
              disabled={false}
              sourceKey={(specOf(NODE.meetingType) as SelectSpec).optionsSource.key}
              sourceParams={{}}
              value={
                valueOf('meetingType') === ''
                  ? null
                  : {
                      value: valueOf('meetingType'),
                      label: draft.labels.meetingType ?? valueOf('meetingType'),
                    }
              }
              onSelect={(option) => setValue('meetingType', option.value, option.label)}
            />
            <div className="w-1/2">{selectField(NODE.linkedEventId)}</div>
          </div>,
        )}

        {section(
          NODE.basicGroup,
          2,
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              {inputField(NODE.title)}
              {inputField(NODE.hostName)}
              {selectField(NODE.departmentId)}
              {inputField(NODE.statusLabel)}
            </div>
            {inputField(NODE.purpose)}
          </div>,
        )}

        {section(
          NODE.scheduleGroup,
          3,
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-4 gap-4">
              {inputField(NODE.date)}
              {inputField(NODE.startTime)}
              {inputField(NODE.endTime)}
              {selectField(NODE.mode)}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {inputField(NODE.place)}
              {inputField(NODE.onlineLink)}
            </div>
          </div>,
        )}

        <section
          data-node-id={NODE.peopleGroup}
          aria-label={(specOf(NODE.peopleGroup) as GroupSpec).title}
          className="rounded-xl border border-gray-200 bg-white p-5"
        >
          <div className="flex items-start justify-between gap-4">
            {sectionHeader(NODE.peopleGroup, 4)}
            {/* 몇 명인지는 명세가 모른다 - 세는 것은 화면의 셈이다. */}
            <span data-node-id={NODE.selectedCount} className="text-xs font-medium text-gray-500">
              {countItem.label} {formatComputed(computeNumber(countItem.compute!, { draft }))}
              {countItem.unit}
            </span>
          </div>

          <div className="flex flex-col gap-4 pt-5">
            {/* 비공개 회의(input.inputType checkbox). 목록에서 고르는 것이 아니라
                켜고 끄는 것이다. */}
            <div
              data-node-id={NODE.isPrivate}
              className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
            >
              <span>
                <label
                  htmlFor={isPrivateSpec.fieldKey}
                  className="block text-xs font-semibold text-gray-800"
                >
                  {isPrivateSpec.label}
                </label>
                <span className="block pt-0.5 text-xs text-gray-500">
                  {isPrivateSpec.helperText}
                </span>
              </span>
              <input
                id={isPrivateSpec.fieldKey}
                type={isPrivateSpec.inputType}
                // 체크 상자의 value는 기본이 'on'이라 대조기가 그 글을 칸의 내용으로
                // 읽는다(design-check의 visibleText). 켜짐은 checked가 말한다.
                value=""
                checked={valueOf(isPrivateSpec.fieldKey) === 'y'}
                onChange={(event) =>
                  setValue(isPrivateSpec.fieldKey, event.target.checked ? 'y' : '')
                }
                className="size-5 shrink-0 accent-blue-600"
              />
            </div>

            <div className="flex items-center gap-3">
              {/* design은 돋보기를 칸 안에 겹쳐 그린다(18:2489가 Text Input 위에
                  놓인다). 겹치면 안내 문구가 가려지므로 칸의 왼쪽 여백만 늘린다. */}
              <span className="relative min-w-0 flex-1 [&_input]:pl-9">
                <FigmaAsset
                  screenId={SCREEN}
                  nodeId={ASSET.search}
                  className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2"
                />
                <span data-node-id={NODE.memberQuery} className="block">
                  <TextInput
                    id={memberQuerySpec.fieldKey}
                    value={valueOf(memberQuerySpec.fieldKey)}
                    placeholder={memberQuerySpec.placeholder}
                    type={memberQuerySpec.inputType}
                    onChange={(next) => setValue(memberQuerySpec.fieldKey, next)}
                  />
                </span>
                {/* 라벨이 그려지지 않는 칸이다(labelHidden). 그래도 읽어 주는 이름은 있다. */}
                <label htmlFor={memberQuerySpec.fieldKey} className="sr-only">
                  {memberQuerySpec.label}
                </label>
              </span>
              <button
                type="button"
                onClick={addParticipant}
                disabled={participantRowIds.length >= participantList.maxItems}
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 enabled:hover:bg-gray-50 disabled:text-gray-400"
              >
                <FigmaAsset screenId={SCREEN} nodeId={ASSET.addMember} className="size-3.5" />
                {participantList.addLabel}
              </button>
            </div>

            {/* 줄에 무엇이 그려지는지는 명세가 말하지 않는다(itemFields가 없다).
                이름·소속·딱지·단추 글은 전부 meeting.draft가 준다. */}
            <div data-node-id={NODE.participants} className="grid grid-cols-2 gap-3">
              {participantRowIds.map(participantRow)}
            </div>

            <p
              data-node-id={NODE.hostRoleNote}
              className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700"
            >
              <FigmaAsset
                screenId={SCREEN}
                nodeId={ASSET.hostRoleNote}
                className="mt-0.5 size-3.5 shrink-0"
              />
              <span>{hostRoleNote.title}</span>
            </p>
            <p data-node-id={NODE.minutesNote} className="text-xs text-gray-400">
              {minutesNote.title}
            </p>
          </div>
        </section>

        <section
          data-node-id={NODE.agendaGroup}
          aria-label={(specOf(NODE.agendaGroup) as GroupSpec).title}
          className="flex flex-col gap-4"
        >
          <div className="flex items-start justify-between gap-4">
            {sectionHeader(NODE.agendaGroup, 5)}
            <button
              type="button"
              onClick={addAgenda}
              disabled={agendaRowIds.length >= agendaList.maxItems}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 enabled:hover:bg-gray-50 disabled:text-gray-400"
            >
              <FigmaAsset screenId={SCREEN} nodeId={ASSET.addAgenda} className="size-3" />
              {agendaList.addLabel}
            </button>
          </div>
          {agendaRowIds.map(agendaCard)}
        </section>

        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-gray-500">{opsMeet02.meta?.footerNote}</p>
          <div className="flex items-center gap-2">
            {actionButton(NODE.cancel, 'rounded-md px-4 py-2 text-sm font-medium text-gray-500')}
            {actionButton(
              NODE.saveDraft,
              'rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50',
            )}
            {actionButton(
              NODE.create,
              'flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700',
              ASSET.createCheck,
            )}
          </div>
        </div>

        {submitAction.errorMessage === null ? null : (
          <p role="alert" className="text-xs text-red-500">
            {submitAction.errorMessage}
          </p>
        )}
        {/* 보내고 나면 어디로 가는지가 아직 정해지지 않았다고 명세가 적어
            두었으면 그 글을 내놓는다. 적어만 두고 안 보여주면 보내고 나서
            아무 일도 안 일어나는 것처럼 보인다. */}
        {submitAction.pendingNote === null ? null : (
          <p role="status" className="text-xs text-gray-500">
            {submitAction.pendingNote}
          </p>
        )}
        {/* 명세가 showMissingRequiredFields라고 말한다. 무엇이 비었는지를 짚는다. */}
        {blockedKeys.length === 0 ? null : (
          <p role="alert" className="text-xs font-medium text-red-600">
            {`아직 채우지 않은 칸이 있습니다: ${blockedKeys.map(labelOfField).join(', ')}`}
          </p>
        )}
        {note === null ? null : (
          <p role="status" className="text-xs font-medium text-gray-500">
            {note}
          </p>
        )}
      </div>
    </AppShell>
  )
}
