import type { ComponentProps } from 'react'
import type { CouncilView, TaskPerson } from '@vada/contracts'
import PersonName from '@/chat/PersonName'
import { openMessageRoom } from '@/lib/go-to'
import { assigneeLabel } from './task-view'

export type TaskDirect = Pick<ComponentProps<typeof PersonName>, 'councilId' | 'meId' | 'canDirect'>

export const taskDirectOf = (view: CouncilView): TaskDirect => ({
  councilId: view.council.id,
  meId: view.me.memberId,
  canDirect: view.permissions.includes('chat.direct'),
})

type Props = {
  assignee: TaskPerson | null
  direct?: TaskDirect | undefined
  overRecord?: boolean
  tabIndex?: number
}

// 떠난 담당자는 이름에 접두가 없으므로 업무 응답의 current로 가른다.
// 카드의 늘인 제목 링크 위에서 이름만 누르고, 표에서는 칸의 Tab 순서를 따른다.
export function TaskAssigneeName({ assignee, direct, overRecord, tabIndex }: Props) {
  if (!assignee?.current || !direct) return assigneeLabel(assignee)
  const open = overRecord
    ? {
        onOpen: (roomId: string) =>
          openMessageRoom(direct.councilId, roomId, null, { overRecord: true }),
      }
    : {}
  return (
    <span
      className="min-w-0 has-[button]:relative has-[button]:z-10"
      onClick={event => event.stopPropagation()}
      onDragStart={event => {
        event.preventDefault()
        event.stopPropagation()
      }}
      ref={element => {
        // PersonName은 Tab 인자를 받지 않는다. 표의 안쪽 단추도 roving tabindex에서 뺀다.
        if (tabIndex !== undefined)
          element?.querySelectorAll('button').forEach(button => {
            button.tabIndex = tabIndex
          })
      }}
    >
      <PersonName {...direct} memberId={assignee.id} name={assignee.name} {...open} />
    </span>
  )
}
