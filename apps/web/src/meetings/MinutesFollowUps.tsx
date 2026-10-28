import type { ReactNode } from 'react'
import { recordPath, type MeetingAgendaItem } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { navigate } from '@/lib/app-location'
import { NO_ASSIGNEE_LABEL, STATUS_LABEL } from '@/tasks/task-view'
import { MINUTES_TEXT as T } from './minutes-text'

type Props = {
  councilId: string
  items: MeetingAgendaItem['followUps']
  create?: ReactNode
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
              <Button
                variant="ghost"
                touch
                className="h-auto w-full min-w-0 justify-start gap-3 px-2 py-3 text-left whitespace-normal"
                onClick={() => navigate(recordPath('tasks', councilId, task.id))}
              >
                <span className="min-w-0 flex-1 wrap-anywhere">{task.title}</span>
                <Badge
                  tone={
                    task.status === 'done'
                      ? 'success'
                      : task.status === 'in_progress'
                        ? 'info'
                        : 'neutral'
                  }
                >
                  {STATUS_LABEL[task.status]}
                </Badge>
                <span className="max-w-24 wrap-anywhere text-xs text-muted-foreground">
                  {task.assignee?.name ?? NO_ASSIGNEE_LABEL}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{T.emptyFollowUps}</p>
      )}
    </section>
  )
}
