import { TASK_STATUSES, type TaskStatus } from '@vada/contracts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { STATUS_LABEL } from './task-view'

type Props = {
  status: TaskStatus
  // task.change_status가 있을 때만 바꿀 수 있다(DEC-38). 없으면 지금 상태만 보인다.
  canChange: boolean
  busy: boolean
  onChange: (status: TaskStatus) => void
}

// 상태마다 색 점. 끝남은 초록, 진행 중은 파랑, 할 일은 회색이다(와이어프레임 상태 칩 색).
const DOT: Record<TaskStatus, string> = {
  todo: 'bg-gray-400',
  in_progress: 'bg-blue-500',
  done: 'bg-green-500',
}
const ACTIVE: Record<TaskStatus, string> = {
  todo: 'text-gray-900',
  in_progress: 'text-blue-700',
  done: 'text-green-700',
}

// 상태 셋을 한 줄로 이은 단추 묶음(segmented control). 한 번 눌러 어느 상태로든 바꾼다(DEC-94 '상세에는 상태 단추 셋').
// 셋뿐이라 펼치는 메뉴(Linear·Jira)보다 한 번 덜 누르고, 지금 어디까지 왔는지가 늘 보인다.
export function TaskStatusSwitch({ status, canChange, busy, onChange }: Props) {
  if (!canChange)
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', ACTIVE[status])}>
        <span aria-hidden className={cn('size-2 rounded-full', DOT[status])} />
        {STATUS_LABEL[status]}
      </span>
    )
  return (
    <div
      role="group"
      aria-label="상태"
      className="inline-flex w-full rounded-md bg-gray-100 p-1 sm:w-auto"
    >
      {TASK_STATUSES.map(item => {
        const on = item === status
        return (
          <Button
            key={item}
            variant="ghost"
            size="sm"
            aria-pressed={on}
            busy={busy}
            className={cn(
              'flex-1 gap-1.5 px-3 text-sm sm:flex-none',
              on ? cn('bg-white shadow-sm hover:bg-white', ACTIVE[item]) : 'text-gray-500',
            )}
            onClick={() => {
              if (!on) onChange(item)
            }}
          >
            <span
              aria-hidden
              className={cn('size-2 rounded-full', on ? DOT[item] : 'bg-gray-300')}
            />
            {STATUS_LABEL[item]}
          </Button>
        )
      })}
    </div>
  )
}
