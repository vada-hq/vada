import type { TaskSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { assigneeLabel, dueLabel } from '../tasks/task-view'
import { OverviewLink } from './OverviewLink'
import { nextTasks } from './overview-view'

// 개요에 보일 다음 업무 수. 나머지는 업무 탭에서 본다.
const SHOWN = 4

type Props = {
  // 끝나지 않은 업무. 아직 못 읽었으면 null이고 failed가 그 이유다.
  tasks: TaskSummary[] | null
  failed: boolean
  onOpenTask: (taskId: string) => void
  onOpenAll: () => void
}

function TaskLine({ task, onOpen }: { task: TaskSummary; onOpen: () => void }) {
  return (
    <li className="flex items-start gap-3 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <OverviewLink
          className="max-w-full justify-start text-left font-medium whitespace-normal text-gray-900 wrap-anywhere"
          onClick={onOpen}
        >
          {task.title}
        </OverviewLink>
        <span
          className={cn('text-xs', task.assignee === null ? 'text-yellow-700' : 'text-gray-500')}
        >
          {assigneeLabel(task.assignee)}
        </span>
      </div>
      {task.overdue ? (
        <Badge tone="danger">{`지남 · ${dueLabel(task.dueDate)}`}</Badge>
      ) : (
        <span className="shrink-0 text-xs text-gray-500">{dueLabel(task.dueDate)}</span>
      )}
    </li>
  )
}

// 다음 업무: 지난 것과 마감이 가까운 것 몇 개. 누르면 업무 탭에서 그 업무가 열린다(와이어프레임 Event Overview '주요 업무').
export function OverviewTasks({ tasks, failed, onOpenTask, onOpenAll }: Props) {
  const empty = tasks === null ? (failed ? '읽지 못했어요' : '불러오는 중이에요') : null
  return (
    <section aria-labelledby="overview-tasks" className={cn(cardClass, 'flex flex-col px-4 py-3')}>
      <div className="flex items-center justify-between gap-2 pb-1">
        <h3 id="overview-tasks" className="text-sm font-semibold text-gray-900">
          다음 업무
        </h3>
        <OverviewLink onClick={onOpenAll}>업무 보기</OverviewLink>
      </div>
      {tasks === null || tasks.length === 0 ? (
        <p className="py-2.5 text-sm text-gray-500">{empty ?? '끝나지 않은 업무가 없어요'}</p>
      ) : (
        <ul className="divide-y">
          {nextTasks(tasks, SHOWN).map(task => (
            <TaskLine key={task.id} task={task} onOpen={() => onOpenTask(task.id)} />
          ))}
        </ul>
      )}
    </section>
  )
}
