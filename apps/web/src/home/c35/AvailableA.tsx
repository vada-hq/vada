import { ChevronRight, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { TEXT_SUB } from '../c1r/f8/tokens'
import { wonText } from './c35-data'
import { AMOUNT_ICON, AMOUNT_PILL, AVAIL_LINE, TEXT_SMALL } from './tokens'

// 사용 가능 안 a(②e3 가족): 바탕 없는 한 줄. 금액은 e3 예산 신호 알약 꼴(지갑 아이콘 + 금액).
// 음수만 빨간 면 + 빨간 굵은 글(e3의 '예산 초과'와 같은 꼴), 양수는 회색 면.
// 줄 전체가 '재정 보기'(이름 단추의 덮개). 재정 담당이 없으면(null) 숨긴다.

export type AvailableProps = { amount: number | null; onFinance: () => void }

export default function AvailableA({ amount, onFinance }: AvailableProps) {
  if (amount === null) return null
  const negative = amount < 0
  return (
    <section aria-label="사용 가능" className={cn('relative flex items-center', AVAIL_LINE)}>
      <span className={cn('text-fg-secondary', TEXT_SUB)}>사용 가능</span>
      <span
        data-c35-danger={negative || undefined}
        className={cn(
          'inline-flex items-center font-semibold tabular-nums',
          AMOUNT_PILL,
          TEXT_SMALL,
          negative ? 'bg-danger-surface text-danger' : 'bg-muted text-fg',
        )}
      >
        <Wallet aria-hidden className={AMOUNT_ICON} strokeWidth={2.25} />
        {wonText(amount)}
      </span>
      <span aria-hidden className="text-fg-muted">
        ·
      </span>
      <Button
        variant="link"
        className={cn(
          'h-auto gap-0.5 border-0 p-0 font-medium text-fg-secondary after:absolute after:inset-0 hover:text-fg hover:no-underline [&_svg]:size-4',
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
