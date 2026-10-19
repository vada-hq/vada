import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { fieldClass } from './input'

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        fieldClass,
        'min-h-20 resize-y read-only:border-border read-only:bg-gray-50',
        className,
      )}
      {...props}
    />
  )
}
