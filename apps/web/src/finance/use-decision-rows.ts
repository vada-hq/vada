import { useState } from 'react'
import type { BudgetItemView, PurchaseLineItem } from '@vada/contracts'
import {
  approvalOf,
  chosenItem,
  emptyRow,
  rejectionOf,
  rememberItem,
  type RowValues,
} from './decision-form'
import type { useDecide } from './useDecide'

// 예산을 다시 읽어야 하는 오류(항목이 지금 기간에 맞지 않거나 기간이 없어졌다).
const REREAD_BUDGET = new Set(['BUDGET_ITEM_INVALID', 'NO_FISCAL_PERIOD'])

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

  async function send(decisions: unknown[], approved: PurchaseLineItem[]) {
    const last = approved.at(-1)
    // 보내기 전의 줄 값으로 기억할 항목을 정한다(보내는 동안 다시 그려져도 같다).
    const remembered = last ? chosenOf(last.id) : null
    const result = await decide.decide(decisions)
    if (result.ok && remembered) rememberItem(councilId, remembered)
    if (!result.ok && REREAD_BUDGET.has(result.code)) onInvalidItem()
  }

  return {
    rowOf,
    chosenOf,
    approval,
    rejection,
    send,
    change: (id: string, patch: Partial<RowValues>) =>
      setRows({ ...rows, [id]: { ...rowOf(id), ...patch } }),
  }
}
