import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// 와이어프레임 사이드바 v6.2 메뉴 칸: 아이콘과 글 사이 gap-3, rounded, 칸 아래 mb-0.5, 기본 gray-600, 올리면 gray-50,
// 켜짐 blue-50 바탕과 blue-700 글(굵기 500). 와이어프레임의 클릭만 받는 div와 달리 이름 있는 단추이고 초점 고리와 aria-current가 있다(DEC-96).
export function NavItem({
  className,
  active = false,
  ...props
}: ComponentProps<'button'> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      className={cn(
        'mb-0.5 flex w-full cursor-pointer items-center gap-3 rounded px-3 py-2 text-left text-sm wrap-anywhere text-gray-600 transition-colors hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-45 aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-accent-foreground',
        className,
      )}
      {...props}
    />
  )
}
