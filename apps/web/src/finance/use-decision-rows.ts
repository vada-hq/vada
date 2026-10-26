import { useState } from 'react'
import type { BudgetItemView, PurchaseLineItem } from '@vada/contracts'
import { useFormCheck, type FieldErrors } from '@/lib/use-form-check'
import { overagesOf } from './decision-budget'
import {
  chosenItem,
  decisionErrors,
  decisionOf,
  emptyRow,
  rememberItem,
  tallyOf,
  type DecisionEntry,
  type RowValues,
} from './decision-form'
import type { useDecide } from './useDecide'

// 예산을 다시 읽어야 하는 오류(항목이 지금 기간에 맞지 않거나 기간이 없어졌다).
const REREAD_BUDGET = new Set(['BUDGET_ITEM_INVALID', 'NO_FISCAL_PERIOD'])

export type DecisionRowsOptions = {
  councilId: string
  items: readonly PurchaseLineItem[]
  budgetItems: readonly BudgetItemView[]
  decide: ReturnType<typeof useDecide>
  onInvalidItem: () => void
  // 처음 입력값. 부품 확인 화면이 고른 뒤의 모양을 보이려고 준다. 실제 화면은 비워 둔다.
  initial?: Record<string, RowValues>
}

// 줄 하나의 칸 문제. 칸 이름은 '줄 id.칸'이다.
const errorsOfRow = (errors: FieldErrors, id: string) => ({
  choice: errors[`${id}.choice`],
  amount: errors[`${id}.amount`],
  budgetItemId: errors[`${id}.budgetItemId`],
  reason: errors[`${id}.reason`],
})

// 보일 문제: 줄마다의 칸 문제와, 한 번 누른 뒤 고르지 않은 품목이 남아 있는가(보내기 옆 '미검토 N'을 빨갛게).
const shownErrors = (errors: FieldErrors) => ({
  errorsOf: (id: string) => errorsOfRow(errors, id),
  unreviewedShown: Object.keys(errors).some(key => key.endsWith('.choice')),
})

// 고른 예산 항목(기억한 것 포함)으로 센 초과.
const overagesOfEntries = (entries: DecisionEntry[], budgetItems: readonly BudgetItemView[]) =>
  overagesOf(
    entries.map(({ row, chosen }) => ({ ...row, budgetItemId: chosen })),
    budgetItems,
  )

// 결재 줄들의 입력값과 한 번에 보내기(DEC-92: 품목마다 고른 뒤 한 번에 처리).
// 승인이 되면 마지막에 승인한 항목을 기억하고, 항목이 맞지 않다고 하면(BUDGET_ITEM_INVALID) 예산을 다시 읽게 한다.
export function useDecisionRows({
  councilId,
  items,
  budgetItems,
  decide,
  onInvalidItem,
  initial = {},
}: DecisionRowsOptions) {
  const [rows, setRows] = useState<Record<string, RowValues>>(initial)
  // 사용 가능을 넘는 승인을 보내기 전 확인 창이 열려 있는가.
  const [confirming, setConfirming] = useState(false)
  const rowOf = (id: string) => rows[id] ?? emptyRow(items.find(item => item.id === id))
  const chosenOf = (id: string) => chosenItem(rowOf(id), councilId, budgetItems)
  const entries = (): DecisionEntry[] =>
    items.map(item => ({ id: item.id, row: rowOf(item.id), chosen: chosenOf(item.id) }))
  const check = useFormCheck<HTMLDivElement>(() => decisionErrors(entries()))
  const tally = tallyOf(items.map(item => rowOf(item.id).choice))
  const overages = overagesOfEntries(entries(), budgetItems)

  async function send() {
    setConfirming(false)
    const current = entries()
    // 보내기 전의 줄 값으로 기억할 항목을 정한다(보내는 동안 다시 그려져도 같다).
    const remembered = current.filter(entry => entry.row.choice === 'approve').at(-1)?.chosen
    const result = await decide.decide(current.map(decisionOf))
    if (result.ok && remembered) rememberItem(councilId, remembered)
    if (!result.ok && REREAD_BUDGET.has(result.code)) onInvalidItem()
  }

  // 버튼은 끄지 않는다. 누를 때 확인해 문제가 있으면(고르지 않은 품목 포함) 그 줄의 칸 아래에 보이고 보내지 않는다.
  // 사용 가능을 넘는 항목이 있으면 막지 않고 한 번 묻는다(DEC-92 '그래도 승인').
  function submit() {
    if (!check.attempt()) return
    if (overages.length > 0) setConfirming(true)
    else void send()
  }

  // '그래도 승인': 창이 열린 사이 요청을 다시 읽어 새 대기 품목이 생겼을 수 있어 한 번 더 확인한다.
  function confirm() {
    if (check.attempt()) void send()
    else setConfirming(false)
  }

  return {
    formRef: check.formRef,
    ...shownErrors(check.errors),
    rowOf,
    chosenOf,
    tally,
    overages,
    confirming,
    submit,
    confirm,
    cancelConfirm: () => setConfirming(false),
    change: (id: string, patch: Partial<RowValues>) =>
      setRows({ ...rows, [id]: { ...rowOf(id), ...patch } }),
  }
}
