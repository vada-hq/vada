import { useState } from 'react'
import { koreanDateOf, type TaskFilter, type TaskSummary } from '@vada/contracts'
import type { MenuAction } from '@/components/HistoryMenu'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TabButton } from '@/components/ui/tab-button'
import { TASKS_LOAD_FAILED } from '@/lib/messages'
import { departmentColorOf } from './department-color'
import { groupByDue } from './task-groups'
import { TaskCard } from './TaskCard'
import { hasMyTaskFilters, MyTasksFilters, type MyTasksFilterProps } from './MyTasksFilters'
import {
  MY_TASK_EMPTY,
  MY_TASK_FILTER_EMPTY,
  MY_TASK_FILTERS,
  MY_TASK_RESET,
  myTaskOverflow,
} from './my-tasks-text'
import type { useStatusChange } from './useStatusChange'
import type { TaskList } from './useTasks'

type Props = MyTasksFilterProps & {
  open: TaskList
  done: TaskList
  onFilter: (filter: TaskFilter) => void
  onReset: () => void
  onOpenTask: (id: string) => void
  change: ReturnType<typeof useStatusChange>
  cardMenu?: ((task: TaskSummary) => MenuAction[]) | undefined
  today?: string | undefined
}

function MyTasksSummary({ open }: Pick<Props, 'open'>) {
  const { state } = open
  const count = state.kind === 'ready' ? state.tasks.length : null
  const overdue = state.kind === 'ready' ? state.tasks.filter(task => task.overdue).length : null
  const more = state.kind === 'ready' && state.truncated ? '+' : ''
  return (
    <div aria-label="내 업무 요약" className="flex flex-wrap gap-3">
      <Badge tone={overdue ? 'danger' : 'neutral'} className="gap-2 rounded-lg px-3 py-2 text-sm">
        지남{' '}
        <span className="text-right tabular-nums">
          {overdue === null ? '집계 전' : `${overdue}${more}건`}
        </span>
      </Badge>
      <Badge tone={count ? 'warning' : 'neutral'} className="gap-2 rounded-lg px-3 py-2 text-sm">
        해야 할 업무{' '}
        <span className="text-right tabular-nums">
          {count === null ? '집계 전' : `${count}${more}건`}
        </span>
      </Badge>
    </div>
  )
}

function shownTasks(tasks: TaskSummary[], props: MyTasksFilterProps) {
  const search = props.search.trim().toLocaleLowerCase('ko')
  return tasks.filter(
    task =>
      (props.filter === 'done' || props.state === null || task.status === props.state) &&
      [task.title, task.event?.name ?? '', task.department?.name ?? ''].some(text =>
        text.toLocaleLowerCase('ko').includes(search),
      ),
  )
}

function MyTasksCards({ tasks, ...props }: Props & { tasks: TaskSummary[] }) {
  const [today] = useState(() => props.today ?? koreanDateOf(new Date()))
  const sections =
    props.filter === 'open'
      ? groupByDue(tasks, today)
      : [{ key: 'done', title: '완료된 업무', tasks }]
  const { state } = props.filter === 'open' ? props.open : props.done
  const departments =
    state.kind === 'ready'
      ? state.tasks.flatMap(task => (task.department ? [task.department] : []))
      : []
  const card = (task: TaskSummary) => (
    <TaskCard
      key={task.id}
      task={task}
      variant="mine"
      color={departmentColorOf(task.department?.id ?? null, departments)}
      busy={props.change.busy.has(task.id)}
      error={props.change.errors[task.id]}
      onOpen={() => props.onOpenTask(task.id)}
      onFinish={() => void props.change.change(task.id, 'done')}
      menu={props.cardMenu?.(task)}
    />
  )
  return (
    <div className="flex min-w-0 flex-col gap-5">
      {sections.map(section => (
        <section
          key={section.key}
          aria-label={section.title}
          className="flex min-w-0 flex-col gap-2"
        >
          {props.filter === 'open' && (
            <h2
              className={
                section.key === 'overdue'
                  ? 'text-sm font-semibold text-danger-emphasis'
                  : 'text-sm font-semibold text-fg-tertiary'
              }
            >
              {section.title}
            </h2>
          )}
          <ul className="flex min-w-0 flex-col gap-2">{section.tasks.map(card)}</ul>
        </section>
      ))}
    </div>
  )
}

function MyTasksBody(props: Props) {
  const list = props.filter === 'open' ? props.open : props.done
  const { state } = list
  if (state.kind === 'loading') return <StateMessage kind="loading">업무 불러오는 중…</StateMessage>
  if (state.kind === 'failed')
    return (
      <div className="flex flex-col items-start gap-3">
        <StateMessage kind="error">{TASKS_LOAD_FAILED}</StateMessage>
        <Button variant="outline" touch onClick={() => void list.reload()}>
          다시 시도
        </Button>
      </div>
    )
  const tasks = shownTasks(state.tasks, props)
  const filtered = hasMyTaskFilters(props)
  return (
    <>
      {tasks.length ? (
        <MyTasksCards {...props} tasks={tasks} />
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
          <StateMessage kind="empty">
            {filtered ? MY_TASK_FILTER_EMPTY : MY_TASK_EMPTY[props.filter]}
          </StateMessage>
          {filtered && (
            <Button variant="link" touch onClick={props.onReset}>
              {MY_TASK_RESET}
            </Button>
          )}
        </div>
      )}
      {state.truncated && <StateMessage kind="notice">{myTaskOverflow(props.filter)}</StateMessage>}
    </>
  )
}

// MY-01: 요약, 상태 탭 둘, 거르기와 검색, 마감 묶음 카드. 역할은 읽기를 좁히는 조건이 아니다.
export function MyTasksView(props: Props) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-4 break-keep">
      <MyTasksSummary open={props.open} />
      <div role="tablist" aria-label="내 업무 상태" className="flex border-b">
        {MY_TASK_FILTERS.map(item => (
          <TabButton
            key={item.value}
            className="px-3 max-sm:min-h-11 sm:px-4"
            aria-selected={props.filter === item.value}
            onClick={() => props.onFilter(item.value)}
          >
            {item.label}
          </TabButton>
        ))}
      </div>
      <MyTasksFilters {...props} />
      <div role="tabpanel" className="flex min-w-0 flex-col gap-3">
        <MyTasksBody {...props} />
      </div>
    </div>
  )
}
