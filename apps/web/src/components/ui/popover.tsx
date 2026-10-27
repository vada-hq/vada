import type { ComponentProps } from 'react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

// 값을 누르면 그 자리 아래에 뜨는 고르기 창(업무 상세의 담당자·마감·부서·행사). 고르면 바로 반영하고 닫는다.
// 바깥을 누르거나 Esc면 닫히고 초점은 연 버튼으로 돌아간다(Radix Popover). 겉모양은 동작 메뉴(MenuContent)와 같다.
export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger

export function PopoverContent({
  className,
  sideOffset = 4,
  align = 'start',
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={8}
        className={cn(
          'z-50 w-72 rounded-md border bg-white p-1 shadow-lg outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}
