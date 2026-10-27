import type { HomeAttention, HomeFollowUp, HomeMyRequests } from './home.js'

export const HOME_CONGESTION_TASKS = 3

// 오늘부터 HOME_SOON_DAYS째까지 현재 직급 부서에 맡긴 열린 업무. 순위·점수는 싣지 않는다(DEC-95).
export interface HomeCongestion {
  member: { id: string; name: string }
  departmentIds: string[]
  count: number
  firstDue: string
  lastDue: string
}

// 부서장·부부장 HOME-01D. 재정부 겸직은 기존 재정부 홈을 쓴다.
export interface HomeDepartmentBoard {
  departments: { id: string; name: string }[]
  purchases: HomeMyRequests
  // 내가 책임자인 끝난 행사 전부. 업무의 세 줄 상한과 별개다.
  ownedEnded: HomeFollowUp[]
  attention: { items: HomeAttention[]; total: number }
  congestion: HomeCongestion | null
}
