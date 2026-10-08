import type { ComponentProps } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useReturnFocus } from './dialog'

export const Sheet = DialogPrimitive.Root

// 768px 미만에서 사이드바를 왼쪽에서 여는 패널. 제목은 화면에 보이지 않게 두고 설명은 생략한다.
// 폭은 shadcn 모바일 사이드바 기본값 18rem(288px)이다. Material Design처럼 뒤 화면이 보이도록 좁은 화면에서는 5/6까지만 쓴다.
export function SheetContent({ className, children, title, onOpenAutoFocus, onCloseAutoFocus, ...props }: ComponentProps<typeof DialogPrimitive.Content> & { title: string }) {
  const returnFocus = useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus })
  return <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content aria-describedby={undefined} className={cn(
      'fixed inset-y-0 left-0 z-50 flex w-72 max-w-5/6 flex-col bg-white shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-left',
      className)} {...props} {...returnFocus}>
      <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
      {children}
      <DialogPrimitive.Close aria-label="메뉴 닫기" className="absolute top-5 right-3 cursor-pointer rounded-sm p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
        <X className="size-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
}
