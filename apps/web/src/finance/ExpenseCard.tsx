import type { ExpenseSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { dayLabel } from '@/lib/korean-date-text'
import { ExpenseCopyButton } from './ExpenseCopyButton'
import { chipsOf, departmentsLabel, METHOD_LABEL } from './expense-view'
import { wonLabel } from './purchase-view'

// 지출 카드: 사용처(눌러 상세), 내역, 금액, 결제일과 결제 수단, 상태 칩(환급 전, 증빙 없음, 취소됨), 행사와 부서. 목록의 제목은 화면 제목(h1) 바로 아래라 h2다.
export default function ExpenseCard({
  expense,
  onOpen,
}: {
  expense: ExpenseSummary
  onOpen: () => void
}) {
  const chips = chipsOf(expense)
  const context = [expense.event?.name, departmentsLabel(expense)].filter(Boolean).join(' · ')
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-start gap-2">
        <h2 className="min-w-0 flex-1">
          <Button
            variant="link"
            touch
            className="h-auto max-w-full justify-start p-0 text-left text-sm font-semibold break-keep whitespace-normal text-gray-900 wrap-anywhere"
            onClick={onOpen}
          >
            {expense.vendor}
          </Button>
        </h2>
        <span className="text-right text-sm font-semibold whitespace-nowrap text-gray-900 tabular-nums">
          {wonLabel(expense.amount)}
        </span>
      </div>
      <p className="text-sm break-keep wrap-anywhere text-gray-700">{expense.description}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        <span>{dayLabel(expense.paidOn)}</span>
        <span>{METHOD_LABEL[expense.method]}</span>
        {chips.map(chip => (
          <Badge key={chip.label} tone={chip.tone}>
            {chip.label}
          </Badge>
        ))}
      </div>
      {context && <p className="text-xs break-keep text-gray-500 wrap-anywhere">{context}</p>}
      <ExpenseCopyButton expense={expense} />
    </Card>
  )
}
