import type { ReactNode } from 'react'
import { ArrowUpRight, ClipboardList } from 'lucide-react'
import { recordPath, type MeetingAgendaItem, type TaskStatus } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { navigate } from '@/lib/app-location'
import { dueLabel, NO_ASSIGNEE_LABEL, STATUS_LABEL } from '@/tasks/task-view'
import { MINUTES_TEXT as T } from './minutes-text'

type Props = {
  councilId: string
  items: MeetingAgendaItem['followUps']
  create?: ReactNode
}

const STATUS_TONE: Record<TaskStatus, 'success' | 'info' | 'neutral'> = {
  todo: 'neutral',
  in_progress: 'info',
  done: 'success',
}

// 와이어프레임 05B의 후속 업무 카드(아이콘 · 제목 · 담당자·마감 · ↗)에 07의 진행 현황(지금 상태)을 더한다.
// 누르면 업무 보드의 원래 카드와 상세 패널이 열린다(07 '후속 업무 열기').
export function FollowUpRow({
  councilId,
  task,
}: {
  councilId: string
  task: Props['items'][number]
}) {
  return (
    <Button
      variant="outline"
      touch
      className="h-auto w-full min-w-0 justify-start gap-3 p-3 text-left font-normal whitespace-normal"
      onClick={() => navigate(recordPath('tasks', councilId, task.id))}
    >
      <ClipboardList className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="wrap-anywhere font-medium">{task.title}</span>
        <span className="flex flex-wrap gap-x-1 text-xs text-muted-foreground">
          <span className="wrap-anywhere">{task.assignee?.name ?? NO_ASSIGNEE_LABEL}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{dueLabel(task.dueDate)}</span>
        </span>
      </span>
      <Badge tone={STATUS_TONE[task.status]}>{STATUS_LABEL[task.status]}</Badge>
      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Button>
  )
}

export function MinutesFollowUps({ councilId, items, create }: Props) {
  return (
    <section className="flex min-w-0 flex-col gap-3 border-t pt-5" aria-label={T.followUps}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{T.followUps}</h3>
        {create}
      </div>
      {items.length ? (
        <ul className="flex min-w-0 flex-col gap-2">
          {items.map(task => (
            <li key={task.id}>
              <FollowUpRow councilId={councilId} task={task} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{T.emptyFollowUps}</p>
      )}
    </section>
  )
}
