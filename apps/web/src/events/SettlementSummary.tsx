import type { EventSettlement } from '@vada/contracts'
import { Fact } from '@/components/Fact'
import { Badge } from '@/components/ui/badge'
import { wonLabel } from '../finance/purchase-view'
import { differenceLabel } from './settlement-view'

// 예산 대비 실제: 지출 예산, 실제 지출, 차이, 참가비(입금 수와 환불 대기 수). 사람마다의 금액은 없다(PRIN-5).
export function SettlementNumbers({ settlement }: { settlement: EventSettlement }) {
  const { budget, actual } = settlement
  return (
    <dl aria-label="예산과 실제" className="grid grid-cols-2 gap-4">
      <Fact label="지출 예산">{wonLabel(budget.expense)}</Fact>
      <Fact label="실제 지출">{wonLabel(actual.expense)}</Fact>
      <Fact label="차이">{differenceLabel(settlement.difference)}</Fact>
      <Fact label="참가비">
        {wonLabel(actual.fee)} · 입금 {actual.depositCount}건
        {actual.refundPendingCount > 0 && ` · 환불 대기 ${actual.refundPendingCount}건`}
      </Fact>
      {budget.income > 0 && <Fact label="수입 예산">{wonLabel(budget.income)}</Fact>}
    </dl>
  )
}

// 예산 항목마다 쓴 돈(지출 항목) 또는 들어온 돈(수입 항목).
export function SettlementItems({ items }: { items: EventSettlement['budget']['items'] }) {
  if (items.length === 0) return null
  return (
    <section aria-label="예산 항목" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-gray-700">예산 항목</h3>
      <ul className="flex flex-col gap-2">
        {items.map(item => (
          <li key={item.id} className="flex flex-col gap-1 rounded-sm border p-3 text-xs">
            <span className="flex items-start gap-2">
              <span className="min-w-0 flex-1 text-sm font-medium wrap-anywhere text-gray-900">
                {item.purpose}
              </span>
              <Badge tone={item.type === 'income' ? 'info' : 'neutral'}>
                {item.type === 'income' ? '수입' : '지출'}
              </Badge>
            </span>
            <span className="text-gray-500">
              {item.type === 'income' ? '들어온 돈' : '쓴 돈'} {wonLabel(item.used)} / 예산{' '}
              {wonLabel(item.amount)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
