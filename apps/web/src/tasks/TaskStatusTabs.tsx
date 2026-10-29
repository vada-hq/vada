import { useId, type ReactNode } from 'react'
import { TASK_STATUSES, type TaskFilter, type TaskStatus } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { TabButton } from '@/components/ui/tab-button'
import { BoardEmpty } from './TaskBoard'
import { countText } from './task-columns'
import { STATUS_EMPTY } from './task-text'
import { STATUS_LABEL } from './task-view'
import type { TaskList } from './useTasks'

type Props = {
  // 끝나지 않은 업무(할 일·진행 중 탭)와 끝난 업무(끝남 탭, 마지막으로 바뀐 순 50개)
  open: TaskList
  done: TaskList
  column: TaskStatus
  onColumn: (status: TaskStatus) => void
  // 거르기 전에도 업무가 없는가(useBoardEmpty). 보드와 같이 참이면 빈 상태 칸, 거짓이면 이 보기의 빈 문구다.
  councilEmpty: boolean | null
  emptyText: string
  onAddFirst?: (() => void) | undefined
  // 고른 상태의 줄 목록. 읽는 중·실패·빈 탭도 이 몸통이 다룬다.
  body: (list: TaskList, filter: TaskFilter, emptyText: string) => ReactNode
}

// 그 상태의 업무만 남긴 목록. 끝남은 끝난 목록 그대로다.
function listOf({ open, done }: Pick<Props, 'open' | 'done'>, status: TaskStatus): TaskList {
  if (status === 'done') return done
  const { state } = open
  if (state.kind !== 'ready') return open
  return { ...open, state: { ...state, tasks: state.tasks.filter(task => task.status === status) } }
}

const emptyOf = (lists: TaskList[]) =>
  lists.every(list => list.state.kind === 'ready' && list.state.tasks.length === 0)

function Panel(props: Props) {
  if (emptyOf([props.open, props.done])) {
    if (props.councilEmpty === true) return <BoardEmpty onAddFirst={props.onAddFirst} />
    if (props.councilEmpty === false)
      return <StateMessage kind="empty">{props.emptyText}</StateMessage>
  }
  const filter = props.column === 'done' ? 'done' : 'open'
  return props.body(listOf(props, props.column), filter, STATUS_EMPTY[props.column])
}

// 1024px 아래의 업무 보드(026 조각 4, DEC-94): 열 셋을 나란히 두지 않고 상태 탭으로 한 번에 한 상태의 줄을 본다.
// Trello·Jira 휴대폰 앱이 보드를 한 열씩 넘겨 보는 것과 같다. 탭 수는 보드 열 머리와 같은 규칙이고, 읽기 전이면 수를 적지 않는다.
// 끌어 옮기기는 없고 줄의 [시작]·[끝내기]로 바꾼다(그 업무 actions에 상태 바꾸기가 있을 때만).
export function TaskStatusTabs(props: Props) {
  const id = useId()
  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="업무 상태" className="flex border-b">
        {TASK_STATUSES.map(status => {
          const list = listOf(props, status)
          return (
            <TabButton
              key={status}
              id={`${id}-${status}`}
              aria-controls={`${id}-panel`}
              aria-selected={status === props.column}
              className="flex-1 justify-center gap-1 px-2 max-sm:min-h-11"
              onClick={() => props.onColumn(status)}
            >
              {STATUS_LABEL[status]}{' '}
              {list.state.kind === 'ready' && (
                <span className="tabular-nums">{countText(list.state)}</span>
              )}
            </TabButton>
          )
        })}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-${props.column}`}
        className="flex flex-col gap-3"
      >
        <Panel {...props} />
      </div>
    </div>
  )
}
