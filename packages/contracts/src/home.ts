import type { TaskSummary } from './tasks.js'

// 홈(010). 한 번 읽어 그 사람의 부분을 모두 받는다. 있는 부분만 오고, 화면은 직급을 다시 계산하지 않는다(DEC-38).
// 목록마다 줄 수 상한이고 수는 전체를 센다.
export const HOME_LIST_LIMIT = 10
// 학생회 행사 카드는 20개까지다. 넘으면 truncated.
export const HOME_EVENT_LIMIT = 20
// '7일 안'은 내일부터 이 날수 뒤까지다.
export const HOME_SOON_DAYS = 7

export const HOME_TASK_GROUPS = ['overdue', 'today', 'soon'] as const
export type HomeTaskGroup = (typeof HOME_TASK_GROUPS)[number]

export interface HomeTask extends TaskSummary {
  group: HomeTaskGroup
}

// 나에게 맡긴 끝나지 않은 업무. tasks는 지남 → 오늘 → 7일 안 차례로 마감 순 HOME_LIST_LIMIT줄까지다.
export interface HomeMine {
  tasks: HomeTask[]
  counts: { overdue: number; today: number; soon: number; later: number; noDue: number }
}

export interface HomeResponse {
  // 한국 날짜(YYYY-MM-DD). 묶음은 이 날짜로 나눈 것이다.
  today: string
  mine: HomeMine
}
