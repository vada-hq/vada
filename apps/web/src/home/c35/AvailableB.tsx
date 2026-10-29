import { ChevronRight, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { QUIET_DOT, TEXT_SUB } from '../c1r/f8/tokens'
import { wonText } from './c35-data'
import type { AvailableProps } from './AvailableA'
import { AVAIL_BAND, TEXT_ITEM } from './tokens'

// 사용 가능 안 b(①f8 가족): f8 0건 띠와 같은 회색 띠 한 줄. 흰 원 지갑 + '사용 가능' + 금액 | 오른쪽 '재정 보기 ›'.
// 음수만 금액 글이 빨강(①의 '3일 지남'처럼 글 색만), 양수는 짙은 글. 재정 담당이 없으면(null) 숨긴다.

export default function AvailableB({ amount, onFinance }: AvailableProps) {
  if (amount === null) return null
  const negative = amount < 0
  return (
    <section
      aria-label="사용 가능"
      className={cn('relative flex items-center hover:bg-surface-subtle', AVAIL_BAND)}
    >
      <span
        aria-hidden
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-card text-fg-secondary',
          QUIET_DOT,
        )}
      >
        <Wallet className="size-4.5" strokeWidth={2} />
      </span>
      <p className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
        <span className={cn('text-fg-secondary', TEXT_SUB)}>사용 가능</span>
        <span
          data-c35-danger={negative || undefined}
          className={cn('tabular-nums', TEXT_ITEM, negative ? 'text-danger' : 'text-fg')}
        >
          {wonText(amount)}
        </span>
      </p>
      <Button
        variant="link"
        className={cn(
          'h-auto min-h-11 shrink-0 gap-0.5 rounded-full border-0 px-3 py-0 font-medium text-fg-secondary after:absolute after:inset-0 hover:text-fg hover:no-underline [&_svg]:size-4',
          TEXT_SUB,
        )}
        onClick={onFinance}
      >
        재정 보기
        <ChevronRight aria-hidden />
      </Button>
    </section>
  )
}
