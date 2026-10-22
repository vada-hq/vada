import type { CouncilView } from '@vada/contracts'
import type { TaskDialogHandlers } from './task-requests'
import { TaskCreateDialog } from './TaskCreateDialog'
import { TaskDetailDialog } from './TaskDetailDialog'

type Props = TaskDialogHandlers & {
  view: CouncilView
  openId: string | null
  creating: boolean
  // 행사의 업무 탭에서 열었으면 만들 업무가 이어질 행사
  eventId?: string | undefined
  onCloseDetail: () => void
  onCloseCreate: () => void
}

// 업무 화면이 여는 대화상자 둘. 열고 닫는 상태는 화면이 가진다.
export function TaskDialogs({
  view,
  openId,
  creating,
  eventId,
  onCloseDetail,
  onCloseCreate,
  ...rest
}: Props) {
  return (
    <>
      <TaskDetailDialog view={view} taskId={openId} onClose={onCloseDetail} {...rest} />
      <TaskCreateDialog
        view={view}
        open={creating}
        eventId={eventId}
        onClose={onCloseCreate}
        onCreated={() => {
          rest.onChanged()
          onCloseCreate()
        }}
        onLost={rest.onLost}
        onForbidden={rest.onForbidden}
      />
    </>
  )
}
