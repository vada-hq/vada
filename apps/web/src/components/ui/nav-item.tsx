import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// 와이어프레임 사이드바 메뉴 항목: 반경 3.5px, 기본 gray-600, 활성 blue-50 배경과 blue-700 글자(굵기 500).
export function NavItem({ className, active = false, ...props }: ComponentProps<'button'> & { active?: boolean }) {
  return <button type="button" aria-current={active ? 'page' : undefined} className={cn(
    'w-full cursor-pointer rounded-sm px-3 py-2 text-left text-sm wrap-anywhere text-gray-600 transition-colors hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-45 aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-accent-foreground',
    className)} {...props} />
}
