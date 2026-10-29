import type { ComponentProps, ReactNode } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { X } from 'lucide-react'
import type { RecordKind } from '@vada/contracts'
import { cn } from '@/lib/utils'
import { useReturnFocus, WindowHistory } from './dialog'

export const SidePanel = DialogPrimitive.Root

type ContentProps = Omit<ComponentProps<typeof DialogPrimitive.Content>, 'title'> & {
  title: string
  // 제목 아래 한 줄(끼룩이 한 줄 등). 창의 설명으로 읽힌다.
  description?: ReactNode
  // 보이는 제목 자리를 대신하는 내용(그 자리에서 고치는 업무 제목). 주면 title은 화면 읽기용 이름으로만 남는다.
  heading?: ReactNode
  // 닫기 앞의 단추(⋯ 메뉴 등)
  actions?: ReactNode
  // 주소로 열리는 기록 상세 패널이 자기 기록을 말한다(DialogContent의 record와 같다).
  record?: { kind: RecordKind; id: string } | undefined
}

// 오른쪽에 붙는 고치기 패널(와이어프레임 EVT-02B). 뒤 화면을 보며 고치도록 높이 전체에 폭 약 500px(와이어프레임 440px의 1/0.875)이고,
// 휴대폰(640px 미만)은 전체 화면이다(Material Design full-screen dialog). 머리와 버튼 줄은 붙어 있고 가운데만 스크롤된다.
// 화면 높이 전체를 덮고 뒤를 가리는 것은 M3 modal side sheet와 shadcn Sheet의 관례이고, 가림막 값(검정 45%)은 앱 대화상자와 같다.
// 머리(제목, 설명, 닫기) 아래에 SidePanelBody와 SidePanelFooter를 둔다. 폼이면 폼이 둘을 감싸고 `flex min-h-0 flex-1 flex-col`을 준다.
// 뒤로 가기와 Esc는 다른 창처럼 닫기 버튼과 같은 길로 닫는다(DEC-78). 보내는 중 닫지 않으려면 부모의 onOpenChange가 거절한다.
export function SidePanelContent({
  className,
  children,
  title,
  description,
  heading,
  actions,
  record,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: ContentProps) {
  const returnFocus = useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus })
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <DialogPrimitive.Content
        {...(description === undefined && { 'aria-describedby': undefined })}
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full max-w-full flex-col bg-white shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right sm:w-128 sm:border-l',
          className,
        )}
        {...props}
        {...returnFocus}
      >
        <WindowHistory record={record} />
        <div className="flex items-start gap-3 border-b px-6 py-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DialogPrimitive.Title
              className={cn(
                'text-base font-semibold text-fg wrap-anywhere',
                heading !== undefined && 'sr-only',
              )}
            >
              {title}
            </DialogPrimitive.Title>
            {heading}
            {description !== undefined && (
              <DialogPrimitive.Description asChild>
                <div>{description}</div>
              </DialogPrimitive.Description>
            )}
          </div>
          {actions}
          <DialogPrimitive.Close
            aria-label="닫기"
            className="cursor-pointer rounded-sm p-1 text-fg-subtle hover:bg-surface-muted hover:text-fg-tertiary focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none max-sm:-m-2.5 max-sm:flex max-sm:size-11 max-sm:shrink-0 max-sm:items-center max-sm:justify-center"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

// 스크롤되는 가운데. 구역(SidePanelSection)을 쌓는다.
export function SidePanelBody({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5', className)}
      {...props}
    />
  )
}

// 아래에 붙은 버튼 줄. 오른쪽 정렬이다(대화상자 버튼 줄과 같다).
export function SidePanelFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-wrap justify-end gap-2 border-t px-6 py-4', className)}
      {...props}
    />
  )
}

// 패널 안의 구역 하나. 제목 줄 오른쪽에 그 구역 값이 어디에 반영되는지 한 줄(hint)을 둔다(와이어프레임 EVT-02B '자동 반영 힌트').
// 첫 구역 말고는 위에 가는 선을 둔다.
export function SidePanelSection({
  title,
  hint,
  children,
}: {
  title: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      aria-label={title}
      className="flex flex-col gap-3 border-t pt-5 first:border-t-0 first:pt-0"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {hint !== undefined && <div className="text-xs text-primary-emphasis">{hint}</div>}
      </div>
      {children}
    </section>
  )
}
