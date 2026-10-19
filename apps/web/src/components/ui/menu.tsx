import type { ComponentProps } from 'react'
import { DropdownMenu as MenuPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

// 버튼 아래에 뜨는 짧은 동작 목록(학생회 이름 메뉴, 줄마다 ⋯ 메뉴). 키보드로도 고른다(Radix DropdownMenu).
export const Menu = MenuPrimitive.Root
export const MenuTrigger = MenuPrimitive.Trigger

// 카드와 같은 테두리·그림자, 반경 중간 값. 폭은 내용에 맞추되 너무 좁지 않게 둔다.
export function MenuContent({
  className,
  sideOffset = 4,
  align = 'end',
  ...props
}: ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'z-50 max-w-72 min-w-44 rounded-md border bg-white p-1 shadow-lg outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0',
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  )
}

// 메뉴 항목: 옆 메뉴 항목(NavItem)과 같은 글자 크기와 여백이다. 되돌리기 어려운 동작(내보내기)은 destructive로 빨갛게 둔다.
export function MenuItem({
  className,
  destructive = false,
  ...props
}: ComponentProps<typeof MenuPrimitive.Item> & { destructive?: boolean }) {
  return (
    <MenuPrimitive.Item
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm wrap-anywhere text-gray-700 outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[highlighted]:bg-gray-100 [&_svg]:size-4 [&_svg]:shrink-0',
        destructive && 'text-destructive',
        className,
      )}
      {...props}
    />
  )
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof MenuPrimitive.Label>) {
  return (
    <MenuPrimitive.Label
      className={cn('px-3 py-1.5 text-xs text-gray-400', className)}
      {...props}
    />
  )
}

export function MenuSeparator({
  className,
  ...props
}: ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn('my-1 h-px bg-gray-100', className)} {...props} />
}
