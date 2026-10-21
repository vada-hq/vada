import type { TaskSummary } from '@vada/contracts'
import { Badge } from '@/components/ui/badge'
import { countOf } from '@/tasks/task-view'
import TaskCard from '@/tasks/TaskCard'
import { Section } from './GallerySection'
import { longName, unbroken } from './sample-text'

const task = (id: string, extra: Partial<TaskSummary>): TaskSummary => ({
  id,
  title: '신입생 환영회 장소 예약',
  status: 'todo',
  dueDate: '2026-10-25',
  overdue: false,
  department: { id: 'd1', name: '기획부' },
  assignee: { id: 'p1', name: '김새내', current: true },
  actions: ['task.status'],
  ...extra,
})

const noop = () => {}

export function TaskSection() {
  const overdue = countOf([task('a', { overdue: true })], false)
  const open = countOf([task('b', {}), task('c', {})], true)
  return (
    <Section title="업무 카드·수 배지">
      <div className="flex w-full items-center gap-2">
        {overdue && <Badge tone={overdue.tone}>{overdue.label}</Badge>}
        {open && <Badge tone={open.tone}>{open.label}</Badge>}
      </div>
      <div className="flex w-80 flex-col gap-2">
        <TaskCard task={task('1', {})} busy={false} onChangeStatus={noop} />
        <TaskCard
          task={task('2', { status: 'in_progress', overdue: true })}
          busy
          onChangeStatus={noop}
        />
        <TaskCard
          task={task('3', { status: 'done', actions: [], assignee: null, dueDate: null })}
          busy={false}
          onChangeStatus={noop}
        />
        <TaskCard
          task={task('4', {
            title: `${unbroken} ${longName}`,
            assignee: { id: 'p2', name: longName, current: false },
          })}
          busy={false}
          error="상태를 바꾸지 못했어요. 다시 시도해 주세요."
          onChangeStatus={noop}
          onOpen={noop}
        />
      </div>
    </Section>
  )
}
