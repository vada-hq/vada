import { ChevronRight, Wallet } from 'lucide-react'
import IconBand from '@/components/IconBand'
import { Button } from '@/components/ui/button'
import { wonLabel } from '../finance/purchase-view'
import { cn } from '@/lib/utils'

// 사용 가능 한 줄(c35 안 b 확정): ① 0건 띠와 같은 회색 띠. 흰 원 지갑 + '사용 가능' + 금액 | '재정 보기 ›'(띠 전체가 재정으로 간다).
// 음수만 금액 글이 위험 색(①의 '3일 지남'처럼 글 색만)이다. 셈은 재정 첫 화면과 같다(DEC-92).
// 부장 홈은 같은 띠에 우리 부서가 맡은 예산을 싣는다('가을 축제 상금 600,000원 · 남음 600,000원' 꼴).
// 띠의 글 자리(약 200px)에 한 줄로 들지 않아 이름·금액을 윗줄, 남음을 굵게 아랫줄에 둔다(사용 가능의 금액 자리).
function AssignedBudget({
  label,
  amount,
  remaining,
}: {
  label: string
  amount: number
  remaining: number
}) {
  return (
    <p className="flex min-w-0 flex-col">
      <span className="text-row-sub break-keep text-fg-secondary tabular-nums">
        {`${label} ${wonLabel(amount)}`}
      </span>
      <span
        className={cn(
          'text-base leading-5.5 font-semibold tracking-tight tabular-nums',
          remaining < 0 ? 'text-danger' : 'text-fg',
        )}
      >
        {`남음 ${wonLabel(remaining)}`}
      </span>
    </p>
  )
}

export default function AvailableLine({
  label = '사용 가능',
  amount,
  remaining,
  onFinance,
}: {
  label?: string
  amount: number
  // 맡은 예산에서 남은 금액(부장 홈). 없으면 싣지 않는다.
  remaining?: number
  onFinance: () => void
}) {
  const negative = amount < 0
  return (
    <div className="@container min-w-0">
      <IconBand
        as="section"
        label={label}
        size="lg"
        icon={Wallet}
        interactive
        trailing={
          <Button
            variant="link"
            className="h-auto min-h-11 shrink-0 gap-0.5 rounded-full border-0 px-3 py-0 text-row-sub font-medium text-fg-secondary after:absolute after:inset-0 hover:text-fg hover:no-underline [&_svg]:size-4"
            onClick={onFinance}
          >
            재정 보기
            <ChevronRight aria-hidden />
          </Button>
        }
      >
        {remaining === undefined ? (
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <span className="text-row-sub text-fg-secondary">{label}</span>
            <span
              className={cn(
                'text-base leading-5.5 font-semibold tracking-tight tabular-nums',
                negative ? 'text-danger' : 'text-fg',
              )}
            >
              {wonLabel(amount)}
            </span>
          </p>
        ) : (
          <AssignedBudget label={label} amount={amount} remaining={remaining} />
        )}
      </IconBand>
    </div>
  )
}
