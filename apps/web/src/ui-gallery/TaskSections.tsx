import type { TaskSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { countOf } from '@/tasks/task-view'
import { cardClass } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { TaskRow } from '@/tasks/TaskRow'
import { Section } from './GallerySection'
import { longName, unbroken } from './sample-text'

const task = (id: string, extra: Partial<TaskSummary>): TaskSummary => ({
  id,
  title: '신입생 환영회 장소 예약',
  status: 'todo',
  next: 'in_progress',
  dueDate: '2026-10-25',
  overdue: false,
  department: { id: 'd1', name: '기획부' },
  event: null,
  assignee: { id: 'p1', name: '김새내', current: true },
  actions: ['task.change_status'],
  ...extra,
})

const noop = () => {}
const rowProps = {
  show: { assignee: true, department: true, event: true },
  busy: false,
  onChangeStatus: noop,
  onOpen: noop,
  onOpenEvent: noop,
}

export function TaskSection() {
  const overdue = countOf([task('a', { overdue: true })], false)
  const open = countOf([task('b', {}), task('c', {})], true)
  return (
    <Section title="업무 줄·수 배지">
      <div className="flex w-full items-center gap-2">
        {overdue && <Badge tone={overdue.tone}>{overdue.label}</Badge>}
        {open && <Badge tone={open.tone}>{open.label}</Badge>}
      </div>
      <ul className={cn(cardClass, 'w-96 divide-y')}>
        <TaskRow task={task('1', {})} {...rowProps} />
        <TaskRow
          task={task('2', { status: 'in_progress', next: 'done', overdue: true })}
          {...rowProps}
          busy
        />
        <TaskRow
          task={task('3', {
            status: 'done',
            next: null,
            actions: [],
            assignee: null,
            dueDate: null,
          })}
          {...rowProps}
        />
        <TaskRow task={task('5', { event: { id: 'e1', name: '신입생 환영회' } })} {...rowProps} />
        <TaskRow
          task={task('4', {
            title: `${unbroken} ${longName}`,
            assignee: { id: 'p2', name: longName, current: false },
          })}
          {...rowProps}
          error="상태를 바꾸지 못했어요. 다시 시도해 주세요."
        />
      </ul>
    </Section>
  )
}
