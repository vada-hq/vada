import { EXPENSE_ACTIONS, type ExpenseAction } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'

type ExpenseFacts = { cancelled: boolean; paidBy: string | null; reimbursed: boolean }

// 취소는 재정부가, 취소되지 않은 지출에 한다.
export const canCancelExpense = (actor: Actor, facts: ExpenseFacts) =>
  !facts.cancelled && can(actor, 'finance.manage')

// 환급은 먼저 낸 사람이 있고 취소되지 않았고 아직 환급 전일 때 한 번이다.
export const canReimburse = (actor: Actor, facts: ExpenseFacts) =>
  !facts.cancelled && facts.paidBy !== null && !facts.reimbursed && can(actor, 'finance.manage')

// 사유·행사 고치기도 재정부가, 취소되지 않은 지출에 한다(update.ts가 같은 조건으로 막는다).
const canUpdateExpense = (actor: Actor, facts: ExpenseFacts) =>
  !facts.cancelled && can(actor, 'finance.manage')

// 쓰기 경로도 같은 규칙(canCancelExpense, canReimburse)으로 묻는다. 보이는 동작과 되는 동작이 갈리지 않는다.
export function expenseActionsOf(actor: Actor, facts: ExpenseFacts): ExpenseAction[] {
  const allowed: Record<ExpenseAction, boolean> = {
    'expense.cancel': canCancelExpense(actor, facts),
    'expense.reimburse': canReimburse(actor, facts),
    'expense.update': canUpdateExpense(actor, facts),
  }
  return EXPENSE_ACTIONS.filter(action => allowed[action])
}
