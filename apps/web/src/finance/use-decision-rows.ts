import { useRef, useState } from 'react'
import type { BudgetItemView, PurchaseLineItem } from '@vada/contracts'
import { useFormCheck } from '@/lib/use-form-check'
import {
  approvalOf,
  chosenItem,
  decisionErrors,
  emptyRow,
  rejectionOf,
  rememberItem,
  type DecisionAction,
  type RowValues,
} from './decision-form'
import type { useDecide } from './useDecide'

// 예산을 다시 읽어야 하는 오류(항목이 지금 기간에 맞지 않거나 기간이 없어졌다).
const REREAD_BUDGET = new Set(['BUDGET_ITEM_INVALID', 'NO_FISCAL_PERIOD'])

// 누른 버튼이 다루는 줄만 확인해, 문제는 그 줄에만 보인다.
function useDecisionCheck(rowOf: (id: string) => RowValues, chosenOf: (id: string) => string) {
  const scope = useRef<{ action: DecisionAction; items: PurchaseLineItem[] }>({
    action: 'approve',
    items: [],
  })
  const { formRef, errors, attempt } = useFormCheck<HTMLDivElement>(() =>
    decisionErrors(
      scope.current.items.map(item => ({
        id: item.id,
        action: scope.current.action,
        row: rowOf(item.id),
        chosen: chosenOf(item.id),
      })),
    ),
  )
  const errorsOf = (id: string) => ({
    amount: errors[`${id}.amount`],
    budgetItemId: errors[`${id}.budgetItemId`],
    reason: errors[`${id}.reason`],
  })
  // 확인할 줄을 정하고 확인한다. 보내도 되면 true.
  const attemptFor = (action: DecisionAction, items: PurchaseLineItem[]) => {
    scope.current = { action, items }
    return attempt()
  }
  return { formRef, errorsOf, attemptFor }
}

// 결재 줄들의 입력값과 보내기. 승인이 되면 마지막에 승인한 항목을 기억하고, 항목이 맞지 않다고 하면(BUDGET_ITEM_INVALID) 예산을 다시 읽게 한다.
export function useDecisionRows(
  councilId: string,
  budgetItems: readonly BudgetItemView[],
  decide: ReturnType<typeof useDecide>,
  onInvalidItem: () => void,
) {
  const [rows, setRows] = useState<Record<string, RowValues>>({})
  const rowOf = (id: string) => rows[id] ?? emptyRow()
  const chosenOf = (id: string) => chosenItem(rowOf(id), councilId, budgetItems)
  const approval = (item: PurchaseLineItem) =>
    approvalOf(item.id, rowOf(item.id).amount, chosenOf(item.id))
  const rejection = (item: PurchaseLineItem) => rejectionOf(item.id, rowOf(item.id).reason)

  const decisionOf = (item: PurchaseLineItem, action: DecisionAction) =>
    action === 'approve' ? approval(item) : rejection(item)
  const check = useDecisionCheck(rowOf, chosenOf)

  async function send(decisions: unknown[], approved: PurchaseLineItem[]) {
    const last = approved.at(-1)
    // 보내기 전의 줄 값으로 기억할 항목을 정한다(보내는 동안 다시 그려져도 같다).
    const remembered = last ? chosenOf(last.id) : null
    const result = await decide.decide(decisions)
    if (result.ok && remembered) rememberItem(councilId, remembered)
    if (!result.ok && REREAD_BUDGET.has(result.code)) onInvalidItem()
  }

  // 버튼은 끄지 않는다. 누를 때 확인해 문제가 있으면 그 줄의 칸 아래에 보이고 아무것도 보내지 않는다.
  async function submit(action: DecisionAction, items: PurchaseLineItem[]) {
    if (!check.attemptFor(action, items)) return
    await send(
      items.map(item => decisionOf(item, action)),
      action === 'approve' ? items : [],
    )
  }

  return {
    formRef: check.formRef,
    errorsOf: check.errorsOf,
    rowOf,
    chosenOf,
    submit,
    change: (id: string, patch: Partial<RowValues>) =>
      setRows({ ...rows, [id]: { ...rowOf(id), ...patch } }),
  }
}
