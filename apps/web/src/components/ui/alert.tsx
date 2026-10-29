import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// 와이어프레임 안내 배너: 반경 중간 값, 50 배경, 200 테두리, 700 글자, 10.5px. 알림 역할(role)은 StateMessage가 맡으므로 두지 않는다.
const alertVariants = cva('rounded-md border p-3 text-xs wrap-anywhere', {
  variants: {
    tone: {
      info: 'border-primary-border bg-primary-surface text-primary-strong',
      success: 'border-success-border bg-success-surface text-success',
      warning: 'border-warning-border bg-warning-surface text-warning',
      danger: 'border-danger-border bg-danger-surface text-danger',
    },
  },
  defaultVariants: { tone: 'info' },
})

export function Alert({
  className,
  tone,
  ...props
}: ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" className={cn(alertVariants({ tone }), className)} {...props} />
}
