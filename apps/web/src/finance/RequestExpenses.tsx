import { koreanDateOf, type PurchaseExpenseRef } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { monthDay } from '@/lib/korean-date-text'
import { wonLabel } from './purchase-view'

// 이 요청의 품목을 결제한 지출. 누르면 그 지출이 열린다. 결제한 지출이 없으면 보이지 않는다.
export function RequestExpenses({
  expenses,
  onOpen,
}: {
  expenses: PurchaseExpenseRef[]
  onOpen: (expenseId: string) => void
}) {
  if (expenses.length === 0) return null
  return (
    <section aria-label="결제한 지출" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-gray-700">결제한 지출</h3>
      <ul className="flex flex-col gap-1">
        {expenses.map(expense => (
          <li key={expense.id} className="flex items-center gap-2">
            <Button
              variant="link"
              className="h-auto min-w-0 justify-start p-0 text-left text-sm whitespace-normal wrap-anywhere"
              onClick={() => onOpen(expense.id)}
            >
              {expense.vendor} · {wonLabel(expense.amount)} ·{' '}
              {monthDay(koreanDateOf(new Date(expense.paidAt)))}
            </Button>
            {expense.cancelled && <Badge>취소됨</Badge>}
          </li>
        ))}
      </ul>
    </section>
  )
}
