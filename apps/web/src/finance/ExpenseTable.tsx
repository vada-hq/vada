import type { ExpenseAllocation, ExpenseSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { dayLabel } from '@/lib/korean-date-text'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ExpenseCopyButton } from './ExpenseCopyButton'
import { expenseAmount, expensePurposes, type ExpenseFilters } from './expense-filter'
import { chipsOf, departmentsLabel } from './expense-view'
import { wonLabel } from './purchase-view'

type Props = {
  expenses: ExpenseSummary[]
  allocations: ExpenseAllocation[]
  filters: ExpenseFilters
  onOpen: (expenseId: string) => void
}

const head = 'px-3 py-2 text-xs font-medium break-keep text-fg-muted'
const cell = 'px-3 py-3 align-top text-sm break-keep wrap-anywhere'

function ExpenseRow({
  expense,
  allocations,
  filters,
  onOpen,
}: Omit<Props, 'expenses'> & { expense: ExpenseSummary }) {
  const amount = expenseAmount(expense, allocations, filters)
  const purposes = expensePurposes(expense, allocations, filters)
  const departments = departmentsLabel(expense)
  return (
    <tr
      className={cn(
        'border-t hover:bg-surface-subtle has-[:focus-visible]:bg-surface-muted',
        expense.cancelled && 'opacity-50',
      )}
    >
      <td className={cn(cell, 'text-xs text-fg-muted')}>
        {dayLabel(`${expense.paidOn}T00:00:00+09:00`)}
      </td>
      <td className={cell}>
        <Button
          variant="link"
          className="h-auto max-w-full justify-start p-0 text-left text-sm font-semibold break-keep whitespace-normal text-fg wrap-anywhere"
          onClick={() => onOpen(expense.id)}
        >
          {expense.vendor}
        </Button>
        <p className="mt-1 text-xs text-fg-muted">{expense.description}</p>
      </td>
      <td className={cn(cell, 'text-fg-secondary')}>{expense.event?.name ?? '상시'}</td>
      <td className={cn(cell, departments ? 'text-fg-secondary' : 'text-fg-muted')}>
        {departments || '—'}
      </td>
      <td className={cn(cell, purposes ? 'text-fg-secondary' : 'text-fg-muted')}>
        {purposes || '—'}
      </td>
      <td className={cn(cell, 'text-right tabular-nums')}>
        <span className="font-semibold whitespace-nowrap text-fg">{wonLabel(expense.amount)}</span>
        {amount !== expense.amount && (
          <p className="mt-1 text-xs text-fg-muted">선택 범위 {wonLabel(amount)}</p>
        )}
      </td>
      <td className={cell}>
        <div className="flex flex-wrap gap-1">
          {chipsOf(expense).map(chip => (
            <Badge key={chip.label} tone={chip.tone}>
              {chip.label}
            </Badge>
          ))}
        </div>
      </td>
      <td className={cell}>
        <ExpenseCopyButton expense={expense} />
      </td>
    </tr>
  )
}

export function ExpenseTable({ expenses, ...props }: Props) {
  // 와이어프레임 FIN-LEDGER-01처럼 표를 카드 안에 두고, 좁아지면 표만 옆으로 민다.
  return (
    <div className={cn(cardClass, 'overflow-x-auto')}>
      <table
        aria-label="지출 목록"
        className="w-full min-w-3xl table-fixed border-collapse text-left"
      >
        <thead className="bg-surface-subtle">
          <tr>
            <th scope="col" className={cn(head, 'w-30')}>
              결제일
            </th>
            <th scope="col" className={head}>
              내역
            </th>
            <th scope="col" className={head}>
              행사
            </th>
            <th scope="col" className={cn(head, 'w-28')}>
              부서
            </th>
            <th scope="col" className={head}>
              예산 항목
            </th>
            <th scope="col" className={cn(head, 'w-32 text-right')}>
              금액
            </th>
            <th scope="col" className={cn(head, 'w-24')}>
              증빙
            </th>
            <th scope="col" className={cn(head, 'w-22')}>
              <span className="sr-only">행 복사</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {expenses.map(expense => (
            <ExpenseRow key={expense.id} expense={expense} {...props} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
