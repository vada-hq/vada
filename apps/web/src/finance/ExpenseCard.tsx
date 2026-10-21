import type { ExpenseSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { monthDay } from '@/lib/korean-date-text'
import { chipsOf, METHOD_LABEL } from './expense-view'
import { wonLabel } from './purchase-view'

// 지출 카드: 사용처(눌러 상세), 내역, 금액, 결제일과 결제 수단, 상태 칩(환급 전, 증빙 없음, 취소됨). 목록의 제목은 화면 제목(h1) 바로 아래라 h2다.
export default function ExpenseCard({
  expense,
  onOpen,
}: {
  expense: ExpenseSummary
  onOpen: () => void
}) {
  const chips = chipsOf(expense)
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1">
          <Button
            variant="link"
            className="h-auto max-w-full justify-start p-0 text-left text-sm font-semibold whitespace-normal text-gray-900 wrap-anywhere"
            onClick={onOpen}
          >
            {expense.vendor}
          </Button>
        </h2>
        <span className="text-sm font-semibold whitespace-nowrap text-gray-900">
          {wonLabel(expense.amount)}
        </span>
      </div>
      <p className="text-sm wrap-anywhere text-gray-700">{expense.description}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        <span>{monthDay(expense.paidOn)}</span>
        <span>{METHOD_LABEL[expense.method]}</span>
        {chips.map(chip => (
          <Badge key={chip.label} tone={chip.tone}>
            {chip.label}
          </Badge>
        ))}
      </div>
    </Card>
  )
}
