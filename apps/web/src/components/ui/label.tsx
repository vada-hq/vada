import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// 와이어프레임 폼 라벨: 10.5px, 굵기 500, gray-700.
export function Label({ className, ...props }: ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn('text-xs font-medium text-fg-secondary', className)}
      {...props}
    />
  )
}
