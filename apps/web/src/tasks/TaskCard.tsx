import type { TaskSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { dueText, isOverdue, nextStatus, statusLabels } from './task-view'

type Props = {
  task: TaskSummary
  today: string
  // 내 업무에서는 행사 이름과 상태를 같이 보인다.
  showEvent?: boolean
  manageEvents: boolean
  busy: boolean
  onOpen: () => void
  onAdvance: () => void
}

// 업무 카드. 제목을 누르면 상세를 열고, 부서가 있는 구성원은 [시작]·[완료]로 다음 상태로 넘긴다(끌어 옮기기 대신).
export default function TaskCard({ task, today, showEvent = false, manageEvents, busy, onOpen, onAdvance }: Props) {
  const overdue = isOverdue(task, today)
  const next = nextStatus[task.status]
  return <article className={cn(cardClass, 'flex flex-col gap-2 p-3', overdue && 'border-red-200')}>
    <h3 className="text-sm">
      <Button variant="link" className="h-auto justify-start p-0 text-left text-sm font-semibold whitespace-normal wrap-anywhere text-gray-900"
        onClick={onOpen}>{task.title}</Button>
    </h3>
    {showEvent && <p className="text-xs wrap-anywhere text-gray-500">{task.event.name}</p>}
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {showEvent && <Badge tone={task.status === 'done' ? 'success' : task.status === 'doing' ? 'info' : 'neutral'}>{statusLabels[task.status]}</Badge>}
      {task.department && <Badge>{task.department.name}</Badge>}
      {task.assignee ? <span className="wrap-anywhere text-gray-600">{task.assignee.name}</span>
        : task.status !== 'done' && <span className="font-medium text-destructive">담당자 없음</span>}
    </div>
    <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-2 text-xs">
      <span className={overdue ? 'font-medium text-destructive' : 'text-gray-500'}>
        {task.dueOn ? `${dueText(task.dueOn)}${overdue ? ' · 지연' : ''}` : '마감일 없음'}</span>
      {manageEvents && next && <Button variant="outline" size="sm" disabled={busy} onClick={onAdvance}>{next.label}</Button>}
    </div>
  </article>
}
