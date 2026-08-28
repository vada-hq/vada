import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { ChoiceGroup } from '../components/ChoiceGroup'
import { Field } from '../components/Field'
import { FigmaAsset } from '../components/FigmaAsset'
import { SearchSelect } from '../components/SearchSelect'
import { TextInput } from '../components/TextInput'
import { readObjectSource } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import {
  evaluateButtonExecution,
  getRequiredFieldCandidates,
  hasFieldValue,
} from '../../../../packages/contracts/src/button-execution.mjs'
import { computeNumber, formatComputed, itemKey, joinRowIds, rowIdsOf } from '../spec/compute'
import { getMutation } from '../spec/mutations'
import { useSubmitAction } from '../spec/useSubmitAction'
import { resolveParams } from '../spec/params'
import { drawnTitleOf, elementByNodeId, finReq01 } from '../spec/screens'
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

// 구매 요청 작성·수정(FIN-REQ-01).
//
// **처음으로 값을 쓰고 보내는 화면**이다. 지금까지의 행사 화면은 전부 읽기
// 전용이었고, 마지막 제출 화면은 ORG-02였다.
//
// 이 화면이 말하는 것 둘.
//
// 하나. **되풀이되는 것은 이름 하나가 아니라 묶음이다.** 품목 넷이 같은 열두 칸을
// 갖는다. 명세는 그 틀을 한 번만 적고(list.itemFields), 개수는 데이터가 정한다 —
// design이 넷을 그렸다고 명세에 넷을 적으면 다섯째 품목이 생길 때 명세가 틀린다.
//
// 둘. **금액을 화면이 셈한다.** EVT-FIN-01에서는 반대였다 — 무엇을 더하고 빼는지가
// 조직의 재정 규칙이라 서버가 글로 보내 왔다. 그런데 아직 제출하지 않은 요청의
// 합계를 아는 서버는 없다. 사람이 수량을 고치는 순간 다시 그려져야 한다.

const SCREEN = 'FIN-REQ-01'

const NODE = {
  heading: '30:314',
  baseGroup: '30:319',
  title: '30:326',
  department: '30:332',
  neededOn: '30:339',
  priority: '30:344',
  purpose: '30:351',
  itemCount: '30:363',
  items: '30:357',
  aside: '30:776',
  submit: '30:807',
  saveDraft: '30:809',
  cancel: '30:811',
} as const

// 항목 안의 자리. 명세가 적은 것은 첫째 항목의 노드이고, 화면도 첫째에만 끈을 단다.
const ITEM_NODE = {
  itemName: '30:380',
  itemCategory: '30:386',
  budgetItem: '30:394',
  purchaseType: '30:403',
  quantity: '30:412',
  unit: '30:418',
  unitPrice: '30:424',
  total: '30:430',
  detailGroup: '30:435',
  vendor: '30:440',
  productUrl: '30:445',
  option: '30:450',
  deliveryNote: '30:455',
  quoteStatus: '30:462',
} as const

const ASSET = {
  addItem: '30:366',
  priorityChevron: '30:349',
  submitNote: '30:815',
  itemCategoryChevron: '30:392',
  budgetItemChevron: '30:400',
  purchaseTypeChevron: '30:409',
} as const

// 항목 하나가 늘 때 붙일 새 이름. 지우기가 없는 화면이라 번호가 겹칠 일은 없지만,
// 자리(0·1·2)가 아니라 이름으로 가리키는 이유는 가운데를 지워도 나머지 값이 따라
// 옮겨 다니지 않게 하기 위해서다.
function nextRowId(rowIds: string[]): string {
  const used = new Set(rowIds)
  for (let index = 0; ; index += 1) {
    const candidate = `r${index}`
    if (!used.has(candidate)) {
      return candidate
    }
  }
}

// 읽어 온 요청을 초안으로 옮긴다.
//
// 조각 이름이 칸 이름과 같으면 그 값으로 시작한다(draftFrom). 목록의 조각은 다시
// 항목의 칸이 되고, 항목마다 줄 이름이 하나씩 붙는다.
function draftFromRow(row: DataRow): ScopeDraft {
  const values: Record<string, string | null> = {}
  const rowIds: string[] = []

  for (const [key, value] of Object.entries(row)) {
    if (!Array.isArray(value)) {
      values[key] = String(value)
      continue
    }
    value.forEach((item, index) => {
      const rowId = `r${index}`
      rowIds.push(rowId)
      for (const [field, fieldValue] of Object.entries(item)) {
        values[itemKey(key, rowId, field)] = String(fieldValue)
      }
    })
    values[key] = joinRowIds(rowIds)
  }

  return { values, labels: {} }
}

interface FINREQ01ScreenProps {
  screenParams: Record<string, string>
  /** 명세가 stateScopeKey로 말한 자리. 쓰던 것은 여기 남는다. */
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
}

export function FINREQ01Screen({
  screenParams,
  draft: scopeDraft,
  onChangeDraft,
  onNavigate,
  onScopeEvent,
}: FINREQ01ScreenProps) {
  const listSpec = elementByNodeId(finReq01, NODE.items).spec as ListSpec

  // 초안은 읽어 온 요청에서 시작한다. **새로 쓰는 것도 읽는다** - 아직 아무것도
  // 적히지 않은 요청이 오고, 그 안에 서버가 이미 아는 것(작성자의 소속)이 들어 있다.
  const [seed] = useState<ScopeDraft>(() =>
    draftFromRow(
      readObjectSource(
        finReq01.draftFrom!.dataSourceKey,
        resolveParams(finReq01.draftFrom!.params, { screenParams }),
      ),
    ),
  )

  // 그리고 그 초안은 **화면 안이 아니라 스코프에 산다**(명세: stateScopeKey,
  // 수명 flow). 한동안 이 화면은 useState에만 담았고, 그래서 뒤로 갔다 오면
  // 쓰던 것이 사라졌다 - 명세가 말한 수명이 거짓이었다(2026-08-27 감사).
  // 아직 아무것도 쓰지 않았으면 읽어 온 것이 보이고, 한 자라도 쓰면 그 뒤로는
  // 스코프가 답한다.
  const draft = Object.keys(scopeDraft.values).length === 0 ? seed : scopeDraft
  const setDraft = (update: (previous: ScopeDraft) => ScopeDraft) => {
    onChangeDraft(update(draft))
  }
  const [note, setNote] = useState<string | null>(null)
  const [blockedKeys, setBlockedKeys] = useState<string[]>([])
  const submitAction = useSubmitAction()

  // 인자가 없으면 못 여는 화면이 있고, 없어도 되는 인자가 있다. 이 화면은 둘 다 갖는다 —
  // 어느 행사인지는 있어야 하고, 어느 요청인지는 없으면 새로 쓰는 것이다.
  const missing = (finReq01.params ?? []).filter(
    (param) => param.optional !== true && (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return (
      <AppShell
        screenId={finReq01.screenId}
        title={finReq01.meta?.title ?? finReq01.screenId}
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

  const rowIds = rowIdsOf(draft, listSpec.fieldKey)
  const itemFields = listSpec.itemFields ?? []

  function setValue(key: string, value: string, label?: string) {
    setDraft((previous) => ({
      values: { ...previous.values, [key]: value },
      labels: label === undefined ? previous.labels : { ...previous.labels, [key]: label },
    }))
  }

  function addItem() {
    const rowId = nextRowId(rowIds)
    setDraft((previous) => {
      const values = { ...previous.values }
      for (const field of itemFields) {
        const spec = field.spec
        if (spec.type === 'input' || spec.type === 'select') {
          values[itemKey(listSpec.fieldKey, rowId, spec.fieldKey)] = spec.initialValue ?? ''
        }
      }
      values[listSpec.fieldKey] = joinRowIds([...rowIds, rowId])
      return { values, labels: previous.labels }
    })
  }

  function submit(button: ButtonSpec) {
    // payloadScope의 값 전체를 보낸다. 항목의 칸도 그 안에 들어 있다 -
    // 계약은 mutations.json이 갖고 화면은 무엇을 보내는지 정하지 않는다.
    void submitAction.run(button.action as SubmitAction, {
      payload: draft.values,
      onNavigate,
      // 무엇을 넘길지는 명세가 말한다(onSuccess.params). 화면은 그 값이
      // 어디 있는지만 알려 준다.
      paramSources: { screenParams },
      onScopeEvent,
    })
  }

  // 명세는 이 버튼이 필수 칸이 다 차야 실행된다고 말한다(executeWhen). 한동안
  // 화면이 그것을 아예 구현하지 않아 빈 칸으로도 제출됐다 - 게이트 넷이 다 놓쳤다.
  // 판정은 공용 판정기가 하고, **되풀이되는 품목의 값이 찼는지는 이 화면만 안다**
  // (값이 항목마다 갈리고 몇 개인지는 사람이 정한다).
  const isFilled = (candidate: { fieldKey: string; inList: string | null }) => {
    if (candidate.inList === null) {
      return hasFieldValue(draft.values[candidate.fieldKey])
    }
    const listKey = candidate.inList
    return rowIds.every((rowId) =>
      hasFieldValue(draft.values[itemKey(listKey, rowId, candidate.fieldKey)]),
    )
  }

  // 사람에게는 fieldKey가 아니라 라벨로 말한다.
  const labelOfField = (fieldKey: string) =>
    getRequiredFieldCandidates(finReq01.elements).find(
      (candidate) => candidate.fieldKey === fieldKey,
    )?.label ?? fieldKey

  function pressButton(button: ButtonSpec) {
    if (button.action.type === 'pending') {
      setNote(button.action.note)
      return
    }
    const verdict = evaluateButtonExecution({
      action: button.action,
      elements: finReq01.elements,
      values: draft.values,
      isFilled,
    })
    if (!verdict.allowed) {
      setBlockedKeys(verdict.missingFieldKeys)
      return
    }
    setBlockedKeys([])
    void submit(button)
  }

  // 항목 하나. 명세가 적은 틀을 줄 이름 하나로 채워 그린다.
  function renderItem(rowId: string, index: number) {
    const first = index === 0
    const nodeOf = (key: keyof typeof ITEM_NODE) => (first ? ITEM_NODE[key] : undefined)
    const valueKey = (fieldKey: string) => itemKey(listSpec.fieldKey, rowId, fieldKey)
    const fieldAt = (fieldKey: string) =>
      itemFields.find(
        (entry) =>
          (entry.spec.type === 'input' || entry.spec.type === 'select') &&
          entry.spec.fieldKey === fieldKey,
      )!.spec as InputSpec | SelectSpec

    const inputAt = (fieldKey: keyof typeof ITEM_NODE) => {
      const spec = fieldAt(fieldKey) as InputSpec
      const id = `${listSpec.fieldKey}-${rowId}-${spec.fieldKey}`
      return (
        <Field
          key={spec.fieldKey}
          htmlFor={id}
          nodeId={nodeOf(fieldKey)}
          label={spec.label}
          required={spec.required}
        >
          <TextInput
            id={id}
            value={draft.values[valueKey(spec.fieldKey)] ?? ''}
            placeholder={spec.placeholder}
            type={spec.inputType}
            onChange={(next) => setValue(valueKey(spec.fieldKey), next)}
          />
        </Field>
      )
    }

    const selectAt = (fieldKey: keyof typeof ITEM_NODE, chevron: string) => {
      const spec = fieldAt(fieldKey) as SelectSpec
      const id = `${listSpec.fieldKey}-${rowId}-${spec.fieldKey}`
      const stored = draft.values[valueKey(spec.fieldKey)] ?? ''
      return (
        <Field
          key={spec.fieldKey}
          htmlFor={id}
          nodeId={nodeOf(fieldKey)}
          label={spec.label}
          required={spec.required}
        >
          <SearchSelect
            id={id}
            placeholder={spec.placeholder}
            searchable={spec.searchable}
            disabled={false}
            sourceKey={spec.optionsSource.key}
            sourceParams={resolveParams(spec.optionsSource.params, { screenParams })}
            value={
              stored === ''
                ? null
                : { value: stored, label: draft.labels[valueKey(spec.fieldKey)] ?? stored }
            }
            onSelect={(option) => setValue(valueKey(spec.fieldKey), option.value, option.label)}
            chevron={<FigmaAsset screenId={SCREEN} nodeId={chevron} className="size-4" />}
          />
        </Field>
      )
    }

    const totalSpec = itemFields.find((entry) => entry.spec.type === 'summary')!
      .spec as SummarySpec
    const totalItem = totalSpec.items![0]
    const detailGroup = itemFields.find((entry) => entry.spec.type === 'group')!
      .spec as GroupSpec
    const quoteSpec = fieldAt('quoteStatus') as SelectSpec
    const quoteKey = valueKey(quoteSpec.fieldKey)
    const quoteValue = draft.values[quoteKey] ?? quoteSpec.initialValue ?? ''
    const titleValue = draft.values[valueKey(listSpec.itemTitleFieldKey!)] ?? ''

    return (
      <div
        key={rowId}
        data-node-id={first ? '30:371' : undefined}
        className="rounded-xl border border-gray-200 bg-white"
      >
        {/* 항목 머리는 순번과 이름이다. 순번은 자리에서 나오고 이름은 칸에서 나온다. */}
        <div className="flex items-center gap-2 rounded-t-xl border-b border-gray-200 bg-gray-50 px-4 py-2.5">
          <span className="flex size-5 items-center justify-center rounded-full bg-gray-200 text-[10px] font-bold text-gray-500">
            {index + 1}
          </span>
          <span className="text-xs font-bold text-gray-600">{titleValue}</span>
        </div>

        <div className="flex flex-col gap-4 p-4">
          <div className="grid grid-cols-3 gap-4">
            {inputAt('itemName')}
            {selectAt('itemCategory', ASSET.itemCategoryChevron)}
            {selectAt('budgetItem', ASSET.budgetItemChevron)}
          </div>

          <div className="flex items-end gap-4">
            <div className="w-40 shrink-0">{selectAt('purchaseType', ASSET.purchaseTypeChevron)}</div>
            <div className="w-24 shrink-0">{inputAt('quantity')}</div>
            <div className="w-24 shrink-0">{inputAt('unit')}</div>
            <div className="w-32 shrink-0">{inputAt('unitPrice')}</div>
            {/* 품목 총액. 수량 곱하기 단가이고, 그 곱셈이 화면의 것이다. */}
            <div
              data-node-id={nodeOf('total')}
              className="flex flex-1 flex-col rounded-lg border border-blue-100 bg-blue-50 px-3 py-1.5"
            >
              <span className="text-[10px] font-semibold text-blue-500">{totalItem.label}</span>
              <span className="text-sm font-bold text-blue-700">
                {formatComputed(
                  computeNumber(totalItem.compute!, {
                    draft,
                    inList: { listFieldKey: listSpec.fieldKey, rowId },
                  }),
                )}
                {totalItem.unit}
              </span>
            </div>
          </div>

          <div
            data-node-id={nodeOf('detailGroup')}
            className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4"
          >
            <p className="text-[10px] font-bold text-gray-400">{detailGroup.title}</p>
            <div className="grid grid-cols-4 gap-4">
              {inputAt('vendor')}
              {inputAt('productUrl')}
              {inputAt('option')}
              {inputAt('deliveryNote')}
            </div>
            {/* design이 이 묶음만 따로 선으로 나눠 두었다. */}
            <div className="rounded-lg border border-gray-200 p-3">
            <Field
              htmlFor={`${listSpec.fieldKey}-${rowId}-${quoteSpec.fieldKey}`}
              nodeId={nodeOf('quoteStatus')}
              label={quoteSpec.label}
              required={quoteSpec.required}
            >
              <ChoiceGroup
                id={`${listSpec.fieldKey}-${rowId}-${quoteSpec.fieldKey}`}
                labelledBy={`${listSpec.fieldKey}-${rowId}-${quoteSpec.fieldKey}-label`}
                disabled={false}
                sourceKey={quoteSpec.optionsSource.key}
                sourceParams={{}}
                value={
                  quoteValue === ''
                    ? null
                    : { value: quoteValue, label: draft.labels[quoteKey] ?? quoteValue }
                }
                onSelect={(option) => setValue(quoteKey, option.value, option.label)}
              />
            </Field>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const headingSpec = elementByNodeId(finReq01, NODE.heading).spec as SummarySpec
  const baseGroup = elementByNodeId(finReq01, NODE.baseGroup).spec as GroupSpec
  const countSpec = elementByNodeId(finReq01, NODE.itemCount).spec as SummarySpec
  const countItem = countSpec.items![0]
  const asideSpec = elementByNodeId(finReq01, NODE.aside).spec as SummarySpec
  const buttonAt = (nodeId: string) => elementByNodeId(finReq01, nodeId).spec as ButtonSpec

  // 요약이 되비추는 값. 서버가 보낸 것이 아니라 방금 이 화면에서 고른 것이다.
  function reflected(fieldKey: string): string {
    const value = draft.values[fieldKey] ?? ''
    return draft.labels[fieldKey] ?? value
  }

  function screenField(nodeId: string) {
    return elementByNodeId(finReq01, nodeId).spec as InputSpec | SelectSpec
  }

  const inputField = (nodeId: string, extra?: { readOnly?: boolean }) => {
    const spec = screenField(nodeId) as InputSpec
    return (
      <Field
        htmlFor={spec.fieldKey}
        nodeId={nodeId}
        label={spec.label}
        required={spec.required}
        helperText={spec.helperText}
      >
        {/* 고칠 수 없는 칸도 칸이다 — 읽을 수 있고 이름도 그대로다. design이 이
            칸만 바탕을 회색으로, 글을 흐리게 그렸다. */}
        <TextInput
          id={spec.fieldKey}
          value={draft.values[spec.fieldKey] ?? ''}
          placeholder={spec.placeholder}
          type={spec.inputType}
          readOnly={extra?.readOnly}
          onChange={(next) => setValue(spec.fieldKey, next)}
        />
      </Field>
    )
  }

  return (
    <AppShell
      screenId={finReq01.screenId}
      title={drawnTitleOf(finReq01, screenParams)}
      onNavigate={onNavigate}
    >
      <div className="flex gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div data-node-id={NODE.heading}>
            <h2 className="text-lg font-bold text-gray-900">{headingSpec.title}</h2>
            <p className="pt-1 text-xs text-gray-500">{headingSpec.description}</p>
          </div>

          <section
            data-node-id={NODE.baseGroup}
            aria-label={baseGroup.title}
            className="rounded-xl border border-gray-200 bg-white p-5"
          >
            <p className="flex items-center gap-2 pb-4 text-sm font-bold text-gray-800">
              <span className="h-4 w-1 rounded bg-blue-600" />
              {baseGroup.title}
            </p>
            <div className="grid grid-cols-2 gap-4">
              {inputField(NODE.title)}
              {inputField(NODE.department, { readOnly: true })}
              {inputField(NODE.neededOn)}
              {(() => {
                const spec = screenField(NODE.priority) as SelectSpec
                const stored = draft.values[spec.fieldKey] ?? ''
                return (
                  <Field htmlFor={spec.fieldKey} nodeId={NODE.priority} label={spec.label} required={spec.required}>
                    <SearchSelect
                      id={spec.fieldKey}
                      placeholder={spec.placeholder}
                      searchable={spec.searchable}
                      disabled={false}
                      sourceKey={spec.optionsSource.key}
                      sourceParams={{}}
                      value={
                        stored === ''
                          ? null
                          : { value: stored, label: draft.labels[spec.fieldKey] ?? stored }
                      }
                      onSelect={(option) => setValue(spec.fieldKey, option.value, option.label)}
                      chevron={
                        <FigmaAsset screenId={SCREEN} nodeId={ASSET.priorityChevron} className="size-4" />
                      }
                    />
                  </Field>
                )
              })()}
            </div>
            <div className="pt-4">{inputField(NODE.purpose)}</div>
          </section>

          <section data-node-id={NODE.items} aria-label={listSpec.label}>
            <div className="flex items-center justify-between gap-4 pb-3">
              <p className="flex items-center gap-2 text-sm font-bold text-gray-800">
                <span className="h-4 w-1 rounded bg-blue-600" />
                {/* 제목과 개수를 한 요소에 담지 않는다 — design은 둘을 다른 글줄로
                    그렸고, 대조는 글줄이 딱 맞는 자리를 찾는다. */}
                <span>{listSpec.label}</span>
                {/* 몇 개인지는 명세가 모른다 — 세는 것도 화면의 셈이다. */}
                <span data-node-id={NODE.itemCount} className="text-xs font-normal text-gray-400">
                  {countItem.label} {formatComputed(computeNumber(countItem.compute!, { draft }))}
                  {countItem.unit}
                </span>
              </p>
              <button
                type="button"
                onClick={addItem}
                disabled={rowIds.length >= listSpec.maxItems}
                className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 enabled:hover:bg-gray-50 disabled:text-gray-400"
              >
                <FigmaAsset screenId={SCREEN} nodeId={ASSET.addItem} className="size-3" />
                {listSpec.addLabel}
              </button>
            </div>
            <div className="flex flex-col gap-4">{rowIds.map(renderItem)}</div>
          </section>
        </div>

        <aside data-node-id={NODE.aside} className="flex w-72 shrink-0 flex-col gap-4">
          <div>
            <p className="text-sm font-bold text-gray-800">{asideSpec.title}</p>
            <p className="pt-1 text-[10px] text-gray-400">{asideSpec.description}</p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            {(asideSpec.items ?? []).slice(0, 1).map((item) => (
              <div key={item.label} className="pb-3">
                <p className="text-[10px] font-semibold text-gray-400">{item.label}</p>
                <p className="flex items-baseline gap-0.5 pt-1">
                  <span className="text-2xl font-bold text-blue-600">
                    {formatComputed(computeNumber(item.compute!, { draft }))}
                  </span>
                  <span className="text-sm font-medium text-blue-500">{item.unit}</span>
                </p>
              </div>
            ))}
            {/* 금액과 나머지를 design이 선으로 나눠 두었다. */}
            <div className="border-t border-gray-200 pt-2">
              {(asideSpec.items ?? []).slice(1).map((item) => (
                <p key={item.label} className="flex items-center justify-between gap-2 py-1">
                  <span className="text-[11px] text-gray-500">{item.label}</span>
                  {/* 셈한 값과 되비춘 값이 나란히 온다. 둘 다 서버의 것이 아니다. */}
                  <span className="text-[11px] font-bold text-gray-800">
                    {item.compute === undefined
                      ? reflected(item.fieldKey!)
                      : `${formatComputed(computeNumber(item.compute, { draft }))}${item.unit ?? ''}`}
                  </span>
                </p>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {(
              [
                [NODE.submit, 'bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700'],
                [
                  NODE.saveDraft,
                  'border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50',
                ],
                [NODE.cancel, 'py-1.5 text-[11px] font-medium text-gray-400 hover:text-gray-600'],
              ] as const
            ).map(([nodeId, className]) => {
              const spec = buttonAt(nodeId)
              const running =
                spec.action.type === 'submit' &&
                submitAction.runningKey === spec.action.mutationKey
              return (
                <button
                  key={nodeId}
                  type="button"
                  data-node-id={nodeId}
                  onClick={() => pressButton(spec)}
                  className={`w-full rounded-lg ${className}`}
                >
                  {running
                    ? getMutation((spec.action as SubmitAction).mutationKey).messages.submitting
                    : spec.label}
                </button>
              )
            })}
          </div>

          {submitAction.errorMessage === null ? null : (
            <p role="alert" className="text-xs text-red-500">
              {submitAction.errorMessage}
            </p>
          )}
          {/* 명세가 showMissingRequiredFields라고 말한다. 무엇이 비었는지를 짚는다 -
              막혔다는 사실만 알리면 사람이 어디를 봐야 할지 모른다. */}
          {blockedKeys.length === 0 ? null : (
            <p role="alert" className="text-xs font-medium text-red-600">
              {`아직 채우지 않은 칸이 있습니다: ${blockedKeys
                .map((key) => labelOfField(key))
                .join(", ")}`}
            </p>
          )}

          {note === null ? null : (
            <p role="status" className="text-xs font-medium text-gray-500">
              {note}
            </p>
          )}

          {/* 제출하면 무엇이 일어나는지. 화면의 요소가 아니라 화면 수준 카피다. */}
          <p className="flex gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-[10px] text-blue-700">
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.submitNote} className="size-3 shrink-0" />
            <span>{finReq01.meta?.footerNote}</span>
          </p>
        </aside>
      </div>
    </AppShell>
  )
}
