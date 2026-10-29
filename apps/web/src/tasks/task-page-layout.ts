import type { TaskFilter, TaskLayout, TaskStatus } from '@vada/contracts'

type Controls = { layout: TaskLayout; filter: TaskFilter; column: TaskStatus }

// 폭과 배치로 고르는 업무 화면의 몸통. 넓은 화면의 보드, 1024px 아래 보드·표의 상태 탭(026 조각 4), 그 밖의 표와 달력이다.
// 빠른 추가는 끝나지 않은 업무를 볼 때만 있다. 넓은 화면의 보드는 거르기 없이 늘 끝나지 않은 업무를 담는다.
// 끝남 거르기는 넓은 화면의 표에만 있다(보드는 열, 상태 탭은 탭이 같은 일을 한다).
export function pageLayoutOf({ layout, filter, column }: Controls, wide: boolean) {
  const calendar = layout === 'calendar'
  const board = layout === 'board' && wide
  const statusTabs = !calendar && !wide
  const open = statusTabs ? column !== 'done' : board || filter === 'open'
  return { board, statusTabs, adding: !calendar && open, showFilter: !calendar && wide && !board }
}
