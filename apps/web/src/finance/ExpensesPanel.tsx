import { useState } from 'react'
import { EXPENSE_LIST_LIMIT, type ExpensesResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { EXPENSES_LOAD_FAILED } from '@/lib/messages'
import ExpenseCard from './ExpenseCard'
import type { ExpenseList } from './useExpenses'
import { ExpenseFilters } from './ExpenseFilters'
import { expenseAmount, filterExpenses } from './expense-filter'
import { wonLabel } from './purchase-view'

// 지출 탭: 결제일 최근 순 목록. 읽는 일은 부모의 목록 훅이 한다.
type Props = {
  list: ExpenseList
  onOpen: (expenseId: string) => void
  periodId?: string | null
  onPeriod?: (periodId: string | null) => void
  eventId?: string
  onEvent?: (eventId: string) => void
}

export function ExpensesPanel({ list, ...props }: Props) {
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
  return <ReadyExpenses data={state.data} {...props} />
}

function ReadyExpenses({
  data,
  onOpen,
  periodId = null,
  onPeriod,
  eventId,
  onEvent,
}: Omit<Props, 'list'> & { data: ExpensesResponse }) {
  const [filters, setFilters] = useState({
    eventId: '',
    budgetItemId: '',
    evidence: '',
    search: '',
  })
  const { expenses, truncated, allocations = [], periods = [] } = data
  const period = periods.find(row => row.id === periodId) ?? null
  if (periodId && !period)
    return <StateMessage kind="error">회계 기간을 찾을 수 없어요.</StateMessage>
  const selected = { ...filters, period, eventId: eventId ?? filters.eventId }
  const found = filterExpenses(expenses, allocations, selected)
  const total = found
    .filter(row => !row.cancelled)
    .reduce((sum, row) => sum + expenseAmount(row, allocations, selected), 0)
  return (
    <>
      <ExpenseFilters
        expenses={expenses}
        allocations={allocations}
        periods={periods}
        filters={selected}
        onChange={next => {
          setFilters(next)
          if (next.period?.id !== period?.id) onPeriod?.(next.period?.id ?? null)
          if (next.eventId !== selected.eventId) onEvent?.(next.eventId)
        }}
      />
      <div className="flex justify-between gap-3 text-sm text-gray-500 tabular-nums" role="status">
        <span>{found.length}건</span>
        <span>합계 {wonLabel(total)}</span>
      </div>
      {found.length === 0 && <StateMessage kind="empty">지출 없음</StateMessage>}
      <ul className="flex flex-col gap-2">
        {found.map(expense => (
          <li key={expense.id}>
            <ExpenseCard expense={expense} onOpen={() => onOpen(expense.id)} />
            {expenseAmount(expense, allocations, selected) !== expense.amount && (
              <p className="text-right text-xs text-gray-500 tabular-nums">
                선택 범위 {wonLabel(expenseAmount(expense, allocations, selected))}
              </p>
            )}
          </li>
        ))}
      </ul>
      {truncated && (
        <StateMessage kind="notice">지출이 많아서 {EXPENSE_LIST_LIMIT}개만 보여요.</StateMessage>
      )}
    </>
  )
}
