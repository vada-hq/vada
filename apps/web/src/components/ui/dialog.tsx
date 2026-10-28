import { createContext, useContext, useRef, type ComponentProps } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RecordKind } from '@vada/contracts'
import { adoptTag, useWindowHistory } from '@/lib/use-window-history'
import { useHideBottomNavigation } from '@/components/BottomNavigationVisibility'
import { useKeyboardInset } from '@/lib/use-keyboard-inset'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

type ContentProps = ComponentProps<typeof DialogPrimitive.Content> & {
  closeDisabled?: boolean
  // 주소로 열리는 기록 상세 창이 자기 기록을 말한다. 주소 칸이 이 기록의 것일 때만 그 칸을 이어받는다.
  record?: { kind: RecordKind; id: string } | undefined
}

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

// 뒤로 가기가 이 창을 닫게 한다. 닫는 길은 화면의 닫기 버튼과 같아서(눈에 보이지 않는 Close를 누른다), 부모가 보내는 중에 닫기를 거절하는 창도 그대로 따른다.
export function WindowHistory({
  record,
}: {
  record?: { kind: RecordKind; id: string } | undefined
}) {
  const close = useRef<HTMLButtonElement>(null)
  useHideBottomNavigation()
  useWindowHistory(() => close.current?.click(), record && adoptTag(record.kind, record.id))
  return <DialogPrimitive.Close ref={close} hidden tabIndex={-1} aria-hidden="true" />
}

// 버튼 줄이 창 안에 있는지. 구매 요청 내기 화면처럼 창 밖 페이지도 DialogFooter를 쓰므로 바닥 고정은 창 안에서만 건다.
const InDialog = createContext(false)

// 640px 아래에서는 가운데 작은 창 대신 아래에 붙은 전체 폭 시트로 연다(M3 bottom sheet·full-screen dialog for compact, Apple HIG Sheets).
// 짧은 확인 창은 내용만큼 낮은 시트, 긴 폼은 화면 높이까지 차고 창 안이 스크롤된다. 넓은 화면은 바꾸지 않는다.
// 아래 끝과 최대 높이는 키보드가 가리지 않는 영역을 따른다(use-keyboard-inset). 키보드가 없으면 화면 바닥과 100dvh다.
// scroll-pb-28은 초점이 바닥 고정 버튼 줄(두 줄로 접힌 예산 합계 줄 약 101px 포함) 밑의 칸으로 갈 때 그만큼 더 올려 보이게 한다.
const SHEET_BELOW_SM =
  'max-sm:fixed max-sm:inset-x-0 max-sm:bottom-(--keyboard-inset) max-sm:max-h-(--visual-viewport-height) max-sm:max-w-none max-sm:overflow-y-auto max-sm:scroll-pb-28 max-sm:rounded-b-none max-sm:rounded-t-xl max-sm:border-x-0 max-sm:border-b-0 max-sm:data-[state=open]:slide-in-from-bottom'

// 통일 규칙: 오버레이 검정 45%, 반경 큰 값, 큰 그림자, 안쪽 여백 21px, 폭 약 440px.
// 내용을 오버레이 안에 둔다(Radix 문서의 scrollable overlay). 좁거나 낮은 화면에서는 오버레이가 스크롤되어 내용이 잘리지 않는다.
export function DialogContent({
  closeDisabled,
  className,
  children,
  onOpenAutoFocus,
  onCloseAutoFocus,
  record,
  ...props
}: ContentProps) {
  const returnFocus = useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus })
  useKeyboardInset()
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/45 p-4 data-[state=open]:animate-in data-[state=open]:fade-in-0">
        <DialogPrimitive.Content
          data-slot="dialog-content"
          className={cn(
            'relative flex w-full max-w-lg flex-col gap-6 rounded-lg border bg-white p-6 shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            SHEET_BELOW_SM,
            className,
          )}
          {...props}
          {...returnFocus}
        >
          <WindowHistory record={record} />
          <InDialog.Provider value>{children}</InDialog.Provider>
          {/* 휴대폰에서는 누르는 자리만 44px로 넓힌다(아이콘 자리는 같다). QR 스캐너처럼 닫는 길이 이것 하나인 창이 있다. */}
          <DialogPrimitive.Close
            aria-label="닫기"
            disabled={closeDisabled}
            className="absolute top-6 right-6 cursor-pointer rounded-sm p-1 max-sm:top-3.5 max-sm:right-3.5 max-sm:p-3.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
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
// 휴대폰 시트에서는 긴 폼을 스크롤해도 제출 단추가 보이도록 시트 바닥에 붙인다. 창의 아래 여백(p-6)을 이 줄이 대신 채우므로 창 안 맨 끝에 둔다. 붙는 기준선이 스크롤 상자의 안쪽 여백만큼 올라가 있어 -bottom-6으로 내린다.
const STICKY_BELOW_SM =
  'max-sm:sticky max-sm:-bottom-6 max-sm:-mx-6 max-sm:-mb-6 max-sm:border-t max-sm:bg-white max-sm:px-6 max-sm:pt-3 max-sm:safe-bottom-3'

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-wrap justify-end gap-2',
        useContext(InDialog) && STICKY_BELOW_SM,
        className,
      )}
      {...props}
    />
  )
}
