import { useState } from 'react'
import { CalendarDays, Flag, ListChecks } from 'lucide-react'
import type { TaskSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { dueText, groupByDate, isOverdue, statusLabels, type ScheduleItem } from './task-view'

const icons = { event: CalendarDays, deadline: Flag, task: ListChecks }
const kindLabels = { event: '행사', deadline: '마감', task: '업무' }
const kindTones = { event: 'success', deadline: 'warning', task: 'neutral' } as const

// 일정 보기. 오늘부터는 다가오는 일정, 지난 날짜는 접은 지난 일정이다. 업무 줄을 누르면 상세를 연다.
export default function TaskSchedule({ items, today, onOpen }: { items: ScheduleItem[]; today: string; onOpen: (task: TaskSummary) => void }) {
  const [showPast, setShowPast] = useState(false)
  const upcoming = items.filter(item => item.date >= today)
  const past = items.filter(item => item.date < today)
  const list = (label: string, entries: ScheduleItem[]) => <section aria-label={label} className={cn(cardClass, 'divide-y divide-gray-100')}>
    {groupByDate(entries).map(group => <div key={group.date} className="flex gap-4 p-4">
      <p className="w-12 shrink-0 text-sm font-semibold text-gray-700">{dueText(group.date)}</p>
      <ul className="flex min-w-0 flex-1 flex-col gap-2">{group.items.map(item => {
        const Icon = icons[item.kind]
        const task = item.task
        const overdue = task !== null && isOverdue(task, today)
        return <li key={item.key} className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          <Icon aria-hidden className="size-4 shrink-0 text-gray-400" />
          <Badge tone={kindTones[item.kind]}>{kindLabels[item.kind]}</Badge>
          {task ? <Button variant="link" className="h-auto justify-start p-0 text-left text-sm whitespace-normal wrap-anywhere text-gray-900"
            onClick={() => onOpen(task)}>{item.title}</Button> : <span className="wrap-anywhere text-gray-900">{item.title}</span>}
          {item.note && <span className="text-xs text-gray-500">{item.note}</span>}
          {task && <span className={cn('text-xs wrap-anywhere', overdue ? 'font-medium text-destructive' : 'text-gray-500')}>
            {statusLabels[task.status]}{overdue ? ' · 지연' : ''}{task.assignee ? ` · ${task.assignee.name}` : ''}</span>}
        </li>
      })}</ul>
    </div>)}
  </section>
  return <div className="flex flex-col gap-3">
    {upcoming.length ? list('다가오는 일정', upcoming) : <p className="text-sm text-gray-500">다가오는 일정이 없어요.</p>}
    {past.length > 0 && (showPast ? list('지난 일정', past)
      : <Button variant="outline" size="sm" className="self-start" onClick={() => setShowPast(true)}>지난 일정 {past.length}개 보기</Button>)}
  </div>
}
