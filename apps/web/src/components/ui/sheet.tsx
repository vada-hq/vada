import type { ComponentProps } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useReturnFocus, WindowHistory } from './dialog'

export const Sheet = DialogPrimitive.Root

const SIDE_CLASS = {
  left: 'inset-y-0 left-0 w-72 max-w-5/6 data-[state=open]:slide-in-from-left',
  right: 'inset-y-0 right-0 w-72 max-w-5/6 data-[state=open]:slide-in-from-right',
  adaptive:
    'inset-x-0 bottom-0 max-h-5/6 rounded-t-xl data-[state=open]:slide-in-from-bottom sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:max-h-none sm:w-96 sm:rounded-none sm:border-l sm:data-[state=open]:slide-in-from-right',
}

// 768px 미만의 사이드바(왼쪽)와 대화 링크의 상품 패널(오른쪽)이 쓴다. 제목은 화면에 보이지 않게 두고 설명은 생략한다.
// 폭은 shadcn 모바일 사이드바 기본값 18rem(288px)이다. Material Design처럼 뒤 화면이 보이도록 좁은 화면에서는 5/6까지만 쓴다.
// side 'adaptive'는 조직 화면의 창(구성원 초대)이 쓴다. 휴대폰(640px 미만)은 아래에서 올라오는 시트, 넓은 화면은 오른쪽 시트이고
// (M3 bottom sheet·side sheet), 제목이 보인다. 닫기 버튼은 어느 쪽이든 제목 줄 오른쪽이다.
export function SheetContent({
  className,
  children,
  title,
  side = 'left',
  closeLabel = '메뉴 닫기',
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & {
  title: string
  side?: 'left' | 'right' | 'adaptive'
  closeLabel?: string
}) {
  const returnFocus = useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus })
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className={cn(
          'fixed z-50 flex flex-col bg-white shadow-2xl outline-none data-[state=open]:animate-in',
          SIDE_CLASS[side],
          className,
        )}
        {...props}
        {...returnFocus}
      >
        <DialogPrimitive.Title
          className={
            side === 'adaptive'
              ? 'px-6 pt-5 pr-12 pb-1 text-base font-semibold text-gray-900'
              : 'sr-only'
          }
        >
          {title}
        </DialogPrimitive.Title>
        <WindowHistory />
        {children}
        <DialogPrimitive.Close
          aria-label={closeLabel}
          className={cn(
            'absolute top-5 right-3 cursor-pointer rounded-sm p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
            // 휴대폰에서 누르는 칸은 44px다.
            side === 'adaptive' &&
              'max-sm:top-2 max-sm:right-1 max-sm:flex max-sm:size-11 max-sm:items-center max-sm:justify-center',
          )}
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}
