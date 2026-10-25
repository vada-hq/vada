import { useId, type ReactNode } from 'react'
import { Clipboard, Plus } from 'lucide-react'
import type { TaskStatus, TaskSummary } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TASKS_LOAD_FAILED } from '@/lib/messages'
import { departmentColorOf } from './department-color'
import { STATUS_LABEL } from './task-view'
import { TaskCard } from './TaskCard'
import type { useStatusChange } from './useStatusChange'
import type { TaskList } from './useTasks'

type Props = {
  // 끝나지 않은 업무(할 일·진행 중 열)와 끝난 업무(끝남 열, 마지막으로 바뀐 순 50개)
  open: TaskList
  done: TaskList
  // 부서 색을 돌릴 차례(팀 목록의 부서 순)
  departments: readonly { id: string }[]
  change: ReturnType<typeof useStatusChange>
  onOpenTask: (taskId: string) => void
  // 끝남 열이 넘칠 때 열 아래 [표로 보기]가 여는 표의 '끝남'
  onShowDoneTable: () => void
  // 거르기 전에도 업무가 없는가(useBoardEmpty). 참이면 빈 상태 칸, 거짓이면 이 보기의 빈 문구, 모르면 열만 둔다.
  councilEmpty: boolean | null
  emptyText: string
  // 빈 상태의 [첫 업무 추가]. 만들 수 없는 사람에게는 없다.
  onAddFirst?: (() => void) | undefined
}

type Column = { status: TaskStatus; tasks: TaskSummary[]; truncated: boolean }

// 열 머리 수는 그 열에 보이는 카드 수다. 받은 목록이 상한에서 잘렸으면 수 뒤에 '+'다(끝남은 '50+').
const countText = ({ tasks, truncated }: Column) => `${tasks.length}${truncated ? '+' : ''}`

function BoardColumn({
  column,
  footer,
  card,
}: {
  column: Column
  footer?: ReactNode
  card: (task: TaskSummary) => ReactNode
}) {
  const id = useId()
  return (
    <section
      aria-labelledby={id}
      className="flex min-w-0 flex-col gap-3 rounded-xl border border-gray-200/50 bg-gray-100/50 p-3"
    >
      <h2
        id={id}
        className="mb-1 flex items-center justify-between gap-2 px-1 text-xs font-bold tracking-wider text-gray-500"
      >
        {STATUS_LABEL[column.status]}
        <Badge className="rounded-full bg-gray-200 px-1.5 font-bold">{countText(column)}</Badge>
      </h2>
      <ul className="flex flex-col gap-3">{column.tasks.map(card)}</ul>
      {footer}
    </section>
  )
}

// 업무가 하나도 없을 때 보드 위의 칸(와이어프레임 OPS-TASK-01 빈 상태). 설명 줄은 두지 않는다(DEC-94).
function BoardEmpty({ onAddFirst }: Pick<Props, 'onAddFirst'>) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-300 bg-white py-10 text-center">
      <Clipboard aria-hidden className="size-8 text-gray-300" />
      <p className="mt-3 text-base font-semibold text-gray-700">업무 없음</p>
      {onAddFirst && (
        <Button size="sm" className="mt-4" onClick={onAddFirst}>
          <Plus aria-hidden />첫 업무 추가
        </Button>
      )}
    </div>
  )
}

function columnsOf(open: TaskSummary[], openTruncated: boolean, done: Column): Column[] {
  const byStatus = (status: TaskStatus) => ({
    status,
    tasks: open.filter(task => task.status === status),
    truncated: openTruncated,
  })
  return [byStatus('todo'), byStatus('in_progress'), done]
}

// 넓은 화면(lg 이상)의 상태 열 보드(DEC-94): 열 셋(할 일·진행 중·끝남), 열 머리에 수, 카드. '검토 필요' 열은 없다(DEC-39).
// 업무 메뉴와 행사의 업무 탭이 같이 쓴다. 열은 화면 폭을 셋으로 나눠 1024px에서도 가로로 넘치지 않는다.
export function TaskBoard(props: Props) {
  const { open, done, change } = props
  if (open.state.kind === 'loading' || done.state.kind === 'loading')
    return <StateMessage kind="loading">업무 불러오는 중…</StateMessage>
  if (open.state.kind === 'failed' || done.state.kind === 'failed')
    return (
      <div className="flex flex-col gap-3">
        <StateMessage kind="error">{TASKS_LOAD_FAILED}</StateMessage>
        <Button
          variant="outline"
          className="self-start"
          onClick={() => void Promise.all([open.reload(), done.reload()])}
        >
          다시 시도
        </Button>
      </div>
    )
  const finished: Column = {
    status: 'done',
    tasks: done.state.tasks,
    truncated: done.state.truncated,
  }
  const columns = columnsOf(open.state.tasks, open.state.truncated, finished)
  const empty = columns.every(column => column.tasks.length === 0)
  const card = (task: TaskSummary) => (
    <TaskCard
      key={task.id}
      task={task}
      color={departmentColorOf(task.department?.id ?? null, props.departments)}
      busy={change.busy.has(task.id)}
      error={change.errors[task.id]}
      onOpen={() => props.onOpenTask(task.id)}
      onChangeStatus={status => void change.change(task.id, status)}
    />
  )
  const doneFooter = finished.truncated && (
    <Button variant="ghost" size="sm" className="self-center" onClick={props.onShowDoneTable}>
      표로 보기
    </Button>
  )
  return (
    <div className="flex flex-col gap-4">
      {empty && props.councilEmpty === true && <BoardEmpty onAddFirst={props.onAddFirst} />}
      {empty && props.councilEmpty === false && (
        <StateMessage kind="empty">{props.emptyText}</StateMessage>
      )}
      <div className="grid grid-cols-3 gap-4">
        {columns.map(column => (
          <BoardColumn
            key={column.status}
            column={column}
            card={card}
            footer={column.status === 'done' ? doneFooter : undefined}
          />
        ))}
      </div>
    </div>
  )
}
