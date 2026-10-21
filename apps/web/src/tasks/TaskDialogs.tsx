import type { CouncilView } from '@vada/contracts'
import type { TaskDialogHandlers } from './task-requests'
import { TaskCreateDialog } from './TaskCreateDialog'
import { TaskDetailDialog } from './TaskDetailDialog'

type Props = TaskDialogHandlers & {
  view: CouncilView
  openId: string | null
  creating: boolean
  onCloseDetail: () => void
  onCloseCreate: () => void
}

// 업무 화면이 여는 대화상자 둘. 열고 닫는 상태는 화면이 가진다.
export function TaskDialogs({
  view,
  openId,
  creating,
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
