import { useState } from 'react'
import type { EventSummary, TaskSummary } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { TaskCalendar } from '@/tasks/TaskCalendar'
import { taskRowOf } from '@/tasks/TaskListBody'

const TYPES = [
  { value: 'all', label: '전체' },
  { value: 'events', label: '행사' },
  { value: 'deadlines', label: '마감' },
] as const
type CalendarType = (typeof TYPES)[number]['value']
type Props = {
  tasks: TaskSummary[]
  events: EventSummary[]
  onOpenTask: (id: string) => void
  onOpenEvent: (id: string) => void
  today?: string | undefined
}

export function CalendarView({ tasks, events, onOpenTask, onOpenEvent, today }: Props) {
  const [type, setType] = useState<CalendarType>('all')
  return (
    <div className="flex min-w-0 flex-col gap-4 break-keep">
      <div role="group" aria-label="일정 유형" className="flex flex-wrap gap-2">
        {TYPES.map(item => (
          <Button
            key={item.value}
            size="sm"
            touch
            variant={type === item.value ? 'secondary' : 'outline'}
            className="rounded-full"
            aria-pressed={type === item.value}
            onClick={() => setType(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <TaskCalendar
        tasks={
          type === 'events'
            ? []
            : tasks.filter(task => task.dueDate !== null && task.status !== 'done')
        }
        events={type === 'deadlines' ? [] : events}
        schedule
        today={today}
        row={taskRowOf(
          { view: 'all', inEvent: false, readOnly: true, onOpenTask, onOpenEvent },
          true,
        )}
        onOpenTask={onOpenTask}
        onOpenEvent={onOpenEvent}
      />
    </div>
  )
}
