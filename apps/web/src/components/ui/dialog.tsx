import { useRef, type ComponentProps } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

type ContentProps = ComponentProps<typeof DialogPrimitive.Content>

// Radix는 Trigger로 연 대화상자만 닫을 때 포커스를 되돌린다. 상태로 여닫는 대화상자·옆 메뉴도 연 버튼으로 돌아가도록 연 순간의 포커스를 기억한다.
export function useReturnFocus({
  onOpenAutoFocus,
  onCloseAutoFocus,
}: Pick<ContentProps, 'onOpenAutoFocus' | 'onCloseAutoFocus'>) {
  const opener = useRef<HTMLElement | null>(null)
  return {
    onOpenAutoFocus: (event: Event) => {
      const active = document.activeElement
      opener.current = active instanceof HTMLElement && active !== document.body ? active : null
      onOpenAutoFocus?.(event)
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event)
      if (event.defaultPrevented || !opener.current?.isConnected) return
      event.preventDefault()
      opener.current.focus()
    },
  }
}

// 통일 규칙: 오버레이 검정 45%, 반경 큰 값, 큰 그림자, 안쪽 여백 21px, 폭 약 440px.
// 내용을 오버레이 안에 둔다(Radix 문서의 scrollable overlay). 좁거나 낮은 화면에서는 오버레이가 스크롤되어 내용이 잘리지 않는다.
export function DialogContent({
  className,
  children,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: ContentProps) {
  const returnFocus = useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus })
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/45 p-4 data-[state=open]:animate-in data-[state=open]:fade-in-0">
        <DialogPrimitive.Content
          data-slot="dialog-content"
          className={cn(
            'relative flex w-full max-w-lg flex-col gap-6 rounded-lg border bg-white p-6 shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            className,
          )}
          {...props}
          {...returnFocus}
        >
          {children}
          <DialogPrimitive.Close
            aria-label="닫기"
            className="absolute top-6 right-6 cursor-pointer rounded-sm p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Overlay>
    </DialogPrimitive.Portal>
  )
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 pr-6', className)} {...props} />
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('text-base font-semibold text-gray-900', className)}
      {...props}
    />
  )
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description className={cn('text-sm text-gray-500', className)} {...props} />
  )
}

// 버튼 줄은 오른쪽 정렬한다. 회색 footer 띠는 쓰지 않는다(통일 규칙).
export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-wrap justify-end gap-2', className)} {...props} />
}
