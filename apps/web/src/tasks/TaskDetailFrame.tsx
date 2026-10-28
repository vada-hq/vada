import type { ReactNode } from 'react'
import { SidePanel, SidePanelBody, SidePanelContent } from '@/components/ui/side-panel'
import { askLeave } from '@/lib/leave-guard'

type Props = {
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

// 업무 상세의 틀: 오른쪽 패널(DEC-94, 와이어프레임 OPS 패널, Linear·Jira·Asana·GitHub Projects).
// 768px 아래(태블릿 세로·휴대폰)는 높이 전체의 시트로 화면을 다 덮는다. 512px 패널이 남기는 띠가 좁아 뒤 목록을 보며 고칠 수 없다.
export function TaskDetailFrame({ title, heading, menu, busy, onClose, record, children }: Props) {
  const onOpenChange = (open: boolean) => {
    if (!open && !busy) askLeave(onClose)
  }
  return (
    <SidePanel open onOpenChange={onOpenChange}>
      <SidePanelContent
        title={title}
        heading={heading}
        actions={menu}
        record={record}
        className="sm:w-full sm:border-l-0 md:w-128 md:border-l"
        onEscapeKeyDown={keepWhileEditing}
      >
        <SidePanelBody>{children}</SidePanelBody>
      </SidePanelContent>
    </SidePanel>
  )
}
