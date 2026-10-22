import type { EventSummary } from './events.js'
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

// 줄 수 상한까지 준 목록과 전체 수.
export interface HomeList {
  tasks: TaskSummary[]
  total: number
}

// 부서 직급이 있는 부서 하나(부장·부부장). 수는 끝나지 않은 업무다. 담당자 없음은 업무 화면의 '담당자 없음'과 같다.
export interface HomeDepartment {
  id: string
  name: string
  counts: { todo: number; inProgress: number; overdue: number; unassigned: number }
  overdue: HomeList
  unassigned: HomeList
}

// 행사 카드. tasks는 지우지 않은 이 행사의 업무다. settlement는 끝났고 완료하지 않은 행사에만 있다(남은 것 수는 행사 '돈' 탭의 합).
export interface HomeEventCard {
  event: EventSummary
  tasks: { done: number; total: number; overdue: number; unassigned: number }
  settlement?: { remaining: number; settled: boolean }
}

// 회장단: 부서마다(그리고 부서 없음 null)의 막힌 업무 수. 지남이나 담당자 없음이 있는 것만 온다.
export interface HomeBlocked {
  department: { id: string; name: string } | null
  overdue: number
  unassigned: number
}

export interface HomeCouncil {
  events: HomeEventCard[]
  // 행사가 HOME_EVENT_LIMIT을 넘어 잘렸는가
  truncated: boolean
  blocked: HomeBlocked[]
  // 학생회 전체의 지난 업무. 오래 지난 것부터다.
  overdue: HomeList
}

export interface HomeResponse {
  // 한국 날짜(YYYY-MM-DD). 묶음은 이 날짜로 나눈 것이다.
  today: string
  mine: HomeMine
  // 부서 직급이 있고 학생회 직급이 없을 때만 온다(회장단은 council의 blocked로 본다).
  departments?: HomeDepartment[]
  // 학생회 직급이 있을 때만 온다.
  council?: HomeCouncil
}
