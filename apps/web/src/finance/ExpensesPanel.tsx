import { EXPENSE_LIST_LIMIT } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { EXPENSES_LOAD_FAILED } from '@/lib/messages'
import ExpenseCard from './ExpenseCard'
import type { ExpenseList } from './useExpenses'

// 지출 탭: 결제일 최근 순 목록. 읽는 일은 부모의 목록 훅이 한다.
export function ExpensesPanel({
  list,
  onOpen,
}: {
  list: ExpenseList
  onOpen: (expenseId: string) => void
}) {
  const { state } = list
  if (state.kind === 'loading') return <StateMessage kind="loading">지출 불러오는 중…</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col gap-3">
        <StateMessage kind="error">{EXPENSES_LOAD_FAILED}</StateMessage>
        <Button variant="outline" className="self-start" onClick={() => void list.reload()}>
          다시 시도
        </Button>
      </div>
    )
  const { expenses, truncated } = state.data
  if (expenses.length === 0) return <StateMessage kind="empty">지출 없음</StateMessage>
  return (
    <>
      <ul className="flex flex-col gap-2">
        {expenses.map(expense => (
          <li key={expense.id}>
            <ExpenseCard expense={expense} onOpen={() => onOpen(expense.id)} />
          </li>
        ))}
      </ul>
      {truncated && (
        <StateMessage kind="notice">지출이 많아서 {EXPENSE_LIST_LIMIT}개만 보여요.</StateMessage>
      )}
    </>
  )
}
