import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { baseFieldClass } from './input'

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        baseFieldClass,
        'min-h-20 resize-y read-only:border-border read-only:bg-surface-subtle',
        className,
      )}
      {...props}
    />
  )
}
