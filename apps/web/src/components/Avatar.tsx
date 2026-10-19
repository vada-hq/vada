import { User } from 'lucide-react'
import { cn } from '@/lib/utils'

// 와이어프레임 아바타: gray-200 원(24.5px)에 사람 아이콘(14px). 사진과 이니셜은 와이어프레임에 없다.
export function Avatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500',
        className,
      )}
    >
      <User className="size-4" />
    </span>
  )
}
