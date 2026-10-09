import type { ExpenseSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { won } from '../purchases/purchase-view'
import { dayText, eventText, methodLabels } from './expense-view'

// 사용 내역의 지출 한 건. 누르면 상세를 연다. 취소한 지출은 금액에 줄을 긋고 "취소됨"만 붙인다.
export default function ExpenseCard({ expense, onOpen }: { expense: ExpenseSummary; onOpen: () => void }) {
  return <li className={cn(cardClass, 'flex flex-col gap-1.5 p-4', expense.voided && 'bg-gray-50')}>
    <div className="flex items-start gap-2">
      <Button variant="ghost" onClick={onOpen} className="h-auto min-w-0 flex-1 shrink justify-start p-0 text-left text-sm font-medium whitespace-normal wrap-anywhere text-gray-900 hover:bg-transparent hover:underline">{expense.vendor}</Button>
      <span className={cn('shrink-0 text-sm font-semibold text-gray-900', expense.voided && 'text-gray-400 line-through')}>{won(expense.amount)}</span>
    </div>
    <p className="text-xs wrap-anywhere text-gray-700">{expense.description}</p>
    <p className="text-xs wrap-anywhere text-gray-500">{dayText(expense.paidOn)} · {methodLabels[expense.method]} · {expense.payer.name}</p>
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge className="whitespace-normal wrap-anywhere">{eventText(expense)}</Badge>
      {expense.voided ? <Badge>취소됨</Badge>
        : <Badge tone={expense.evidence === 'complete' ? 'success' : 'warning'}>{expense.evidence === 'complete' ? '증빙 완료' : '증빙 누락'}</Badge>}
    </div>
  </li>
}
