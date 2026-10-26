import { useId, type KeyboardEvent, type ReactNode } from 'react'
import type { TaskStatus, TaskSummary } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { TabButton } from '@/components/ui/tab-button'
import { STATUS_LABEL } from './task-view'

export type StatusColumn = { status: TaskStatus; tasks: TaskSummary[]; truncated: boolean }
export type MobileStatus = { status: TaskStatus; onStatus: (status: TaskStatus) => void }
export const statusCount = ({ tasks, truncated }: StatusColumn) =>
  `${tasks.length}${truncated ? '+' : ''}`

const EMPTY_TEXT: Record<TaskStatus, string> = {
  todo: '할 일 없음',
  in_progress: '진행 중 업무 없음',
  done: '끝난 업무 없음',
}

// 상태는 주소가 원문이다. 화살표·Home·End는 탭의 초점과 선택을 함께 옮긴다.
function moveTab(
  event: KeyboardEvent<HTMLButtonElement>,
  columns: StatusColumn[],
  mobile: MobileStatus,
) {
  const index = columns.findIndex(column => column.status === mobile.status)
  let next = index
  if (event.key === 'ArrowRight') next = (index + 1) % columns.length
  else if (event.key === 'ArrowLeft') next = (index + columns.length - 1) % columns.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = columns.length - 1
  else return
  event.preventDefault()
  mobile.onStatus(columns[next]!.status)
  const tabs =
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
  tabs?.[next]?.focus()
}

export function TaskStatusTabs({
  columns,
  mobile,
  card,
  doneFooter,
}: {
  columns: StatusColumn[]
  mobile: MobileStatus
  card: (task: TaskSummary) => ReactNode
  doneFooter: ReactNode
}) {
  const id = useId()
  const selected = columns.find(column => column.status === mobile.status)!
  const any = columns.some(column => column.tasks.length > 0)
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div role="tablist" aria-label="업무 상태" className="flex border-b">
        {columns.map(column => (
          <TabButton
            key={column.status}
            id={`${id}-${column.status}`}
            aria-controls={`${id}-panel`}
            aria-selected={column.status === mobile.status}
            tabIndex={column.status === mobile.status ? 0 : -1}
            className="min-h-11 min-w-0 flex-1 justify-center gap-2 px-2 break-keep"
            onClick={() => mobile.onStatus(column.status)}
            onKeyDown={event => moveTab(event, columns, mobile)}
          >
            {STATUS_LABEL[column.status]}{' '}
            <span className="text-right text-muted-foreground tabular-nums">
              {statusCount(column)}
            </span>
          </TabButton>
        ))}
      </div>
      <div
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${mobile.status}`}
        tabIndex={0}
        className="flex min-w-0 flex-col gap-3"
      >
        <ul className="flex min-w-0 flex-col gap-3">{selected.tasks.map(card)}</ul>
        {any && selected.tasks.length === 0 && (
          <StateMessage kind="empty">{EMPTY_TEXT[mobile.status]}</StateMessage>
        )}
        {mobile.status === 'done' && doneFooter}
      </div>
    </div>
  )
}
