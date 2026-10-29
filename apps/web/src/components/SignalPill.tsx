import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// 신호 알약(② 행사, e6 확정 시안): 아이콘 + 짧은 글. 글 자체가 누르는 자리이고 테두리 단추를 달지 않는다.
// 위험(지남·초과)만 빨간 면, 강조(정원 참)는 짙은 글, 나머지는 중립 회색 면이다. 줄 덮개 위(z-10)에 있다.
// 390에서는 누르는 자리만 44px로 키우고 바깥 여백으로 되돌린다.
const FACE = {
  neutral: 'bg-muted font-medium text-fg-secondary group-hover/sig:bg-border',
  strong: 'bg-muted font-semibold text-fg group-hover/sig:bg-border',
  danger: 'bg-danger-surface font-semibold text-danger',
} as const

export default function SignalPill({
  icon: Icon,
  tone,
  label = '',
  children,
  onClick,
}: {
  icon: LucideIcon
  tone: keyof typeof FACE
  // 화면 읽기 앞말
  label?: string
  children: string
  onClick: () => void
}) {
  return (
    <Button
      variant="ghost"
      className="group/sig relative z-10 h-auto rounded-full border-0 bg-transparent p-0 font-medium hover:bg-transparent max-sm:-my-2 max-sm:min-h-11 max-sm:min-w-11"
      onClick={onClick}
    >
      <span
        className={cn(
          'inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-sm whitespace-nowrap',
          FACE[tone],
        )}
      >
        <Icon aria-hidden className="size-3.5" strokeWidth={2.25} />
        {label && <span className="sr-only">{label}</span>}
        {children}
      </span>
    </Button>
  )
}
