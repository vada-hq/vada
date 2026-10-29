import type { ComponentProps } from 'react'
import { RadioGroup as RadioPrimitive } from 'radix-ui'
import { Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

// 이름 있는 단일 선택. Radix가 화살표 이동·초점·checked 상태를 맡는다.
export function RadioGroup({ className, ...props }: ComponentProps<typeof RadioPrimitive.Root>) {
  return <RadioPrimitive.Root className={cn('grid gap-2', className)} {...props} />
}
export function RadioGroupItem({
  className,
  ...props
}: ComponentProps<typeof RadioPrimitive.Item>) {
  return (
    <RadioPrimitive.Item
      className={cn(
        'size-5 shrink-0 rounded-full border border-border-control text-fg outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-45',
        className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator className="flex items-center justify-center">
        <Circle aria-hidden className="size-2.5 fill-current" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Item>
  )
}
