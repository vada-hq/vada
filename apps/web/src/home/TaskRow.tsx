import type { TaskSummary } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { assigneeLabel, COUNCIL_TASK_LABEL, dueLabel } from '../tasks/task-view'

type Props = {
  task: TaskSummary
  onOpen: (taskId: string) => void
  // 남의 업무를 볼 때는 누구에게 물을지 담당자 이름을 같이 보인다.
  showAssignee?: boolean
  // 학생회 전체 목록은 어느 부서 일인지도 보인다.
  showDepartment?: boolean
}

// 홈의 업무 줄: 제목, 마감, 행사 이름(, 담당자). 누르면 업무 화면에서 그 업무의 상세가 열린다.
export default function TaskRow({
  task,
  onOpen,
  showAssignee = false,
  showDepartment = false,
}: Props) {
  return (
    <li>
      <Button
        variant="ghost"
        className="h-auto w-full flex-col items-start gap-0.5 px-2 py-2 text-left whitespace-normal"
        onClick={() => onOpen(task.id)}
      >
        <span className="text-sm font-medium text-gray-900 wrap-anywhere">{task.title}</span>
        <span className="flex flex-wrap gap-x-2 text-xs font-normal text-gray-500">
          <span>{dueLabel(task.dueDate)}</span>
          {showDepartment && (
            <span className="wrap-anywhere">{task.department?.name ?? COUNCIL_TASK_LABEL}</span>
          )}
          {showAssignee && <span className="wrap-anywhere">{assigneeLabel(task.assignee)}</span>}
          {task.event && <span className="wrap-anywhere">{task.event.name}</span>}
        </span>
      </Button>
    </li>
  )
}
