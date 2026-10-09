import type { IncomeSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { dayText } from '../expenses/expense-view'
import { won } from '../purchases/purchase-view'

// 수입 내역의 수입 한 건. 누르면 상세를 연다. 취소한 수입은 금액에 줄을 긋고 "취소됨"을 붙인다.
export default function IncomeCard({ income, onOpen }: { income: IncomeSummary; onOpen: () => void }) {
  return <li className={cn(cardClass, 'flex flex-col gap-1.5 p-4', income.voided && 'bg-gray-50')}>
    <div className="flex items-start gap-2">
      <Button variant="ghost" onClick={onOpen} className="h-auto min-w-0 flex-1 shrink justify-start p-0 text-left text-sm font-medium whitespace-normal wrap-anywhere text-gray-900 hover:bg-transparent hover:underline">{income.description}</Button>
      <span className={cn('shrink-0 text-sm font-semibold text-gray-900', income.voided && 'text-gray-400 line-through')}>{won(income.amount)}</span>
    </div>
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-gray-500">{dayText(income.receivedOn)}</span>
      {income.budgetLine && <Badge className="whitespace-normal wrap-anywhere">{income.budgetLine.name}</Badge>}
      {income.voided && <Badge>취소됨</Badge>}
    </div>
  </li>
}
