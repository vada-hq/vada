import type { TaskStatus, TaskSummary, TeamResponse } from '@vada/contracts'
import PersonName from '@/components/PersonName'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import { useOpenDirectFor } from '../chat/direct-open'
import { choiceValue, detailAssigneeChoices } from './task-form-options'
import { assigneeLabel, COUNCIL_TASK_LABEL, dueLabel, nextLabel } from './task-view'
import { TaskEventLink } from './TaskEventLink'

type RowShow = {
  // 내 업무에서는 담당자(나)를 적지 않는다. 대신 부서를 적는다.
  assignee: boolean
  department: boolean
  // 행사의 업무 탭에서는 그 행사 이름을 되풀이하지 않는다.
  event: boolean
  // 달력의 고른 날 목록에서는 마감이 머리의 날짜와 같아 적지 않는다.
  due?: boolean
}

type Props = {
  task: TaskSummary
  show: RowShow
  busy: boolean
  error?: string | undefined
  onChangeStatus: (status: TaskStatus) => void
  onOpen: () => void
  onOpenEvent?: ((eventId: string) => void) | undefined
  // 담당자 없는 업무를 줄에서 바로 맡긴다(요구 15). 맡길 권한이 없거나 팀을 읽기 전이면 없다.
  assign?: { team: TeamResponse; onPick: (assigneeId: string) => void } | undefined
}

// 제목 아래 한 줄: 부서, 행사, 담당자. 없는 것은 빼고 가운뎃점으로 잇는다.
// 담당자 이름을 누르면 그 사람과 1:1이 열린다(022 조각 7). 떠난 사람과 나는 글만이다.
function Meta({ task, show, onOpenEvent }: Pick<Props, 'task' | 'show' | 'onOpenEvent'>) {
  const openFor = useOpenDirectFor()
  const parts = [
    show.department && <span key="department">{task.department?.name ?? COUNCIL_TASK_LABEL}</span>,
    show.event && task.event && (
      <TaskEventLink key="event" event={task.event} onOpen={onOpenEvent} className="text-xs" />
    ),
    show.assignee && (
      <PersonName
        key="assignee"
        name={assigneeLabel(task.assignee)}
        onOpen={task.assignee?.current ? openFor(task.assignee.id) : undefined}
        className={cn('text-xs', task.assignee === null && 'text-yellow-700')}
      />
    ),
  ].filter(Boolean)
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-gray-500">
      {parts.map((part, index) => [
        index > 0 && (
          <span key={`dot-${index}`} aria-hidden>
            ·
          </span>
        ),
        part,
      ])}
    </div>
  )
}

function DueText({ task }: Pick<Props, 'task'>) {
  return (
    <span
      className={cn(
        'shrink-0 text-xs',
        task.overdue ? 'font-medium text-red-600' : 'text-gray-500',
      )}
    >
      {dueLabel(task.dueDate)}
    </span>
  )
}

function AssignSelect({ task, assign, busy }: Pick<Props, 'task' | 'assign' | 'busy'>) {
  if (!assign) return null
  const choices = detailAssigneeChoices(assign.team, task).filter(item => item.id !== null)
  return (
    <NativeSelect
      aria-label={`${task.title} 담당자`}
      className="h-8 w-auto py-1 sm:text-xs"
      value=""
      disabled={busy}
      onChange={event => event.target.value && assign.onPick(event.target.value)}
    >
      <option value="">담당자 지정</option>
      {choices.map(item => (
        <option key={choiceValue(item.id)} value={choiceValue(item.id)}>
          {item.label}
        </option>
      ))}
    </NativeSelect>
  )
}

// 업무 한 줄: 제목(누르면 상세)과 진행 중 표시, 부서·행사·담당자, 마감, 다음 동작(시작·끝내기).
// 카드 대신 줄로 두어 한 화면에 더 많이 보인다(와이어프레임 MY-01). 할 일 상태는 따로 적지 않는다(버튼 '시작'이 말해 준다).
export function TaskRow(props: Props) {
  const { task, busy, error } = props
  const next = task.actions.includes('task.change_status') ? task.next : null
  return (
    <li className="flex flex-col gap-1 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <Button
              variant="link"
              className="h-auto min-w-0 justify-start p-0 text-left text-sm font-medium whitespace-normal text-gray-900 wrap-anywhere"
              onClick={props.onOpen}
            >
              {task.title}
            </Button>
            {task.status === 'in_progress' && <Badge tone="info">진행 중</Badge>}
            {props.show.due === false && task.overdue && <Badge tone="danger">지남</Badge>}
          </div>
          <Meta task={task} show={props.show} onOpenEvent={props.onOpenEvent} />
        </div>
        {props.show.due !== false && <DueText task={task} />}
        <AssignSelect task={task} assign={props.assign} busy={busy} />
        {next && (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            busy={busy}
            onClick={() => props.onChangeStatus(next)}
          >
            {nextLabel(next)}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive wrap-anywhere">
          {error}
        </p>
      )}
    </li>
  )
}
