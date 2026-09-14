import { useState } from 'react'
import { readListSource, readObjectSource } from '../../data-sources/catalog'
import { getOptionSource } from '../../option-sources/definitions'
import { resolveParams } from '../../spec/params'
import { elementByNodeId, finRev01 } from '../../spec/screens'
import type { ButtonSpec, InputSpec, ItemListSpec, SelectSpec, SummarySpec } from '../../spec/types'
import { useSubmitAction } from '../../spec/useSubmitAction'
import type { ScopeDraft } from '../../state/scopes'
import { NODE, scalar, valueKey } from './spec'

interface PurchaseReviewDraftOptions {
  screenParams: Record<string, string>
  draft: ScopeDraft
  onChangeDraft: (next: ScopeDraft) => void
  onScopeEvent: (scopeKey: string, event: 'complete' | 'cancel') => void
  onNavigate: (screenId: string, params?: Record<string, string>) => void
}

/** 품목별 검토 값, 필수값 판정, 전송 상태와 보조 동작을 관리한다. */
export function usePurchaseReviewDraft({
  screenParams,
  draft,
  onChangeDraft,
  onScopeEvent,
  onNavigate,
}: PurchaseReviewDraftOptions) {
  const [note, setNote] = useState<string | null>(null)
  const submitAction = useSubmitAction()
  const [blocked, setBlocked] = useState(false)
  const missing = (finRev01.params ?? []).filter(
    (param) => (screenParams[param.key] ?? '') === '',
  )
  if (missing.length > 0) return { ready: false as const, missing, screen: finRev01 }

  const values = draft.values
  const setValues = (
    update: (before: Record<string, string | null>) => Record<string, string | null>,
  ) => onChangeDraft({ values: update(draft.values), labels: draft.labels })
  const head = elementByNodeId(finRev01, NODE.head).spec as SummarySpec
  const facts = elementByNodeId(finRev01, NODE.facts).spec as SummarySpec
  const summaryRow = readObjectSource(
    head.dataSourceKey ?? '',
    resolveParams(head.params, { screenParams }),
  )
  const table = elementByNodeId(finRev01, NODE.table).spec as ItemListSpec
  const rows = readListSource(table.dataSourceKey, resolveParams(table.params, { screenParams }))
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
  const reviewNote = itemFieldAt(NODE.reviewNote) as InputSpec
  const resultSource = getOptionSource(result.optionsSource.key)
  const resultOptions = resultSource.type === 'static' ? resultSource.options : []
  const buttonAt = (nodeId: string) => elementByNodeId(finRev01, nodeId).spec as ButtonSpec
  const back = buttonAt(NODE.back)
  const send = buttonAt(NODE.send)
  const requiredKeys = rows.flatMap((row) =>
    [approvedAmount, result]
      .filter((field) => field.required)
      .map((field) => valueKey(listKey, scalar(row, 'id'), field.fieldKey)),
  )
  const valueOf = (row: (typeof rows)[number], fieldKey: string) =>
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
  const swap = send.labelWhenAnyItemIs
  const swapped = swap !== undefined && rows.some((row) => valueOf(row, swap.fieldKey) === swap.value)
  const sendLabel = swapped && swap !== undefined ? swap.label : send.label

  const setValue = (row: (typeof rows)[number], fieldKey: string, next: string) => {
    setValues((before) => ({
      ...before,
      [valueKey(listKey, scalar(row, 'id'), fieldKey)]: next,
    }))
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
      payload: { ...values, requestId: screenParams.requestId ?? '' },
      onNavigate,
      paramSources: { screenParams },
      onScopeEvent,
    })
  }

  const pressPending = (spec: ButtonSpec) => () => {
    if (spec.action.type === 'pending') setNote(spec.action.note)
  }

  return {
    ready: true as const,
    screen: finRev01,
    breadcrumb: finRev01.breadcrumb,
    head,
    facts,
    summaryRow,
    table,
    rows,
    approvedAmount,
    result,
    reviewNote,
    resultOptions,
    buttonAt,
    back,
    send,
    note,
    submitAction,
    blocked,
    firstMissing,
    swapped,
    sendLabel,
    valueOf,
    setValue,
    pressSend,
    pressPending,
  }
}

export type PurchaseReviewDraftModel = ReturnType<typeof usePurchaseReviewDraft>
export type ReadyPurchaseReviewDraftModel = Extract<PurchaseReviewDraftModel, { ready: true }>
