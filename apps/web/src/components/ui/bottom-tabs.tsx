import type { ComponentProps, ReactNode, Ref } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type BottomTab = {
  key: string
  label: string
  icon: LucideIcon
  active: boolean
  badge?: ReactNode
  onClick: () => void
  ref?: Ref<HTMLButtonElement> | undefined
}

// DEC-96: 아이콘 위·글 아래, 아이콘 오른쪽 위 수 배지. 바닥 안전 영역은 본문과 같은 유틸리티로 예약한다.
export function BottomTabs({
  items,
  className,
  ...props
}: ComponentProps<'nav'> & { items: BottomTab[] }) {
  return (
    <nav
      aria-label="휴대폰 메뉴"
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t bg-white bottom-navigation-space md:hidden',
        className,
      )}
      {...props}
    >
      <div className="absolute inset-x-0 top-0 flex h-14">
        {items.map(({ key, label, icon: Icon, active, badge, onClick, ref }) => (
          <button
            key={key}
            ref={ref}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={onClick}
            className="flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-1 text-xs break-keep text-gray-500 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none aria-[current=page]:font-semibold aria-[current=page]:text-blue-700"
          >
            <span className="relative">
              <Icon aria-hidden className="size-5" />
              {badge && <span className="absolute -top-1 left-full">{badge}</span>}
            </span>
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
