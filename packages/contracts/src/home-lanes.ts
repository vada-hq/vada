import type { EventColorKey } from './event-colors.js'
import type { HomeBoardEventRef } from './home.js'

// 회장단 홈 ② 행사(e6 가로 시간 축, 시연 조각 ㉰). 서버가 고르기·차례·신호를 정하고 화면은 그리기만 한다(DEC-38).

// 다음 일정의 갈래. 같은 시각이면 이 차례다.
export const HOME_EVENT_MILESTONES = [
  'registration_close',
  'registration_open',
  'event_start',
  'event_end',
] as const
export type HomeEventMilestone = (typeof HOME_EVENT_MILESTONES)[number]

export interface HomeEventLane {
  // status는 ongoing·upcoming·tbd만 온다. color는 서버가 정한 행사 색이다.
  event: HomeBoardEventRef & { color: EventColorKey }
  // 지금 뒤 가장 이른 날짜 하나. date는 한국 날짜, days는 오늘부터 남은 날(0 = 오늘). 없으면 null(일정 미정).
  milestone: { kind: HomeEventMilestone; date: string; days: number } | null
  // 받는 중·정원 참인 양식 가운데 마감이 가장 이른 것(취소하지 않은 신청 수). 아니면 null.
  registration: { formId: string; count: number; capacity: number | null; full: boolean } | null
  // 정하지 않은 것(지금은 장소만. 시각 미정은 일정 글 '일정 미정'이 말한다)
  undecided: 'place'[]
  // 지남이 있는 부서만, 지남 많은 순 → 이름순. department null = 학생회 업무(부서 없음).
  late: { department: { id: string; name: string } | null; overdue: number }[]
  // 회계 기간이 없으면 늘 null. 미정 = 지금 기간에 이 행사의 지출 예산 항목이 없음, 초과 = 사용 가능이 음수(amount는 넘친 금액).
  budget: { kind: 'undecided' } | { kind: 'over'; amount: number } | null
}

export interface HomeEventLanes {
  // 다음 일정이 가까운 순(일정 미정은 맨 뒤), HOME_COUNCIL_EVENT_CARDS개
  events: HomeEventLane[]
  // 끝나지 않은 행사 수(기획 중 + 진행 중)
  total: number
}
