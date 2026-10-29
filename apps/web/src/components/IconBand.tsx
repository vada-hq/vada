import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// 홈의 회색 띠 한 줄(①의 0건 띠 가족, c35 안 b 확정): 흰 원 아이콘 | 내용 | 오른쪽 글 단추.
// md는 ⑤ 이번 주의 일정 띠(높이 48, 반경 24), lg는 사용 가능 한 줄(높이 56, 쟁반 반경). 띠 전체를 누르게 하려면
// 내용 안 단추에 after:absolute after:inset-0을 주고, 오른쪽 단추에는 relative z-10을 준다.
const SIZE = {
  md: { box: 'min-h-12 rounded-3xl pl-2', dot: 'size-8', glyph: 'size-4' },
  lg: { box: 'h-14 rounded-tray pl-3', dot: 'size-9', glyph: 'size-4.5' },
} as const

export default function IconBand({
  icon: Icon,
  size = 'md',
  as: Tag = 'div',
  label,
  interactive = false,
  trailing,
  children,
}: {
  icon: LucideIcon
  size?: keyof typeof SIZE
  as?: 'div' | 'li' | 'section'
  // section일 때 이름(aria-label)
  label?: string
  // 띠 전체가 누르는 자리면 마우스를 올렸을 때 면을 띄운다
  interactive?: boolean
  trailing?: ReactNode
  children: ReactNode
}) {
  const look = SIZE[size]
  return (
    <Tag
      aria-label={label}
      className={cn(
        'relative flex items-center gap-3 bg-muted pr-1.5',
        look.box,
        interactive && 'hover:bg-surface-subtle',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-card text-fg-secondary',
          look.dot,
        )}
      >
        <Icon className={look.glyph} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">{children}</div>
      {trailing}
    </Tag>
  )
}
