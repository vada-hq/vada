import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// 와이어프레임 상태 칩: 50 배경, 200 테두리, 700 글자, 반경 3.5px. 경고는 amber가 아니라 yellow다.
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        info: 'border-blue-200 bg-blue-50 text-blue-700',
        success: 'border-green-200 bg-green-50 text-green-700',
        warning: 'border-yellow-200 bg-yellow-50 text-yellow-700',
        danger: 'border-red-200 bg-red-50 text-red-700',
        neutral: 'border-transparent bg-gray-100 text-gray-500',
        // 안 읽은 수(와이어프레임 대화 목록·탭의 빨간 알약). 와이어프레임의 red-500은 흰 글자 대비가 4.5:1에 못 미쳐 red-600이다(WCAG 1.4.3).
        count: 'rounded-full border-transparent bg-red-600 font-bold text-white',
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
