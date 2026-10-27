import { ArrowUpRight } from 'lucide-react'
import type { TaskAction, TaskDetail } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OptionList, type Option } from '@/components/ui/option-list'
import { TASK_TEAM_FAILED } from '@/lib/messages'
import { dayLabel } from '@/lib/month-grid'
import { cn } from '@/lib/utils'
import type { TaskEdit } from './task-edits'
import { assigneeLabel, COUNCIL_TASK_LABEL, NO_EVENT_LABEL } from './task-view'
import { TaskDuePicker } from './TaskDuePicker'
import { TaskProperty } from './TaskProperty'
import type { TaskProblem, TaskWhere } from './useTaskDetail'

// 고르기 창의 선택지. null은 아직 읽는 중이다(창을 열면 '불러오는 중').
// teamFailed는 사람·부서 목록을 읽지 못했다는 뜻이다(담당자·부서 창에 이유를 보인다).
export type TaskPickOptions = {
  departments: Option[] | null
  assignees: Option[] | null
  events: Option[] | null
  teamFailed?: boolean | undefined
}

type Props = {
  task: TaskDetail
  today: string
  busy: boolean
  problem: TaskProblem | null
  options: TaskPickOptions
  onEdit: (edit: TaskEdit) => unknown
  onNeedEvents?: (() => void) | undefined
  onOpenEvent?: ((eventId: string) => void) | undefined
}

export const errorIn = (problem: TaskProblem | null, where: TaskWhere) =>
  problem?.where === where ? problem.text : undefined

function Picker({
  label,
  options,
  value,
  searchLabel,
  failed,
  onPick,
}: {
  label: string
  options: Option[] | null
  value: string | null
  searchLabel?: string
  failed?: boolean | undefined
  onPick: (id: string | null) => void
}) {
  if (options === null && failed)
    return (
      <StateMessage kind="error" className="p-3">
        {TASK_TEAM_FAILED}
      </StateMessage>
    )
  if (options === null)
    return (
      <StateMessage kind="loading" className="p-3">
        불러오는 중이에요
      </StateMessage>
    )
  return (
    <OptionList
      label={label}
      options={options}
      value={value}
      searchLabel={searchLabel}
      onPick={onPick}
    />
  )
}

function DueValue({ task }: { task: TaskDetail }) {
  if (!task.dueDate) return '마감 없음'
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className={cn(task.overdue && 'font-semibold text-red-600')}>
        {dayLabel(task.dueDate)}
      </span>
      {task.overdue && <Badge tone="danger">지남</Badge>}
    </span>
  )
}

function DepartmentValue({ task, options }: { task: TaskDetail; options: Option[] | null }) {
  const dot = options?.find(option => option.id === (task.department?.id ?? null))?.dot
  return (
    <span className="inline-flex items-center gap-2">
      {dot && <span aria-hidden className={cn('size-2 shrink-0 rounded-full', dot)} />}
      {task.department?.name ?? COUNCIL_TASK_LABEL}
    </span>
  )
}

function EventOpen({
  event,
  onOpen,
}: {
  event: TaskDetail['event']
  onOpen: Props['onOpenEvent']
}) {
  if (!event || !onOpen) return null
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`${event.name} 열기`}
      className="-my-1 p-1"
      onClick={() => onOpen(event.id)}
    >
      <ArrowUpRight />
    </Button>
  )
}

// 사실 칸 넷(와이어프레임 OPS 패널의 2열 칸: 담당자·마감 / 담당 부서·행사). 값을 누르면 고르기 창이 열리고 고르면 바로 바뀐다.
// 비어 있는 값은 흐리게 둔다. 빨강은 마감 지남에만 쓴다(DEC-97, 카드와 같다).
export function TaskFactGrid({
  task,
  today,
  busy,
  problem,
  options,
  onEdit,
  onNeedEvents,
  onOpenEvent,
}: Props) {
  const can = (action: TaskAction) => task.actions.includes(action)
  const pick = (edit: TaskEdit, close: () => void) => {
    close()
    void onEdit(edit)
  }
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-gray-200">
      <TaskProperty
        label="담당자"
        value={assigneeLabel(task.assignee)}
        empty={task.assignee === null}
        editable={can('task.change_assignee')}
        busy={busy}
        error={errorIn(problem, 'assignee')}
      >
        {close => (
          <Picker
            label="담당자"
            searchLabel="이름으로 찾기"
            options={options.assignees}
            failed={options.teamFailed}
            value={task.assignee?.id ?? null}
            onPick={assigneeId => pick({ field: 'assignee', assigneeId }, close)}
          />
        )}
      </TaskProperty>
      <TaskProperty
        label="마감"
        value={<DueValue task={task} />}
        empty={!task.dueDate}
        editable={can('task.edit')}
        busy={busy}
        error={errorIn(problem, 'dueDate')}
        popoverClassName="w-80"
      >
        {close => (
          <TaskDuePicker
            value={task.dueDate}
            today={today}
            onPick={dueDate => pick({ field: 'dueDate', dueDate }, close)}
          />
        )}
      </TaskProperty>
      <TaskProperty
        label="담당 부서"
        value={<DepartmentValue task={task} options={options.departments} />}
        editable={can('task.change_department')}
        busy={busy}
        error={errorIn(problem, 'department')}
      >
        {close => (
          <Picker
            label="담당 부서"
            options={options.departments}
            failed={options.teamFailed}
            value={task.department?.id ?? null}
            onPick={departmentId => pick({ field: 'department', departmentId }, close)}
          />
        )}
      </TaskProperty>
      <TaskProperty
        label="행사"
        value={task.event?.name ?? NO_EVENT_LABEL}
        empty={!task.event}
        editable={can('task.edit')}
        busy={busy}
        error={errorIn(problem, 'event')}
        onOpen={onNeedEvents}
        extra={<EventOpen event={task.event} onOpen={onOpenEvent} />}
      >
        {close => (
          <Picker
            label="행사"
            options={options.events}
            value={task.event?.id ?? null}
            onPick={eventId => pick({ field: 'event', eventId }, close)}
          />
        )}
      </TaskProperty>
    </div>
  )
}
