import type { Db } from '../db/client.ts'
import { budgetPlanDraft } from './budget-plan.ts'
import { moneyItems, paidRows, type MoneyItem, type PaidRow } from './money.ts'

export const NOT_PLANNED = '편성 전'
export const NO_BUDGET = '예산 미정'
export const UNALLOCATED = '미배정'

interface BudgetLine {
  id: string
  eventId: string | null
  departmentId: string | null
  amount: number
}

export interface FinanceOverviewFacts {
  period: { start: string; end: string } | null
  sources: Array<{ name: string; amount: number }>
  items: BudgetLine[]
  paid: PaidRow[]
  money: MoneyItem[]
}

export async function financeOverviewFacts(db: Db, orgId: string): Promise<FinanceOverviewFacts> {
  const [draft, paid, money] = await Promise.all([
    budgetPlanDraft(db, orgId),
    paidRows(db, orgId),
    moneyItems(db, orgId),
  ])
  return {
    period:
      draft.periodStart === undefined || draft.periodEnd === undefined
        ? null
        : { start: draft.periodStart, end: draft.periodEnd },
    sources: draft.sources.map((row) => ({ name: row.sourceName, amount: row.sourceAmount })),
    items: [
      ...draft.items.map((row) => ({
        id: row.id,
        eventId: null,
        departmentId: row.itemDepartment ?? null,
        amount: row.itemAmount,
      })),
      ...draft.eventItems.map((row) => ({
        id: row.id,
        eventId: row.eventItemEvent,
        departmentId: null,
        amount: row.eventItemAmount,
      })),
    ],
    paid,
    money,
  }
}

export function percent(part: number, total: number): number {
  return total <= 0 ? 0 : (part / total) * 100
}
