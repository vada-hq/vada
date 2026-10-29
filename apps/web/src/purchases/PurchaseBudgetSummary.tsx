import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { EventSettlement } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { signedWon } from '@/finance/closing-view'
import { wonLabel } from '@/finance/purchase-view'
import { cn } from '@/lib/utils'

type Props = {
  settlement: EventSettlement
  // 카드 줄 오른쪽의 재정부 버튼(예산 편성 등)
  actions?: ReactNode
}

// 행사 예산 요약(와이어프레임 EVT-FIN-01 01): 카드 넷과 예산 항목별 현황. 숫자는 행사 정산과 같은 셈이다.
// 사용 가능 = 배정 − 실제 지출 − 지출 예정(DEC-15 약정).
export function PurchaseBudgetSummary({ settlement, actions }: Props) {
  const [open, setOpen] = useState(true)
  const items = settlement.budget.items.filter(item => item.type === 'expense')
  const committed = items.reduce((sum, item) => sum + (item.committed ?? 0), 0)
  const available = settlement.budget.expense - settlement.actual.expense - committed
  return (
    <section aria-label="예산 요약" className="flex flex-col gap-3">
      <Button
        variant="ghost"
        size="sm"
        className="self-start px-1 text-sm font-semibold text-fg-secondary"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
        예산 요약
      </Button>
      {open && (
        <>
          <div className="flex flex-wrap items-start gap-3">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 lg:grid-cols-4">
              <Money label="배정 예산" value={settlement.budget.expense} />
              <Money label="지출 예정" value={committed} />
              <Money label="실제 지출" value={settlement.actual.expense} />
              <Money label="사용 가능" value={available} strong />
            </div>
            {actions && <div className="flex gap-2">{actions}</div>}
          </div>
          <FeeLine actual={settlement.actual} />
          {items.length > 0 && <ItemsBox items={items} />}
        </>
      )}
    </section>
  )
}

function Money({
  label,
  value,
  strong = false,
}: {
  label: string
  value: number
  strong?: boolean
}) {
  return (
    <div className={cn(cardClass, 'flex flex-col gap-1 p-4')}>
      <span className="text-xs text-fg-muted">{label}</span>
      <span
        className={cn(
          'text-2xl font-bold tabular-nums',
          !strong && 'text-fg',
          strong && (value < 0 ? 'text-danger-emphasis' : 'text-primary-strong'),
        )}
      >
        {strong ? signedWon(value) : wonLabel(value)}
      </span>
    </div>
  )
}

// 참가비는 와이어프레임 카드에 없지만 정산에 드는 돈이라 받은 것이 있을 때만 한 줄로 둔다.
function FeeLine({ actual }: { actual: EventSettlement['actual'] }) {
  if (actual.fee === 0 && actual.depositCount === 0 && actual.refundPendingCount === 0) return null
  return (
    <p className="text-xs text-fg-muted tabular-nums">
      참가비 {wonLabel(actual.fee)} · 입금 {actual.depositCount}건
      {actual.refundPendingCount > 0 && ` · 환불 대기 ${actual.refundPendingCount}건`}
    </p>
  )
}

function ItemsBox({ items }: { items: EventSettlement['budget']['items'] }) {
  return (
    <section aria-label="예산 항목별 현황" className={cn(cardClass, 'flex flex-col')}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-4 py-3">
        <h3 className="text-sm font-semibold text-fg">예산 항목별 현황</h3>
        <span className="text-xs text-fg-muted">배정 − 실제 지출 − 지출 예정</span>
      </header>
      <ul className="grid divide-border-subtle sm:grid-cols-3 sm:divide-x">
        {items.map(item => (
          <li key={item.id} className="flex flex-col gap-1 px-4 py-3 break-keep">
            <span className="text-sm font-semibold text-fg">{item.purpose}</span>
            <span className="text-xs text-fg-muted tabular-nums">
              배정 {wonLabel(item.amount)} · 실제 지출 {wonLabel(item.actual)} · 지출 예정{' '}
              {wonLabel(item.committed ?? 0)}
            </span>
            <span
              className={cn(
                'text-sm font-bold tabular-nums',
                (item.available ?? 0) < 0 ? 'text-danger-emphasis' : 'text-primary-strong',
              )}
            >
              사용 가능 {signedWon(item.available ?? 0)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
