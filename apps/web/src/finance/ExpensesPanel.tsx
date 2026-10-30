import { useState, type ComponentProps } from 'react'
import { EXPENSE_LIST_LIMIT, whoDoes, type ExpensesResponse } from '@vada/contracts'
import { EmptyMessage } from '@/components/EmptyMessage'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { EXPENSES_LOAD_FAILED } from '@/lib/messages'
import { useSplit } from '@/lib/use-split'
import ExpenseCard from './ExpenseCard'
import type { ExpenseList } from './useExpenses'
import { ExpenseFilters } from './ExpenseFilters'
import { ExpenseFilterToggle } from './ExpenseFilterToggle'
import { ExpenseTable } from './ExpenseTable'
import { ExpenseSummaryCells } from './ExpenseSummaryCells'
import { summarizeExpenses } from './expense-summary'
import { expenseAmount, filterExpenses } from './expense-filter'
import { wonLabel } from './purchase-view'

// 지출 탭: 결제일 최근 순 목록. 읽는 일은 부모의 목록 훅이 한다.
type Props = {
  list: ExpenseList
  onOpen: (expenseId: string) => void
  // `finance.manage`가 있으면 지출 적기 버튼이 있다. 없으면 빈 목록에 누가 적는지 보인다.
  canManage: boolean
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

// 거르기로 빈 것은 지출이 있는 것이라 누가 적는지 말하지 않는다.
const whoWrites = (canManage: boolean, expenses: ExpensesResponse['expenses']) =>
  canManage || expenses.length > 0 ? null : whoDoes('finance.manage', '적어요')

function ReadyExpenses({
  data,
  onOpen,
  canManage,
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
  const summary = summarizeExpenses(found, allocations, selected)
  const filterProps = {
    expenses,
    allocations,
    periods,
    filters: selected,
    onChange: (next: typeof selected) => {
      setFilters(next)
      if (next.period?.id !== period?.id) onPeriod?.(next.period?.id ?? null)
      if (next.eventId !== selected.eventId) onEvent?.(next.eventId)
    },
  }
  return (
    <>
      <ExpenseHead filterProps={filterProps} summary={summary} truncated={truncated} />
      {found.length === 0 && (
        <EmptyMessage who={whoWrites(canManage, expenses)}>지출 없음</EmptyMessage>
      )}
      <ExpenseRows expenses={found} allocations={allocations} filters={selected} onOpen={onOpen} />
    </>
  )
}

// 필터 칸, 요약, 상한 안내. 넓은 화면은 필터 칸이 요약 위에 늘 펼쳐져 있고, 좁으면 요약이 먼저이고 칸은 [필터]로 접힌다.
function ExpenseHead({
  filterProps,
  summary,
  truncated,
}: {
  filterProps: ComponentProps<typeof ExpenseFilters>
  summary: ReturnType<typeof summarizeExpenses>
  truncated: boolean
}) {
  const wide = useSplit()
  return (
    <>
      {wide && <ExpenseFilters {...filterProps} />}
      <ExpenseSummaryCells summary={summary} />
      {truncated && (
        <StateMessage kind="notice">지출이 많아서 {EXPENSE_LIST_LIMIT}개만 보여요.</StateMessage>
      )}
      {!wide && <ExpenseFilterToggle {...filterProps} />}
    </>
  )
}

function ExpenseRows({
  expenses,
  allocations,
  filters,
  onOpen,
}: ComponentProps<typeof ExpenseTable>) {
  const wide = useSplit()
  if (wide)
    return (
      <ExpenseTable
        expenses={expenses}
        allocations={allocations}
        filters={filters}
        onOpen={onOpen}
      />
    )
  return (
    <ul className="flex flex-col gap-2">
      {expenses.map(expense => (
        <li key={expense.id}>
          <ExpenseCard expense={expense} onOpen={() => onOpen(expense.id)} />
          {expenseAmount(expense, allocations, filters) !== expense.amount && (
            <p className="text-right text-xs text-fg-muted tabular-nums">
              선택 범위 {wonLabel(expenseAmount(expense, allocations, filters))}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}
