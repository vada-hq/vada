import { User } from 'lucide-react'
import { cn } from '@/lib/utils'

// 와이어프레임 아바타: gray-200 원(24.5px)에 사람 아이콘(14px). 옆 메뉴의 내 계정, 대화의 탈퇴한 사람에 쓴다.
// 대화 말풍선 옆 얼굴은 와이어프레임대로 이름 첫 글자 원이다(chat/MessageItem.tsx). 사진은 와이어프레임에 없다.
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
