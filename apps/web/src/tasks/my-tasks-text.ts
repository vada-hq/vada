import { TASK_DONE_LIMIT, TASK_OPEN_LIMIT, type TaskFilter } from '@vada/contracts'

export const MY_TASK_FILTERS: { value: TaskFilter; label: string }[] = [
  { value: 'open', label: '해야 할 업무' },
  { value: 'done', label: '완료된 업무' },
]
export const MY_TASK_EMPTY = { open: '내 업무 없음', done: '완료된 업무 없음' }
export const MY_TASK_FILTER_EMPTY = '조건에 맞는 업무 없음'
export const MY_TASK_RESET = '필터 초기화'
export const MY_TASK_EVENTS_FAILED = '범위를 불러오지 못했어요.'
export const myTaskOverflow = (filter: TaskFilter) =>
  `업무가 많아 ${filter === 'open' ? TASK_OPEN_LIMIT : TASK_DONE_LIMIT}개만 보여요.`
