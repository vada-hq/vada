import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// 물어봄 말풍선 알약: '10월 28일 물어봄 · 답 있음'. 답 있음(새로 볼 것)은 파란 면 + 점 + 굵게, 답 없음은 회색 면.
// 글은 부르는 쪽이 만든다.
export default function AskedPill({
  asked,
  answer,
  answered,
}: {
  asked: string
  answer: string
  answered: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm whitespace-nowrap',
        answered ? 'bg-primary-surface text-primary-strong' : 'bg-muted text-fg-secondary',
      )}
    >
      {answered && <span aria-hidden className="size-2 rounded-full bg-primary" />}
      <span className={answered ? 'text-fg-secondary' : undefined}>{asked}</span>
      <span aria-hidden className={answered ? 'text-fg-secondary' : undefined}>
        ·
      </span>
      <span className={answered ? 'font-semibold' : 'font-normal'}>{answer}</span>
      <ChevronRight aria-hidden className="-mr-1 size-4" />
    </span>
  )
}
