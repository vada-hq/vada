import type { TaskStatus, TaskSummary } from '@vada/contracts'

type Counted = { tasks: TaskSummary[]; truncated: boolean }
export type Column = Counted & { status: TaskStatus }

// 열(휴대폰은 상태 탭) 머리 수는 그 상태에 보이는 업무 수다. 받은 목록이 상한에서 잘렸으면 수 뒤에 '+'다(끝남은 '50+').
export const countText = ({ tasks, truncated }: Counted) => `${tasks.length}${truncated ? '+' : ''}`

// 끝나지 않은 목록을 할 일·진행 중으로 나누고 끝난 목록을 끝남으로 둔다. 보드의 열과 휴대폰 상태 탭이 같이 쓴다.
export function columnsOf(open: TaskSummary[], openTruncated: boolean, done: Column): Column[] {
  const byStatus = (status: TaskStatus) => ({
    status,
    tasks: open.filter(task => task.status === status),
    truncated: openTruncated,
  })
  return [byStatus('todo'), byStatus('in_progress'), done]
}
