import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// 와이어프레임 안내 배너: 반경 중간 값, 50 배경, 200 테두리, 700 글자, 10.5px. 알림 역할(role)은 StateMessage가 맡으므로 두지 않는다.
const alertVariants = cva('rounded-md border p-3 text-xs wrap-anywhere', {
  variants: {
    tone: {
      info: 'border-blue-200 bg-blue-50 text-blue-700',
      success: 'border-green-200 bg-green-50 text-green-700',
      warning: 'border-yellow-200 bg-yellow-50 text-yellow-700',
      danger: 'border-red-200 bg-red-50 text-red-700',
    },
  },
  defaultVariants: { tone: 'info' },
})

export function Alert({ className, tone, ...props }: ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" className={cn(alertVariants({ tone }), className)} {...props} />
}
