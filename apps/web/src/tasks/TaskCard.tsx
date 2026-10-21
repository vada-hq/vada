import type { TaskStatus, TaskSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { assigneeLabel, dueLabel, NEXT_STEP, STATUS_LABEL } from './task-view'

const STATUS_TONE: Record<TaskStatus, 'neutral' | 'info' | 'success'> = {
  todo: 'neutral',
  in_progress: 'info',
  done: 'success',
}

type Props = {
  task: TaskSummary
  // 상태를 바꾸는 요청이 가는 중이다. 버튼을 막는다.
  busy: boolean
  // 상태 바꾸기가 실패한 이유. 카드 안에 보인다.
  error?: string | undefined
  onChangeStatus: (status: TaskStatus) => void
  // 카드를 눌러 상세를 여는 자리(조각 6). 없으면 제목은 글자일 뿐이다.
  onOpen?: (() => void) | undefined
}

function Title({ task, onOpen }: Pick<Props, 'task' | 'onOpen'>) {
  if (!onOpen)
    return (
      <h3 className="min-w-0 flex-1 text-sm font-semibold text-gray-900 wrap-anywhere">
        {task.title}
      </h3>
    )
  return (
    <h3 className="min-w-0 flex-1">
      <Button
        variant="link"
        className="h-auto max-w-full justify-start p-0 text-left text-sm font-semibold whitespace-normal text-gray-900 wrap-anywhere"
        onClick={onOpen}
      >
        {task.title}
      </Button>
    </h3>
  )
}

// 업무 카드: 제목, 마감과 지남, 상태, 담당자. 상태를 바꿀 수 있는 사람(task.status)에게만 [시작]·[끝내기]가 보인다.
export default function TaskCard({ task, busy, error, onChangeStatus, onOpen }: Props) {
  const next = task.actions.includes('task.status') ? NEXT_STEP[task.status] : null
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-start gap-2">
        <Title task={task} onOpen={onOpen} />
        <Badge tone={STATUS_TONE[task.status]}>{STATUS_LABEL[task.status]}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        <span>{dueLabel(task.dueDate)}</span>
        {task.overdue && <Badge tone="danger">지남</Badge>}
        <span className="wrap-anywhere">{assigneeLabel(task.assignee)}</span>
      </div>
      {next && (
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          disabled={busy}
          onClick={() => onChangeStatus(next.to)}
        >
          {next.label}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive wrap-anywhere">
          {error}
        </p>
      )}
    </Card>
  )
}
