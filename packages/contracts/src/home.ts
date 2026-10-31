import type { EventRef } from './budget.js'
import type { HomeFinanceBoard, HomeFinanceSummary } from './home-finance.js'
import type { HomeDepartmentBoard } from './home-department.js'
import type { HomeOps } from './home-ops.js'
import type { HomeEventLanes } from './home-lanes.js'
import type { HomeTodo } from './home-todo.js'
import type { HomeWeek } from './home-week.js'
export type { HomeDepartmentBoard, HomeDepartmentBudget } from './home-department.js'
import type { EventNext, EventSummary } from './events.js'
import { DAY_MS, koreanDateOf } from './korean-time.js'
import type { PurchaseRequestSummary } from './purchases.js'
import type { EventSettlementRow } from './settlement.js'
import type { TaskSummary } from './tasks.js'
import type { ScheduleType } from './calendar.js'

// 홈(010). 한 번 읽어 그 사람의 부분을 모두 받는다. 있는 부분만 오고, 화면은 직급을 다시 계산하지 않는다(DEC-38).
// 목록마다 줄 수 상한이고 수는 전체를 센다.
export const HOME_LIST_LIMIT = 10
// 학생회 행사 카드는 20개까지다. 넘으면 truncated.
export const HOME_EVENT_LIMIT = 20
// 그 가운데 끝났고 완료하지 않은 행사(정산이 남은 것)는 끝난 지 오래된 것부터 이만큼까지다. 정산 질의는 보여 주는 행사에만 돈다.
export const HOME_ENDED_LIMIT = 10
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
// todo·inProgress는 끝나지 않은 업무 수라 지남과 담당자 없음이 그 안에 겹쳐 있다(합치면 안 된다).
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
  // 행사가 상한(HOME_EVENT_LIMIT, 끝난 행사는 HOME_ENDED_LIMIT)을 넘어 잘렸는가
  truncated: boolean
  // 끝났고 완료하지 않은 행사의 전체 수(카드는 HOME_ENDED_LIMIT개까지)
  endedTotal: number
  blocked: HomeBlocked[]
  // 학생회 전체의 지난 업무. 오래 지난 것부터다.
  overdue: HomeList
  // 지금 기수에 학생회 직급도 열린 부서 소속도 없는 운영진 수(DEC-87). 저장하지 않고 열 때마다 센다.
  unassignedMembers: number
}

// 재정부가 받은 것: 결재 대기 요청(pending 보기와 같다), 필요한 때 순·비면 끝·같으면 오래된 순 HOME_LIST_LIMIT줄까지.
// total은 그 보기가 준 수다(보기에 상한이 있어 truncated면 그보다 많다).
// pendingItems는 그 요청들에서 아직 결재하지 않은 품목 수로, 처리 단계 '검토 대기'의 수와 같은 셈이다.
export interface HomeReceived {
  requests: PurchaseRequestSummary[]
  total: number
  pendingItems: number
  truncated: boolean
}

// 정산할 행사: 끝났고 완료하지 않은 행사(끝난 지 오래된 것부터 HOME_ENDED_LIMIT개까지)와 정산에 남은 것 수.
export interface HomeSettling {
  events: EventSettlementRow[]
  total: number
}

// 역할별 홈(DEC-95). 서버가 학생회 직급 → 재정 역할 부서 → 부서 직급 → 그 밖의 차례로 고르고, 화면은 다시 계산하지 않는다(DEC-38).
// council 회장단(HOME-01C), finance 재정부(HOME-01F), department 부서장(HOME-01D), member 부원(HOME-01M, 부서 없는 운영진 포함).
export type HomeKind = 'council' | 'finance' | 'department' | 'member'
// 홈 주소의 보기 값(view). 기본(운영 보기)은 주소에 없고, 재정 보기가 있는 사람(회장단+재정)만 쓴다(DEC-78 규칙 1·2).
export const HOME_VIEWS = ['finance'] as const

// 카드마다 화면이 그리는 줄 수(DEC-95). 서버는 HOME_LIST_LIMIT줄까지 보내고 전체 수를 따로 준다.
export const HOME_CARD_ROWS = 3
// 인사 카드의 '학생회 주요 행사' 타일 수
export const HOME_FEATURED_LIMIT = 3
// 내 요청에서 반려·일부 승인된 것은 낸 지 이 날수 안의 것만 둔다(오래된 것은 재정 화면에서 본다).
const HOME_ANSWERED_REQUEST_DAYS = 14

// 'YYYY-MM-DD' 두 날짜 사이의 날 수(달력으로 센다). 홈 화면의 D-N과 이번 주 행사가 같이 쓴다.
export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)

// 내 요청 중 아직 볼 것: 반려·일부 승인(다시 낼지 내가 정한다)을 먼저, 그다음 결재 대기를 오래된 순(DEC-76이 정한 줄, DEC-95 부원 '내 요청').
// 재정 '내 요청' 목록에 거는 거르기라, 서버(홈 응답)와 화면이 같은 셈을 쓴다.
export function openRequestsOf(requests: PurchaseRequestSummary[], today: string) {
  const answered = requests.filter(
    request =>
      (request.status === 'rejected' || request.status === 'partial') &&
      daysBetween(koreanDateOf(new Date(request.createdAt)), today) <= HOME_ANSWERED_REQUEST_DAYS,
  )
  const waiting = requests
    .filter(request => request.status === 'pending')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return [...answered, ...waiting]
}

// 나에게 맡긴 끝나지 않은 업무의 요약. 수는 업무 '내 업무' 탭과 같다. nearest는 마감이 가장 이른 것(지난 것 포함)이다.
export interface HomeMyTasks {
  open: number
  overdue: number
  nearest: TaskSummary | null
}

// 참여 행사 한 줄: 그 사람의 부서가 담당 부서인 완료 전 행사(DEC-25, DEC-67).
// tasks는 그 부서들의 지우지 않은 업무(끝남/전체)이고 행사 업무 탭의 그 부서 수와 같다. next는 그 부서 업무 가운데 다음 마감이다.
export interface HomeParticipation {
  event: EventSummary
  tasks: { done: number; total: number }
  next: { taskId: string; title: string; dueDate: string } | null
}

// 행사 목록과 같은 차례(진행 중 → 예정 → 날짜 미정 → 끝남)로 HOME_LIST_LIMIT줄까지와 전체 수
export interface HomeParticipating {
  events: HomeParticipation[]
  total: number
}

// 가까운 일정 한 줄. date는 한국 날짜, time은 한국 'HH:mm'이고 종일이면 null이다.
export type HomeUpcomingItem =
  | { kind: 'event_start'; date: string; time: string; event: EventRef }
  | {
      kind: 'registration_close'
      date: string
      time: string
      event: EventRef
      form: { id: string; name: string }
    }
  | { kind: 'task_due'; date: string; time: null; task: TaskSummary }
  | {
      kind: 'schedule_item'
      date: string
      time: string | null
      item: { id: string; title: string; type: ScheduleType }
    }

// 오늘부터 7일째(HOME_SOON_DAYS, 한국 날짜)까지의 행사 시작·신청 마감·업무 마감과 범위에 겹치는 일정. 날짜순, 같은 날은 종일 먼저·시각순이다.
// 행사·업무 범위는 홈 종류를 따른다(DEC-95). 일정은 홈 종류와 관계없이 읽을 수 있는 것 모두이며, 이어지는 일정도 원래 시작 일시다(DEC-102).
export interface HomeUpcoming {
  items: HomeUpcomingItem[]
  total: number
}

// 내가 낸 요청 가운데 아직 볼 것(openRequestsOf). HOME_LIST_LIMIT줄까지와 전체 수.
export interface HomeMyRequests {
  requests: PurchaseRequestSummary[]
  total: number
}

// 회장단 '전체 행사 진행 현황'의 행사 카드 수(DEC-95). 서버가 이만큼만 보내고 상태별 수를 따로 준다.
export const HOME_COUNCIL_EVENT_CARDS = 3

// 회장단 홈 행사 카드의 행사. 책임자는 싣지 않는다(DEC-95, 기획자 정의서 '책임부서·책임자는 표시하지 않는다').
export type HomeBoardEventRef = Pick<EventSummary, 'id' | 'name' | 'startsAt' | 'endsAt' | 'status'>

// 행사 카드 하나. tasks의 done·total은 행사 업무 탭과 같은 셈(taskCountsByEvent), overdue·unassigned는 끝나지 않은 업무 가운데
// 업무 화면의 지남·담당자 없음이다. next는 행사 머리의 다음 일정과 같은 셈이다(DEC-93).
export interface HomeBoardEvent {
  event: HomeBoardEventRef
  tasks: { done: number; total: number; overdue: number; unassigned: number }
  next: EventNext | null
}

// 후속 정리 중인 행사 한 줄(끝났고 완료하지 않은 행사). 남은 정리는 끝나지 않은 업무 수와 정산에 남은 것 수(DEC-93)이고,
// 정산 수는 재정 '행사 정산' 탭과 같은 셈이다. endedDays는 행사 머리의 '끝난 지 N일'과 같은 셈이다.
export interface HomeFollowUp {
  event: HomeBoardEventRef
  endedDays: number | null
  remaining: { tasks: number; settlement: number }
}

// 회장단 홈(HOME-01C)의 칸. 회장단 홈 종류에만 온다.
export interface HomeCouncilBoard {
  // 이 학생회 지금 기수의 재정 역할 부서에 유효한 구성원이 있는가(구매 요청 알림 수신자와 같은 기준).
  financeStaffed: boolean
  events: {
    // 완료하지 않았고 끝나지 않은 행사 가운데 진행 중 → 기획 중(시작 순, 날짜 미정은 끝), HOME_COUNCIL_EVENT_CARDS개
    cards: HomeBoardEvent[]
    // 행사 목록 상태 칩과 같은 이름의 수: 기획 중(날짜 미정·예정), 진행 중, 후속 정리 중
    counts: { planning: number; ongoing: number; followUp: number }
  }
  // 재정 '행사 정산' 탭과 같은 행사·차례(끝난 지 오래된 것부터) HOME_LIST_LIMIT줄까지와 전체 수
  followUp: { events: HomeFollowUp[]; total: number }
  // 지금 기수에 학생회 직급도 열린 부서 소속도 없는 운영진 수(DEC-87)
  unassignedMembers: number
  // ① 확인이 필요한 운영 상황(f8)
  ops: HomeOps
  // ③ 내가 할 일(c35). followUp을 대신하며, followUp은 화면이 더 읽지 않으면 걷는다.
  todo: HomeTodo
  // ⑤ 이번 주(c35 안 b). 회장단 홈의 upcoming 쓰임을 대신한다.
  week: HomeWeek
  // ② 행사(e6). events를 대신하며, events는 화면이 더 읽지 않으면 걷는다.
  lanes: HomeEventLanes
}

export interface HomeResponse {
  // 한국 날짜(YYYY-MM-DD). 묶음은 이 날짜로 나눈 것이다.
  today: string
  kind: HomeKind
  // 회장단이면서 재정 역할 부서 소속이면 '운영 보기 / 재정 보기' 전환이 있다.
  financeView: boolean
  // 서버가 이 응답을 만든 시각(한국 YYYY-MM-DDTHH:mm, 읽기 거래 안에서 잡음). 끼룩이 기준 시각이고 저장하지 않는다.
  asOf: string
  myTasks: HomeMyTasks
  // 완료하지 않은 행사 가운데 진행 중 → 다가오는 순 → 날짜 미정, HOME_FEATURED_LIMIT개. 참여 여부와 관계없다.
  featuredEvents: EventSummary[]
  participating: HomeParticipating
  upcoming: HomeUpcoming
  myRequests: HomeMyRequests
  // 회장단 홈 종류에만 온다.
  councilBoard?: HomeCouncilBoard
  departmentBoard?: HomeDepartmentBoard
  // 회장단(재정 역할 없이도 읽음)의 한 줄과 재정부 카드. 겸직이면 둘 다 온다.
  financeSummary?: HomeFinanceSummary
  financeBoard?: HomeFinanceBoard
  // 아래는 지금 화면(기능 010)의 칸이다. 네 종류의 새 홈이 오르면 걷는다(기능 027 조각 10).
  mine: HomeMine
  // 부서 직급이 있고 학생회 직급이 없을 때만 온다(회장단은 council의 blocked로 본다).
  departments?: HomeDepartment[]
  // 학생회 직급이 있을 때만 온다.
  council?: HomeCouncil
  // 재정 역할 부서 소속일 때만 온다.
  received?: HomeReceived
  // 재정이고 학생회 직급이 없을 때만 온다(회장단은 council의 행사 카드에 있다).
  settling?: HomeSettling
}
