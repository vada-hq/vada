import { ChevronRight, Wallet } from 'lucide-react'
import IconBand from '@/components/IconBand'
import { Button } from '@/components/ui/button'
import { wonLabel } from '../finance/purchase-view'
import { cn } from '@/lib/utils'

// 사용 가능 한 줄(c35 안 b 확정): ① 0건 띠와 같은 회색 띠. 흰 원 지갑 + '사용 가능' + 금액 | '재정 보기 ›'(띠 전체가 재정으로 간다).
// 음수만 금액 글이 위험 색(①의 '3일 지남'처럼 글 색만)이다. 셈은 재정 첫 화면과 같다(DEC-92).
export default function AvailableLine({
  amount,
  onFinance,
}: {
  amount: number
  onFinance: () => void
}) {
  const negative = amount < 0
  return (
    <div className="@container min-w-0">
      <IconBand
        as="section"
        label="사용 가능"
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
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="text-row-sub text-fg-secondary">사용 가능</span>
          <span
            className={cn(
              'text-base leading-5.5 font-semibold tracking-tight tabular-nums',
              negative ? 'text-danger' : 'text-fg',
            )}
          >
            {wonLabel(amount)}
          </span>
        </p>
      </IconBand>
    </div>
  )
}
