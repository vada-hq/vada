import type { BudgetItemView } from '@vada/contracts'
import { wonOf } from '@/lib/won-input'
import { signedWon } from './closing-view'
import type { Choice } from './decision-form'
import { wonLabel } from './purchase-view'

// 결재 줄에서 예산에 닿는 값만. 승인을 고른 줄의 금액이 그 항목에서 빠진다.
type Line = { choice: Choice; amount: string; budgetItemId: string }

// 이번 승인 뒤 사용 가능이 음수가 되는 항목. after는 승인한 뒤의 사용 가능(음수)이다.
export type Overage = { id: string; purpose: string; available: number; after: number }

const availableOf = (item: BudgetItemView) => (item.type === 'expense' ? item.available : 0)

// 예산 초과는 막지 않고 알린다(DEC-92, Procurify "approve it anyway?"). 같은 항목에 승인하는 줄의 금액을 모두 더해
// 사용 가능(서버의 예산 셈, 예산 탭과 같은 값)과 맞댄다. 금액이 숫자가 아닌 줄은 칸 확인이 따로 막아 여기서는 세지 않는다.
export function overagesOf(lines: readonly Line[], items: readonly BudgetItemView[]): Overage[] {
  const requested = new Map<string, number>()
  for (const line of lines) {
    const amount = wonOf(line.amount)
    if (line.choice !== 'approve' || Number.isNaN(amount)) continue
    requested.set(line.budgetItemId, (requested.get(line.budgetItemId) ?? 0) + amount)
  }
  return items.flatMap(item => {
    const amount = requested.get(item.id)
    if (amount === undefined || amount === 0) return []
    const available = availableOf(item)
    const after = available - amount
    return after < 0 ? [{ id: item.id, purpose: item.purpose, available, after }] : []
  })
}

// 예산 항목 칸 옆 줄: 그 항목의 사용 가능과, 이번 승인 뒤 배정을 넘는 금액(초과액).
export function usageLineOf(item: BudgetItemView, overages: readonly Overage[]) {
  const over = overages.find(overage => overage.id === item.id)
  return { available: signedWon(availableOf(item)), over: over ? wonLabel(-over.after) : null }
}

// 결재 칸의 항목 차례: 그 요청 행사의 항목이 먼저, 그 아래 행사 없는 항목(DEC-92, DEC-81). 행사 없는 요청은 받은 차례다.
export function eventItemsFirst<T extends Pick<BudgetItemView, 'event'>>(
  items: readonly T[],
  eventId: string | null,
): T[] {
  if (eventId === null) return [...items]
  const own = items.filter(item => item.event?.id === eventId)
  return [...own, ...items.filter(item => item.event?.id !== eventId)]
}
