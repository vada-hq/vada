import type { EventSettlement } from '@vada/contracts'
import { Fact } from '@/components/Fact'
import { BudgetItemList } from '../finance/BudgetItemList'
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

// 예산 항목마다 배정, 실제 지출, 지출 예정, 사용 가능(수입 항목은 예산과 들어온 돈). 예산 탭과 같은 칸이다.
export function SettlementItems({ items }: { items: EventSettlement['budget']['items'] }) {
  if (items.length === 0) return null
  return (
    <section aria-label="예산 항목" className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-gray-700">예산 항목</h3>
      <BudgetItemList items={items} />
    </section>
  )
}
