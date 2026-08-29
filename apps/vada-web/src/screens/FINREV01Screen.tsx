import { useState } from 'react'
import { AppShell } from '../components/AppShell'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { ChoiceGroup } from '../components/ChoiceGroup'
import { FigmaAsset } from '../components/FigmaAsset'
import { NEUTRAL_CHIP, NEUTRAL_VALUE, STATE_CHIP, TYPE_CHIP, VERDICT_CHOICE } from '../design/tones'
import { findDataSource, readListSource, readObjectSource } from '../data-sources/catalog'
import type { DataRow } from '../data-sources/catalog'
import { getOptionSource } from '../option-sources/catalog'
import { useSubmitAction } from '../spec/useSubmitAction'
import { resolveParams } from '../spec/params'
import type { ScopeDraft } from '../state/scopes'
import { elementByNodeId, finRev01 } from '../spec/screens'
import type { ButtonSpec, InputSpec, ItemListSpec, SelectSpec, SummarySpec } from '../spec/types'

// 구매 요청 검토(FIN-REV-01).
//
// 재정부가 보는 쪽이다. 같은 요청을 요청자도 보지만(FIN-REQ-02) 출처가 다르다 —
// 예산 사용 가능액처럼 요청자에게 보이지 않는 값이 여기에만 온다.
//
// 이 화면이 처음인 것은 **표 안에서 고친다**는 것이다. 지금까지 itemList는 읽기
// 전용이었고, 고치는 목록은 사람이 항목을 만드는 list뿐이었다. 여기서는 항목을
// 서버가 주고 사람은 각 줄의 두 칸만 고친다.
//
// 그리고 **버튼의 글이 고른 것에 따라 바뀐다.** 품목을 하나라도 보완으로 두면
// 나가는 것이 보완 요청이고 전부 승인이면 검토가 끝난 것인데, 보내는 일은 하나다.

const SCREEN = 'FIN-REV-01'

const NODE = {
  head: '30:1400',
  facts: '30:1421',
  tabs: ['30:1454', '30:1457', '30:1460', '30:1463'],
  table: '30:1467',
  approvedAmount: '30:1482',
  result: '30:1485',
  back: '30:1551',
  send: '30:1556',
} as const

const ASSET = { back: '30:1552' } as const

// 사용 가능액만 도드라진다. 그것이 승인 여부를 좌우하는 값이기 때문이다 -
// 데이터가 정할 일이 아니라 이 화면이 무엇을 앞세울지 정하는 것이다.
const TILE_TONE: Record<string, string> = { budgetAvailableNote: 'text-blue-600' }

const BREADCRUMB_SEPARATORS = ['30:1373', '30:1378', '30:1383', '30:1388']

interface FINREV01ScreenProps {
  screenParams: Record<string, string>
  /** 명세가 stateScopeKey로 말한 자리. 쓰던 것은 여기 남는다. */
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  /** 명세가 onSuccess.scopeEvent를 말하면 보낸 뒤 그 스코프를 비운다. */
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

// 판정의 단위가 품목이므로 값도 품목마다 갈린다.
function valueKey(listKey: string, itemId: string, fieldKey: string): string {
  return `${listKey}.${itemId}.${fieldKey}`
}

function scalar(row: DataRow, field: string): string {
  const value = row[field]
  if (value === undefined || Array.isArray(value)) {
    throw new Error(`FIN-REV-01의 조각 '${field}'는 한 줄의 값이어야 합니다.`)
  }
  return String(value)
}

export function FINREV01Screen({
  screenParams,
  draft,
  onChangeDraft,
  onScopeEvent,
  onNavigate,
}: FINREV01ScreenProps) {
  // 값은 **화면 안이 아니라 스코프에 산다**(명세: stateScopeKey, 수명 flow).
  // 한동안 이 화면은 useState에만 담았고, 그래서 뒤로 갔다 오면 쓰던 것이
  // 사라졌다 - 명세가 말한 수명이 거짓이었다(2026-08-27 감사).
  const values = draft.values
  const setValues = (update: (before: Record<string, string | null>) => Record<string, string | null>) => {
    onChangeDraft({ values: update(draft.values), labels: draft.labels })
  }
  const [note, setNote] = useState<string | null>(null)
  const submitAction = useSubmitAction()
  const [blocked, setBlocked] = useState(false)

  const missing = (finRev01.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) {
    return (
      <AppShell
        screenId={finRev01.screenId}
        activeNavigationScreenId={finRev01.activeNavigationScreenId}
        eyebrow={finRev01.meta?.eyebrow}
        title={finRev01.meta?.title ?? finRev01.screenId}
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

  const breadcrumb = finRev01.breadcrumb
  const head = elementByNodeId(finRev01, NODE.head).spec as SummarySpec
  const facts = elementByNodeId(finRev01, NODE.facts).spec as SummarySpec
  const summaryRow = readObjectSource(
    head.dataSourceKey ?? '',
    resolveParams(head.params, { screenParams }),
  )

  const table = elementByNodeId(finRev01, NODE.table).spec as ItemListSpec
  const rows = readListSource(table.dataSourceKey, resolveParams(table.params, { screenParams }))
  const tableSource = findDataSource(table.dataSourceKey)
  // 고칠 것이 있는 목록은 모은 값의 이름을 갖는다(itemList.fieldKey). 없으면
  // 그 값들을 아무도 가리킬 수 없다.
  const listKey = table.fieldKey
  if (listKey === undefined) {
    throw new Error('FIN-REV-01의 품목 표에 fieldKey가 없습니다. 고친 값을 담을 이름이 없습니다.')
  }

  const itemFieldAt = (nodeId: string) => {
    const found = (table.itemFields ?? []).find((element) => element.source?.nodeId === nodeId)
    if (found === undefined) {
      throw new Error(`FIN-REV-01의 항목에 노드 ${nodeId}가 등록되지 않았습니다.`)
    }
    return found.spec
  }
  const approvedAmount = itemFieldAt(NODE.approvedAmount) as InputSpec
  const result = itemFieldAt(NODE.result) as SelectSpec
  const resultSource = getOptionSource(result.optionsSource.key)
  const resultOptions = resultSource.type === 'static' ? resultSource.options : []

  const buttonAt = (nodeId: string) => elementByNodeId(finRev01, nodeId).spec as ButtonSpec
  const back = buttonAt(NODE.back)
  const send = buttonAt(NODE.send)

  // 채워야 할 칸은 줄마다 둘이다. 요청액이 처음 값으로 들어 있어도 사람이 지울 수
  // 있으므로 비어 있는지를 그릴 때 본다.
  const requiredKeys = rows.flatMap((row) =>
    [approvedAmount, result]
      .filter((field) => field.required)
      .map((field) => valueKey(listKey, scalar(row, 'id'), field.fieldKey)),
  )
  // 항목의 칸은 조각 이름이 같으면 그 값으로 시작한다(draftFrom과 같은 규칙).
  // 검토는 한 번에 끝나지 않으므로 앞서 고른 것이 데이터로 함께 온다.
  const valueOf = (row: DataRow, fieldKey: string) =>
    values[valueKey(listKey, scalar(row, 'id'), fieldKey)] ??
    (row[fieldKey] === undefined ? '' : scalar(row, fieldKey))
  const filled = new Set(
    rows.flatMap((row) =>
      [approvedAmount, result]
        .filter((field) => valueOf(row, field.fieldKey) !== '')
        .map((field) => valueKey(listKey, scalar(row, 'id'), field.fieldKey)),
    ),
  )
  const firstMissing = requiredKeys.find((key) => !filled.has(key))

  // 글이 바뀌는 조건은 이름 붙은 하나다. 어느 칸을 어떤 값과 견주는지는 명세가 말한다.
  const swap = send.labelWhenAnyItemIs
  const swapped =
    swap !== undefined &&
    rows.some((row) => valueOf(row, swap.fieldKey) === swap.value)
  const sendLabel = swapped && swap !== undefined ? swap.label : send.label

  // 함수 선언은 끌어올려지므로 위의 판정이 미치지 않는다. listKey가 정해진 뒤의
  // 화살표 함수라야 그 좁힌 타입을 그대로 쓴다.
  const setValue = (row: DataRow, fieldKey: string, next: string) => {
    setValues((before) => ({ ...before, [valueKey(listKey, scalar(row, 'id'), fieldKey)]: next }))
  }

  function pressSend() {
    if (send.action.type !== 'submit') return
    if (send.action.executeWhen !== undefined && firstMissing !== undefined) {
      setBlocked(true)
      return
    }
    setBlocked(false)
    setNote(null)
    void submitAction.run(send.action, {
      payload: values,
      onNavigate,
      // 무엇을 넘길지는 명세가 말한다(onSuccess.params). 화면은 그 값이
      // 어디 있는지만 알려 준다.
      paramSources: { screenParams },
      onScopeEvent,
    })
  }

  function pressPending(spec: ButtonSpec) {
    return () => {
      if (spec.action.type === 'pending') setNote(spec.action.note)
    }
  }

  return (
    <AppShell
      screenId={finRev01.screenId}
      activeNavigationScreenId={finRev01.activeNavigationScreenId}
      eyebrow={finRev01.meta?.eyebrow}
      title={finRev01.meta?.title ?? finRev01.screenId}
      onNavigate={onNavigate}
      breadcrumb={
        breadcrumb === undefined ? undefined : (
          <Breadcrumbs
            nodeId={breadcrumb.source}
            screenId={SCREEN}
            separatorNodeIds={BREADCRUMB_SEPARATORS}
            items={breadcrumb.items.map((item) =>
              item.field === undefined
                ? (item.value ?? '')
                : scalar(summaryRow, item.field),
            )}
          />
        )
      }
    >
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 px-8 py-6">
        <section
          data-node-id={NODE.head}
          className="flex items-start justify-between gap-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="text-xs font-normal text-gray-400">
                {scalar(summaryRow, head.eyebrowField ?? '')}
              </span>
              <span
                data-design-state
                data-design-rule="state-chip"
                className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${
                  STATE_CHIP[scalar(summaryRow, head.status?.[0]?.toneField ?? '')] ?? NEUTRAL_CHIP
                }`}
              >
                {scalar(summaryRow, head.status?.[0]?.field ?? '')}
              </span>
            </span>
            <span className="block pt-1 text-lg font-bold text-gray-900">{head.title}</span>
          </span>
          <span className="flex shrink-0 gap-6">
            {(head.items ?? []).map((item) => (
              <span
                key={item.field}
                className="rounded-lg border border-gray-100 px-4 py-2 text-right"
              >
                <span className="block text-xs font-semibold text-gray-400">{item.label}</span>
                <span
                  className={`block pt-1 text-lg font-bold ${
                    TILE_TONE[item.field ?? ''] ?? NEUTRAL_VALUE
                  }`}
                >
                  {scalar(summaryRow, item.field ?? '')}
                </span>
              </span>
            ))}
          </span>
        </section>

        <section
          data-node-id={NODE.facts}
          className="grid grid-cols-3 gap-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm"
        >
          {(facts.items ?? []).map((item) => (
            <span key={item.field}>
              <span className="block text-xs font-semibold text-gray-400">{item.label}</span>
              <span className="block pt-1 text-xs font-normal text-gray-700">
                {scalar(summaryRow, item.field ?? '')}
              </span>
            </span>
          ))}
        </section>

        <div className="flex gap-2">
          {NODE.tabs.map((nodeId) => {
            const spec = buttonAt(nodeId)
            return (
              <button
                key={nodeId}
                type="button"
                data-node-id={nodeId}
                disabled={spec.initiallyDisabled}
                aria-current={spec.initiallyDisabled ? 'page' : undefined}
                onClick={pressPending(spec)}
                className={
                  spec.initiallyDisabled
                    ? 'rounded-lg border border-blue-600 px-3 py-2 text-xs font-semibold text-blue-700'
                    : 'rounded-lg px-3 py-2 text-xs font-semibold text-gray-400 hover:bg-gray-100'
                }
              >
                {spec.label}
              </button>
            )
          })}
        </div>

        <section
          data-node-id={NODE.table}
          className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
        >
          <div className="overflow-x-auto">
            <table aria-label={finRev01.meta?.title ?? SCREEN} className="w-full min-w-[880px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {(table.columns ?? []).map((column) => (
                    <th
                      key={column.label}
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-bold text-gray-500"
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={(table.columns ?? []).length}
                      className="px-6 py-8 text-center text-sm text-gray-500"
                    >
                      {tableSource.messages.empty}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={scalar(row, 'id')} className="border-b border-gray-50 last:border-b-0">
                      <td className="px-6 py-3 align-middle">
                        <span className="flex flex-col gap-1">
                          <span className="text-xs font-bold text-gray-800">
                            {scalar(row, 'name')}
                          </span>
                          <span className="text-xs font-medium text-gray-400">
                            {scalar(row, 'categoryNote')}
                          </span>
                          <span
                            data-design-rule="state-chip"
                            className={`inline-flex self-start rounded px-2 py-0.5 text-xs font-normal ${TYPE_CHIP}`}
                          >
                            {scalar(row, 'purchaseType')}
                          </span>
                        </span>
                      </td>
                      <td className="px-6 py-3 align-middle text-xs font-medium text-gray-600">
                        {scalar(row, 'quantityNote')}
                      </td>
                      <td className="px-6 py-3 align-middle text-xs font-normal text-gray-600">
                        {scalar(row, 'amountNote')}
                      </td>

                      {/* 라벨은 열 머리가 한 번 그렸다. 칸 안에 다시 그리지 않는다. */}
                      <td data-node-id={NODE.approvedAmount} className="px-6 py-3 align-middle">
                        <input
                          type="number"
                          aria-label={`${scalar(row, 'name')} ${approvedAmount.label}`}
                          value={valueOf(row, approvedAmount.fieldKey)}
                          onChange={(event) =>
                            setValue(row, approvedAmount.fieldKey, event.target.value)
                          }
                          className="w-28 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-normal text-gray-900 focus-visible:ring-2 focus-visible:ring-blue-600/50 focus-visible:outline-none"
                        />
                      </td>
                      <td data-node-id={NODE.result} className="px-6 py-3 align-middle">
                        <ChoiceGroup
                          id={`${scalar(row, 'id')}-${result.fieldKey}`}
                          disabled={result.initiallyDisabled}
                          sourceKey={result.optionsSource.key}
                          sourceParams={{}}
                          value={
                            resultOptions.find(
                              (option) => option.value === valueOf(row, result.fieldKey),
                            ) ?? null
                          }
                          onSelect={(option) => setValue(row, result.fieldKey, option.value)}
                          selectedToneByValue={VERDICT_CHOICE}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {submitAction.submittingMessage === null ? null : (
          <p role="status" className="text-sm text-gray-600">
            {submitAction.submittingMessage}
          </p>
        )}
        {submitAction.errorMessage === null ? null : (
          <p role="alert" className="text-sm text-red-700">
            {submitAction.errorMessage}
          </p>
        )}
        {note === null ? null : (
          <p role="status" className="text-sm text-gray-600">
            {note}
          </p>
        )}
        {!blocked || firstMissing === undefined ? null : (
          <p role="alert" className="text-sm text-red-700">
            아직 판정하지 않은 품목이 있습니다.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            data-node-id={NODE.back}
            onClick={pressPending(back)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <FigmaAsset screenId={SCREEN} nodeId={ASSET.back} className="size-3.5" />
            {back.label}
          </button>
          <button
            type="button"
            data-node-id={NODE.send}
            onClick={pressSend}
            // 보완이 섞이면 나가는 것이 보완 요청이다. 글만이 아니라 무게도 바뀐다.
            className={`rounded-lg px-4 py-2 text-xs font-medium text-white ${
              swapped ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {sendLabel}
          </button>
        </div>
      </div>
    </AppShell>
  )
}
