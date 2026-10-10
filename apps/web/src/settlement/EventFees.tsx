import type { EventFeeIncome, EventFees as Fees } from '@vada/contracts'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { won } from '../purchases/purchase-view'

type Props = {
  fees: Fees
  // 정산이 넣은 참가비 수입. 정산 전이거나 받은 참가비가 없으면 null이다.
  feeIncome: EventFeeIncome | null
  // 재정 권한자이고 정산 전이면, 입금 전이 있을 때 먼저 확인하라고 알린다. 정산 뒤에는 입금을 확인할 수 없다.
  hint: boolean
}

// 행사 재정 탭의 참가비 묶음. 받은 참가비와 입금 전, 정산이 넣은 참가비 수입을 보여 준다(표시만 한다).
// 신청자별 입금은 참가자 탭에서 본다. 여기에는 합과 수만 둔다.
export default function EventFees({ fees, feeIncome, hint }: Props) {
  return <section aria-label="참가비" className={cn(cardClass, 'flex flex-col gap-1 p-4')}>
    <h3 className="text-sm font-semibold text-gray-900">참가비</h3>
    <p className="text-sm text-gray-700">{`받은 참가비 ${won(fees.received)} · 입금 확인 ${fees.count}명`}</p>
    {fees.unpaid > 0 && <p className="text-sm text-gray-700">{`입금 전 ${fees.unpaid}명`}</p>}
    {hint && fees.unpaid > 0 && <p className="text-xs text-gray-500">정산 뒤에는 입금을 확인할 수 없어요. 들어온 돈이면 참가자 탭에서 먼저 확인해 주세요.</p>}
    {feeIncome && <p className="text-sm wrap-anywhere text-gray-700">{`${won(feeIncome.amount)}을 ${feeIncome.period.name} 수입으로 넣었어요.`}</p>}
    {feeIncome?.line && <p className="text-xs wrap-anywhere text-gray-500">{`수입 항목: ${feeIncome.line.name}`}</p>}
  </section>
}
