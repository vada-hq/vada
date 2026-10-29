import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// 와이어프레임 상태 칩: 50 배경, 200 테두리, 700 글자, 반경 3.5px. 경고는 amber가 아니라 yellow다.
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        info: 'border-primary-border bg-primary-surface text-primary-strong',
        success: 'border-success-border bg-success-surface text-success',
        warning: 'border-warning-border bg-warning-surface text-warning',
        danger: 'border-danger-border bg-danger-surface text-danger',
        neutral: 'border-transparent bg-surface-muted text-fg-muted',
        // 안 읽은 수(와이어프레임 대화 목록·탭의 빨간 알약). 와이어프레임의 red-500은 흰 글자 대비가 4.5:1에 못 미쳐 red-600이다(WCAG 1.4.3).
        count: 'rounded-full border-transparent bg-notify font-bold text-white',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />
}
