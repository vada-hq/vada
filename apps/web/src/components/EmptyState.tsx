import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type Props = {
  icon: LucideIcon
  title: string
  description?: string
  className?: string
  iconClassName?: string
  children?: ReactNode
}

// 와이어프레임 빈 화면: blue-50 원(49px) 안에 아이콘(21px), 굵은 제목, 회색 설명.
export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
  iconClassName,
  children,
}: Props) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-16 text-center', className)}>
      <span
        className={cn(
          'mb-5 flex size-14 items-center justify-center rounded-full bg-blue-50 text-blue-600',
          iconClassName,
        )}
      >
        <Icon aria-hidden className="size-6" />
      </span>
      <p className="text-sm font-bold text-gray-900">{title}</p>
      {description && <p className="mt-2 text-xs/6 text-gray-500">{description}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  )
}
