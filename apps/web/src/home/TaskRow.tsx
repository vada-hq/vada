import type { TaskSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { assigneeLabel, COUNCIL_TASK_LABEL, dueLabel } from '../tasks/task-view'
import { daysBetween } from './home-view'
import HomeRow from './HomeRow'

type Props = {
  task: TaskSummary
  today: string
  onOpen: (taskId: string) => void
  // 남의 업무를 볼 때는 누구에게 물을지 담당자 이름을 같이 보인다.
  showAssignee?: boolean
  // 학생회 전체 목록은 어느 부서 일인지도 보인다.
  showDepartment?: boolean
}

// 마감 자리: 지난 것은 빨간 배지로 며칠 지났는지, 오늘은 파란 배지, 나머지는 날짜 글자.
function Due({ task, today }: Pick<Props, 'task' | 'today'>) {
  if (task.overdue && task.dueDate)
    return <Badge tone="danger">{daysBetween(task.dueDate, today)}일 지남</Badge>
  if (task.dueDate === today) return <Badge tone="info">오늘</Badge>
  return <span className="text-gray-500">{dueLabel(task.dueDate)}</span>
}

// 홈의 업무 줄: 제목, (부서·)행사(·담당자), 오른쪽에 마감. 업무 화면의 줄과 같은 자리에 같은 색을 쓴다.
export default function TaskRow({
  task,
  today,
  onOpen,
  showAssignee = false,
  showDepartment = false,
}: Props) {
  return (
    <HomeRow
      title={task.title}
      meta={[
        showDepartment && (task.department?.name ?? COUNCIL_TASK_LABEL),
        task.event?.name,
        showAssignee && (
          <span key="assignee" className={cn(task.assignee === null && 'text-yellow-700')}>
            {assigneeLabel(task.assignee)}
          </span>
        ),
      ]}
      side={<Due task={task} today={today} />}
      onOpen={() => onOpen(task.id)}
    />
  )
}
