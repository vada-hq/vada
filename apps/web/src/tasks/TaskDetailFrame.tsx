import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SidePanel, SidePanelBody, SidePanelContent } from '@/components/ui/side-panel'

// 업무 상세를 여는 틀 두 안. panel: 오른쪽 패널(DEC-94, 와이어프레임 OPS 패널, Linear·Jira·Asana·GitHub Projects).
// dialog: 가운데 창(지금 모양). 몸통은 같고 틀만 다르다. 사람이 스크린샷으로 견줘 고른다.
export type TaskFrame = 'panel' | 'dialog'

type Props = {
  frame: TaskFrame
  // 창의 이름(화면 읽기). 보이는 제목은 heading이 그린다.
  title: string
  heading: ReactNode
  // 머리 오른쪽의 ⋯ 메뉴
  menu?: ReactNode
  // 보내는 중에는 닫지 않는다.
  busy: boolean
  onClose: () => void
  record?: { kind: 'tasks'; id: string } | undefined
  children: ReactNode
}

// 제자리 편집 칸 안의 Esc는 고치기를 거두는 것이라 창을 닫지 않는다(TaskInlineText).
const keepWhileEditing = (event: KeyboardEvent) => {
  if (event.target instanceof Element && event.target.closest('[data-inline-edit]'))
    event.preventDefault()
}

export function TaskDetailFrame({
  frame,
  title,
  heading,
  menu,
  busy,
  onClose,
  record,
  children,
}: Props) {
  const onOpenChange = (open: boolean) => {
    if (!open && !busy) onClose()
  }
  if (frame === 'dialog')
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent
          aria-describedby={undefined}
          record={record}
          className="max-w-2xl"
          onEscapeKeyDown={keepWhileEditing}
        >
          <DialogHeader className="flex-row items-start gap-2 pr-8">
            <DialogTitle className="sr-only">{title}</DialogTitle>
            <div className="min-w-0 flex-1">{heading}</div>
            {menu}
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    )
  return (
    <SidePanel open onOpenChange={onOpenChange}>
      <SidePanelContent
        title={title}
        heading={heading}
        actions={menu}
        record={record}
        onEscapeKeyDown={keepWhileEditing}
      >
        <SidePanelBody>{children}</SidePanelBody>
      </SidePanelContent>
    </SidePanel>
  )
}
