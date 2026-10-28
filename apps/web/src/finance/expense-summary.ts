import type { ExpenseAllocation, ExpenseSummary } from '@vada/contracts'
import { expenseAmount, type ExpenseFilters } from './expense-filter'
import { missingEvidence } from './expense-view'

export function summarizeExpenses(
  expenses: ExpenseSummary[],
  allocations: ExpenseAllocation[],
  filters: ExpenseFilters,
) {
  return {
    amount: expenses
      .filter(expense => !expense.cancelled)
      .reduce((sum, expense) => sum + expenseAmount(expense, allocations, filters), 0),
    count: expenses.length,
    missingEvidence: expenses.filter(missingEvidence).length,
  }
}
