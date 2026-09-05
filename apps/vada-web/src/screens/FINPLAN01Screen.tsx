import { useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Field } from '../components/Field'
import { FigmaAsset } from '../components/FigmaAsset'
import { SearchSelect } from '../components/SearchSelect'
import { TextInput } from '../components/TextInput'
import { readObjectSource } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { fetchOptions } from '../option-sources/catalog'
import type { Option } from '../option-sources/catalog'
import {
  evaluateButtonExecution,
  getRequiredFieldCandidates,
  hasFieldValue,
} from '../../../../packages/contracts/src/button-execution.mjs'
import { computeNumber, formatComputed, itemKey, joinRowIds, rowIdsOf } from '../spec/compute'
import { getMutation } from '../spec/mutations'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, elementByNodeId, finPlan01 } from '../spec/screens'
import type {
  ButtonSpec,
  GroupSpec,
  InputSpec,
  ListSpec,
  NavigateAction,
  SelectSpec,
  SubmitAction,
  SummarySpec,
} from '../spec/types'
import { useSubmitAction } from '../spec/useSubmitAction'
import type { ScopeDraft } from '../state/scopes'

// 예산 편성(FIN-PLAN-01).
//
// **재정 28자리가 전부 이 화면이 넣는 금액 위에 선다.** 총예산 카드의 총예산과
// 사용 가능액, 장부의 예산 항목, 구매 요청의 '어느 항목에서 쓰나', 행사 재정의
// 배정액 — 하나같이 여기서 정한 금액을 읽는다. 한동안 그 금액을 넣는 화면이 명세에
// 없어 재정 화면들이 비어 있었다(2026-09-05에 그렸다).
//
// 이 화면이 말하는 것 둘.
//
// 하나. **한 벌이 통째로 오가고, 저장은 덮어쓰기다.** 기간·수입원·상시 항목·행사별
// 항목이 한 초안에 살고(`budgetPlanDraft`), 저장이 그 초안을 그대로 보낸다. 안 보낸
// 줄은 지운 것이다 — 그래서 목록은 되풀이되는 묶음(`list`)이고 줄을 지우는 조작을
// 갖는다(FIN-REQ-01에는 없던 것).
//
// 둘. **행사 고르기는 보는 창이지 값이 아니다.** 행사별 항목은 줄마다 어느 행사의
// 것인지(`eventItemEvent`)를 들고 초안 안에 전부 남아 있다. 위의 '행사' 고르기는
// 그중 어느 행사의 줄을 보고 고칠지를 정할 뿐이고, 새 줄은 고른 행사로 만들어진다.
// 다른 행사의 줄은 보이지 않아도 함께 저장된다 — 행사 예산도 이 한 화면에서만
// 배정한다(사람이 정함, 2026-09-05).
//
// 합계 셋은 화면이 셈한다(`compute: sum`). 배정의 합이 수입의 합을 넘으면 서버가
// 막는다(422) — 무엇이 '넘는 것'인지는 조직의 재정 규칙이라 서버의 것이다.

const SCREEN = 'FIN-PLAN-01'

const NODE = {
  cancel: '601:2',
  save: '601:7',
  heading: '600:97',
  period: '602:2',
  periodStart: '602:6',
  periodEnd: '602:12',
  sources: '602:18',
  items: '603:2',
  event: '603:113',
  eventItems: '603:110',
  incomeTotal: '603:161',
  itemTotal: '606:2',
  eventTotal: '608:2',
} as const

// 줄 안의 자리. 명세가 적은 것은 첫째 줄의 노드이고, 화면도 첫째에만 끈을 단다.
const ITEM_NODE = {
  sourceName: '602:22',
  sourceAmount: '602:28',
  itemName: '603:6',
  itemAmount: '603:12',
  itemDepartment: '603:18',
  eventItemName: '603:121',
  eventItemAmount: '603:127',
} as const

// design이 그림으로 뽑아 둔 화살표. 줄마다 같은 그림이라 첫째 것의 이름으로 그린다.
const ASSET = {
  departmentChevron: '603:23',
  eventChevron: '603:118',
} as const

/**
 * 행사별 항목 줄이 어느 행사의 것인지를 담는 칸. **그려지는 칸이 아니라 계약의
 * 조각이다**(`finance.budgetPlanDraft`의 eventItems[].eventItemEvent) — 그래서
 * 명세의 itemFields에는 없고 여기 이름으로 둔다.
 */
const EVENT_OF_ROW = 'eventItemEvent'

// 줄 하나가 늘 때 붙일 새 이름. 자리(0·1·2)가 아니라 이름으로 가리키는 이유는
// 가운데를 지워도 나머지 값이 따라 옮겨 다니지 않게 하기 위해서다.
function nextRowId(rowIds: string[]): string {
  const used = new Set(rowIds)
  for (let index = 0; ; index += 1) {
    const candidate = `r${index}`
    if (!used.has(candidate)) {
      return candidate
    }
  }
}

// 읽어 온 편성을 초안으로 옮긴다.
//
// 조각 이름이 칸 이름과 같으면 그 값으로 시작한다(draftFrom). 목록의 조각은 다시
// 줄의 칸이 되고, 줄마다 줄 이름이 하나씩 붙는다. 줄의 `id`도 칸으로 실린다 —
// 저장할 때 어느 줄을 고치는지를 그것이 말한다.
//
// **행사 고르기는 첫 행사 줄의 행사로 시작한다.** 명세의 initialValue는 비어
// 있지만, 비운 채로 열면 있는 행사 예산이 하나도 안 보인다 — 사람은 없는 줄 안다.
// 줄이 하나도 없으면 고른 것도 없다.
function draftFromRow(row: DataRow, eventListKey: string, eventFieldKey: string): ScopeDraft {
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
      for (const [field, fieldValue] of Object.entries(item)) {
        values[itemKey(key, rowId, field)] = String(fieldValue)
      }
    })
    values[key] = joinRowIds(rowIds)
  }

  const firstEventRow = rowIdsOf({ values, labels: {} }, eventListKey)[0]
  const firstEvent =
    firstEventRow === undefined ? null : values[itemKey(eventListKey, firstEventRow, EVENT_OF_ROW)]
  if (firstEvent !== null && firstEvent !== undefined && firstEvent !== '') {
    values[eventFieldKey] = firstEvent
  }

  return { values, labels: {} }
}

/** 줄 안의 칸 하나가 어떻게 그려지는지. 명세의 itemFields에서 이름으로 찾는다. */
function itemFieldOf(list: ListSpec, fieldKey: string): InputSpec | SelectSpec {
  const found = (list.itemFields ?? []).find(
    (entry) =>
      (entry.spec.type === 'input' || entry.spec.type === 'select') && entry.spec.fieldKey === fieldKey,
  )
  if (found === undefined) {
    throw new Error(`목록 '${list.fieldKey}'에 '${fieldKey}' 칸이 없습니다.`)
  }
  return found.spec as InputSpec | SelectSpec
}

interface FINPLAN01ScreenProps {
  /** 명세가 stateScopeKey로 말한 자리. 쓰던 것은 여기 남는다. */
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
}

export function FINPLAN01Screen({
  draft: scopeDraft,
  onChangeDraft,
  onNavigate,
  onScopeEvent,
}: FINPLAN01ScreenProps) {
  const headingSpec = elementByNodeId(finPlan01, NODE.heading).spec as SummarySpec
  const periodGroup = elementByNodeId(finPlan01, NODE.period).spec as GroupSpec
  const sourcesList = elementByNodeId(finPlan01, NODE.sources).spec as ListSpec
  const itemsList = elementByNodeId(finPlan01, NODE.items).spec as ListSpec
  const eventItemsList = elementByNodeId(finPlan01, NODE.eventItems).spec as ListSpec
  const eventSpec = elementByNodeId(finPlan01, NODE.event).spec as SelectSpec
  const departmentSpec = itemFieldOf(itemsList, 'itemDepartment') as SelectSpec
  const buttonAt = (nodeId: string) => elementByNodeId(finPlan01, nodeId).spec as ButtonSpec

  // 초안은 저장된 편성에서 시작한다. **아직 아무것도 없는 학생회도 읽는다** — 기간도
  // 줄도 없는 한 벌이 오고, 그것이 갓 만든 학생회의 첫 모습이다.
  const [seed] = useState<ScopeDraft>(() =>
    draftFromRow(
      readObjectSource(
        finPlan01.draftFrom!.dataSourceKey,
        resolveParams(finPlan01.draftFrom!.params, {}),
      ),
      eventItemsList.fieldKey,
      eventSpec.fieldKey,
    ),
  )

  // 초안은 화면 안이 아니라 스코프에 산다(명세: stateScopeKey, 수명 flow). 아직
  // 아무것도 쓰지 않았으면 읽어 온 것이 보이고, 한 자라도 쓰면 그 뒤로는 스코프가 답한다.
  const draft = Object.keys(scopeDraft.values).length === 0 ? seed : scopeDraft
  const setDraft = (update: (previous: ScopeDraft) => ScopeDraft) => {
    onChangeDraft(update(draft))
  }
  const [note, setNote] = useState<string | null>(null)
  const [blockedKeys, setBlockedKeys] = useState<string[]>([])
  const submitAction = useSubmitAction()

  // 고른 값의 이름. 초안에는 값(id)만 실려 오므로 — 서버가 준 편성에는 부서 이름도
  // 행사 제목도 없다 — 이름은 선택지 출처에서 받아 온다. 받기 전에는 값 그대로다.
  // 받지 못하면 여기서는 아무 말도 않는다: 그 자리를 열면 선택지 칸이 제 문구로 말한다.
  const [departmentOptions, setDepartmentOptions] = useState<Option[]>([])
  const [eventOptions, setEventOptions] = useState<Option[]>([])
  const departmentSourceKey = departmentSpec.optionsSource.key
  const eventSourceKey = eventSpec.optionsSource.key
  useEffect(() => {
    let alive = true
    const bring = (key: string, keep: (options: Option[]) => void) => {
      fetchOptions(key, {})
        .then((options) => {
          if (alive) keep(options)
        })
        .catch(() => {})
    }
    bring(departmentSourceKey, setDepartmentOptions)
    bring(eventSourceKey, setEventOptions)
    return () => {
      alive = false
    }
  }, [departmentSourceKey, eventSourceKey])

  const labelOf = (options: Option[], key: string, value: string) =>
    options.find((option) => option.value === value)?.label ?? draft.labels[key] ?? value

  const sourceRowIds = rowIdsOf(draft, sourcesList.fieldKey)
  const itemRowIds = rowIdsOf(draft, itemsList.fieldKey)
  const eventRowIds = rowIdsOf(draft, eventItemsList.fieldKey)
  const chosenEvent = draft.values[eventSpec.fieldKey] ?? ''
  // 보이는 줄은 고른 행사의 것뿐이다. 나머지는 초안 안에 그대로 있다.
  const shownEventRowIds = eventRowIds.filter(
    (rowId) => (draft.values[itemKey(eventItemsList.fieldKey, rowId, EVENT_OF_ROW)] ?? '') === chosenEvent,
  )

  function setValue(key: string, value: string, label?: string) {
    setDraft((previous) => ({
      values: { ...previous.values, [key]: value },
      labels: label === undefined ? previous.labels : { ...previous.labels, [key]: label },
    }))
  }

  /** 줄 하나를 더한다. 그려지는 칸은 명세의 초기값으로, 안 그려지는 칸(`extra`)은 준 값으로. */
  function addRow(list: ListSpec, rowIds: string[], extra: Record<string, string> = {}) {
    const rowId = nextRowId(rowIds)
    setDraft((previous) => {
      const values = { ...previous.values }
      for (const field of list.itemFields ?? []) {
        const spec = field.spec
        if (spec.type === 'input' || spec.type === 'select') {
          values[itemKey(list.fieldKey, rowId, spec.fieldKey)] = spec.initialValue ?? ''
        }
      }
      for (const [field, value] of Object.entries(extra)) {
        values[itemKey(list.fieldKey, rowId, field)] = value
      }
      values[list.fieldKey] = joinRowIds([...rowIds, rowId])
      return { values, labels: previous.labels }
    })
  }

  /** 줄 하나를 지운다. 그 줄의 칸을 모두 비우고 줄 이름 목록에서 뺀다 — 저장하면 지워진다. */
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

  // 명세는 저장이 필수 칸이 다 차야 실행된다고 말한다(executeWhen). 판정은 공용
  // 판정기가 하고, **되풀이되는 줄의 값이 찼는지는 이 화면만 안다** — 값이 줄마다
  // 갈리고 몇 줄인지는 사람이 정한다. 안 보이는 행사의 줄도 저장되므로 함께 본다.
  const rowIdsByList: Record<string, string[]> = {
    [sourcesList.fieldKey]: sourceRowIds,
    [itemsList.fieldKey]: itemRowIds,
    [eventItemsList.fieldKey]: eventRowIds,
  }
  const isFilled = (candidate: { fieldKey: string; inList: string | null }) => {
    if (candidate.inList === null) {
      return hasFieldValue(draft.values[candidate.fieldKey])
    }
    const listKey = candidate.inList
    return (rowIdsByList[listKey] ?? []).every((rowId) =>
      hasFieldValue(draft.values[itemKey(listKey, rowId, candidate.fieldKey)]),
    )
  }

  // 사람에게는 fieldKey가 아니라 라벨로 말한다.
  const labelOfField = (fieldKey: string) =>
    getRequiredFieldCandidates(finPlan01.elements).find(
      (candidate) => candidate.fieldKey === fieldKey,
    )?.label ?? fieldKey

  function pressButton(button: ButtonSpec) {
    const action = button.action
    if (action.type !== 'navigate' && action.type !== 'submit') {
      setNote('note' in action && typeof action.note === 'string' ? action.note : null)
      return
    }
    const verdict = evaluateButtonExecution({
      action,
      elements: finPlan01.elements,
      values: draft.values,
      isFilled,
    })
    if (!verdict.allowed) {
      setBlockedKeys(verdict.missingFieldKeys)
      return
    }
    setBlockedKeys([])
    setNote(null)
    if (action.type === 'navigate') {
      const navigate = action as NavigateAction
      // 떠나면서 초안을 어떻게 끝내는지는 명세가 말한다. 이 화면의 취소는 말하지 않는다.
      if (navigate.scopeEvent !== undefined) {
        onScopeEvent(finPlan01.stateScopeKey ?? '', navigate.scopeEvent)
      }
      onNavigate(navigate.targetScreenId, resolveParams(navigate.params, {}))
      return
    }
    // payloadScope의 값 전체를 보낸다. 줄의 칸도, 보이지 않는 행사의 줄도 그 안에
    // 들어 있다 — 계약은 mutations.json이 갖고 화면은 무엇을 보내는지 정하지 않는다.
    void submitAction.run(action as SubmitAction, {
      payload: draft.values,
      onNavigate,
      onScopeEvent,
    })
  }

  // --- 자리 만들기 ----------------------------------------------------------

  /** 화면 수준의 칸(회계 기간의 시작일·끝일). */
  function screenInput(nodeId: string) {
    const spec = elementByNodeId(finPlan01, nodeId).spec as InputSpec
    return (
      <Field
        htmlFor={spec.fieldKey}
        nodeId={nodeId}
        label={spec.label}
        required={spec.required}
        helperText={spec.helperText}
      >
        <TextInput
          id={spec.fieldKey}
          value={draft.values[spec.fieldKey] ?? ''}
          placeholder={spec.placeholder}
          type={spec.inputType}
          onChange={(next) => setValue(spec.fieldKey, next)}
        />
      </Field>
    )
  }

  /** 줄 안의 글·수 칸. 첫째 줄에만 design의 끈을 단다. */
  function rowInput(list: ListSpec, rowId: string, fieldKey: keyof typeof ITEM_NODE, first: boolean) {
    const spec = itemFieldOf(list, fieldKey) as InputSpec
    const key = itemKey(list.fieldKey, rowId, fieldKey)
    const id = `${list.fieldKey}-${rowId}-${fieldKey}`
    return (
      <Field
        htmlFor={id}
        nodeId={first ? ITEM_NODE[fieldKey] : undefined}
        label={spec.label}
        required={spec.required}
      >
        <TextInput
          id={id}
          value={draft.values[key] ?? ''}
          placeholder={spec.placeholder}
          type={spec.inputType}
          onChange={(next) => setValue(key, next)}
        />
      </Field>
    )
  }

  /** 줄을 지우는 단추. 명세가 itemActions에 remove를 적은 목록에만 있다. */
  function removeButton(list: ListSpec, rowIds: string[], rowId: string) {
    if (!list.itemActions.includes('remove')) return null
    return (
      <button
        type="button"
        onClick={() => removeRow(list, rowIds, rowId)}
        className="shrink-0 rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        지우기
      </button>
    )
  }

  /** 줄을 더하는 단추. 몇 줄까지인지는 명세가 안다(maxItems). */
  function addButton(list: ListSpec, rowIds: string[], onAdd: () => void, blocked = false) {
    return (
      <div>
        <button
          type="button"
          onClick={onAdd}
          disabled={blocked || rowIds.length >= list.maxItems}
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 enabled:hover:bg-gray-50 disabled:text-gray-400"
        >
          {list.addLabel}
        </button>
      </div>
    )
  }

  function sectionTitle(title: string | undefined) {
    return <h3 className="text-base font-semibold text-gray-900">{title}</h3>
  }

  const SECTION = 'flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5'
  const ROW = 'flex items-end gap-4 bg-white'

  /** 수입원 한 줄: 이름 · 금액 · 지우기. */
  function renderSourceRow(rowId: string, index: number) {
    const first = index === 0
    return (
      <div key={rowId} className={ROW}>
        <div className="min-w-0 flex-1">{rowInput(sourcesList, rowId, 'sourceName', first)}</div>
        <div className="w-56 shrink-0">{rowInput(sourcesList, rowId, 'sourceAmount', first)}</div>
        {removeButton(sourcesList, sourceRowIds, rowId)}
      </div>
    )
  }

  /** 상시 항목 한 줄: 이름 · 배정액 · 담당 부서(선택) · 지우기. */
  function renderItemRow(rowId: string, index: number) {
    const first = index === 0
    const key = itemKey(itemsList.fieldKey, rowId, departmentSpec.fieldKey)
    const id = `${itemsList.fieldKey}-${rowId}-${departmentSpec.fieldKey}`
    const stored = draft.values[key] ?? ''
    return (
      <div key={rowId} className={ROW}>
        <div className="min-w-0 flex-1">{rowInput(itemsList, rowId, 'itemName', first)}</div>
        <div className="w-56 shrink-0">{rowInput(itemsList, rowId, 'itemAmount', first)}</div>
        <div className="w-64 shrink-0">
          <Field
            htmlFor={id}
            nodeId={first ? ITEM_NODE.itemDepartment : undefined}
            label={departmentSpec.label}
            required={departmentSpec.required}
          >
            <SearchSelect
              id={id}
              placeholder={departmentSpec.placeholder}
              searchable={departmentSpec.searchable}
              disabled={false}
              sourceKey={departmentSourceKey}
              sourceParams={{}}
              value={stored === '' ? null : { value: stored, label: labelOf(departmentOptions, key, stored) }}
              onSelect={(option) => setValue(key, option.value, option.label)}
              chevron={
                <FigmaAsset screenId={SCREEN} nodeId={ASSET.departmentChevron} className="size-4" />
              }
            />
          </Field>
        </div>
        {removeButton(itemsList, itemRowIds, rowId)}
      </div>
    )
  }

  /** 행사별 항목 한 줄: 이름 · 배정액 · 지우기. 어느 행사의 줄인지는 칸 밖에 있다. */
  function renderEventItemRow(rowId: string, index: number) {
    const first = index === 0
    return (
      <div key={rowId} className={ROW}>
        <div className="min-w-0 flex-1">{rowInput(eventItemsList, rowId, 'eventItemName', first)}</div>
        <div className="w-56 shrink-0">{rowInput(eventItemsList, rowId, 'eventItemAmount', first)}</div>
        {removeButton(eventItemsList, eventRowIds, rowId)}
      </div>
    )
  }

  /** 합계 한 줄. 셈은 명세가 말하고(compute) 표기는 화면의 몫이다. */
  function total(nodeId: string) {
    const spec = elementByNodeId(finPlan01, nodeId).spec as SummarySpec
    const item = spec.items![0]
    return (
      <p key={nodeId} data-node-id={nodeId} className="text-sm font-semibold text-gray-900">
        <span>{item.label}</span> <span>{formatComputed(computeNumber(item.compute!, { draft }))}</span>
        <span>{item.unit}</span>
      </p>
    )
  }

  // 머리 오른쪽의 두 단추. design은 둘을 같은 흰 단추로 그렸다 — 명세의 emphasis와
  // 달리 '저장'에 다른 색이 없다. 그림이 색의 진실이다.
  const headerAction = (
    <div className="flex items-center gap-2">
      {[NODE.cancel, NODE.save].map((nodeId) => {
        const spec = buttonAt(nodeId)
        const running =
          spec.action.type === 'submit' && submitAction.runningKey === spec.action.mutationKey
        return (
          <button
            key={nodeId}
            type="button"
            data-node-id={nodeId}
            onClick={() => pressButton(spec)}
            className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {running ? getMutation((spec.action as SubmitAction).mutationKey).messages.submitting : spec.label}
          </button>
        )
      })}
    </div>
  )

  return (
    <AppShell
      screenId={finPlan01.screenId}
      activeNavigationScreenId={finPlan01.activeNavigationScreenId}
      title={drawnTitleOf(finPlan01)}
      headerAction={headerAction}
      onNavigate={onNavigate}
    >
      <div className="flex flex-col gap-6">
        <div data-node-id={NODE.heading}>
          <h2 className="text-lg font-semibold text-gray-900">{headingSpec.title}</h2>
          <p className="pt-1 text-sm text-gray-500">{headingSpec.description}</p>
        </div>

        {submitAction.errorMessage === null ? null : (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {submitAction.errorMessage}
          </p>
        )}
        {/* 명세가 showMissingRequiredFields라고 말한다. 무엇이 비었는지를 짚는다 —
            막혔다는 사실만 알리면 사람이 어디를 봐야 할지 모른다. */}
        {blockedKeys.length === 0 ? null : (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-600">
            {`아직 채우지 않은 칸이 있습니다: ${blockedKeys.map((key) => labelOfField(key)).join(', ')}`}
          </p>
        )}
        {note === null ? null : (
          <p role="status" className="text-xs font-medium text-gray-500">
            {note}
          </p>
        )}

        <section data-node-id={NODE.period} aria-label={periodGroup.title} className={SECTION}>
          {sectionTitle(periodGroup.title)}
          <div className="grid grid-cols-2 gap-6 bg-white">
            {screenInput(NODE.periodStart)}
            {screenInput(NODE.periodEnd)}
          </div>
        </section>

        <section data-node-id={NODE.sources} aria-label={sourcesList.label} className={SECTION}>
          {sectionTitle(sourcesList.label)}
          {sourceRowIds.map(renderSourceRow)}
          {addButton(sourcesList, sourceRowIds, () => addRow(sourcesList, sourceRowIds))}
        </section>

        <section data-node-id={NODE.items} aria-label={itemsList.label} className={SECTION}>
          {sectionTitle(itemsList.label)}
          {itemRowIds.map(renderItemRow)}
          {addButton(itemsList, itemRowIds, () => addRow(itemsList, itemRowIds))}
        </section>

        <section data-node-id={NODE.eventItems} aria-label={eventItemsList.label} className={SECTION}>
          {sectionTitle(eventItemsList.label)}
          {/* 어느 행사의 줄을 보고 고칠지. 고른 행사의 줄만 아래에 보이고, 새 줄은 그 행사로 만들어진다. */}
          <div className="w-64">
            <Field htmlFor={eventSpec.fieldKey} nodeId={NODE.event} label={eventSpec.label} required={eventSpec.required}>
              <SearchSelect
                id={eventSpec.fieldKey}
                placeholder={eventSpec.placeholder}
                searchable={eventSpec.searchable}
                disabled={false}
                sourceKey={eventSourceKey}
                sourceParams={{}}
                value={
                  chosenEvent === ''
                    ? null
                    : { value: chosenEvent, label: labelOf(eventOptions, eventSpec.fieldKey, chosenEvent) }
                }
                onSelect={(option) => setValue(eventSpec.fieldKey, option.value, option.label)}
                chevron={<FigmaAsset screenId={SCREEN} nodeId={ASSET.eventChevron} className="size-4" />}
              />
            </Field>
          </div>
          {shownEventRowIds.map(renderEventItemRow)}
          {/* 행사를 고르기 전에는 더할 줄이 어느 행사의 것인지 모른다. */}
          {addButton(
            eventItemsList,
            eventRowIds,
            () => addRow(eventItemsList, eventRowIds, { [EVENT_OF_ROW]: chosenEvent }),
            chosenEvent === '',
          )}
        </section>

        <div className="flex flex-col gap-2">
          {[NODE.incomeTotal, NODE.itemTotal, NODE.eventTotal].map(total)}
        </div>
      </div>
    </AppShell>
  )
}
