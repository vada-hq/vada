import type { CouncilView } from '@vada/contracts'
import type { TaskDialogHandlers } from './task-requests'
import { TaskDetailDialog } from './TaskDetailDialog'

type Props = TaskDialogHandlers & {
  view: CouncilView
  openId: string | null
  // 상세에서 행사 이름을 눌렀다. 행사의 업무 탭에서는 주지 않는다.
  onOpenEvent?: ((eventId: string) => void) | undefined
  onCloseDetail: () => void
}

// 업무 화면이 여는 업무 상세 대화상자. 열고 닫는 상태는 화면이 가진다.
export function TaskDialogs({ view, openId, onOpenEvent, onCloseDetail, ...rest }: Props) {
  return (
    <>
      <TaskDetailDialog
        view={view}
        taskId={openId}
        onClose={onCloseDetail}
        onOpenEvent={onOpenEvent}
        {...rest}
      />
    </>
  )
}
