import type { ComponentProps } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useReturnFocus } from './dialog'

export const Sheet = DialogPrimitive.Root

// 768px 미만에서 사이드바를 왼쪽에서 여는 패널. 제목은 화면에 보이지 않게 두고 설명은 생략한다.
// iOS 26 Safari는 화면 위·아래 가장자리에 닿은 fixed 요소의 배경색으로 상태 표시줄과 주소창 줄을 칠한다(아래는 화면 폭의 약 80% 이상인 요소만).
// 오버레이 자신에는 배경을 두지 않고 어둡게 하는 층을 absolute 자식으로 두어, 넓은 흰 패널 색이 뽑히게 한다. 그래야 메뉴가 위아래 끝까지 이어져 보인다.
export function SheetContent({ className, children, title, onOpenAutoFocus, onCloseAutoFocus, ...props }: ComponentProps<typeof DialogPrimitive.Content> & { title: string }) {
  const returnFocus = useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus })
  return <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 data-[state=open]:animate-in data-[state=open]:fade-in-0">
      <div aria-hidden className="absolute inset-0 bg-black/45" />
    </DialogPrimitive.Overlay>
    <DialogPrimitive.Content aria-describedby={undefined} className={cn(
      'fixed inset-y-0 left-0 z-50 flex w-5/6 max-w-sm flex-col bg-white shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-left',
      className)} {...props} {...returnFocus}>
      <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
      {children}
      <DialogPrimitive.Close aria-label="메뉴 닫기" className="absolute top-5 right-3 cursor-pointer rounded-sm p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
        <X className="size-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
}
