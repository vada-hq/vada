import type { EventRef } from './budget.js'
import type { FinanceOverview, FinanceOverviewEvent } from './finance-overview.js'
import type { HomeFollowUp, HomeReceived, HomeSettling } from './home.js'

export const HOME_NEEDED_DAYS = 14

// 재정 첫 화면의 셈을 그대로 싣는다. 기간이 없으면 0을 만들지 않고 null이다.
export interface HomeFinanceSummary {
  overview: Pick<FinanceOverview, 'total' | 'actual' | 'committed' | 'available'> | null
  // 완료 전 행사 가운데 지금 기간의 지출 예산 항목이 없는 것. 상한 없이 세어 요약에도 쓴다.
  missing: EventRef[]
}

export interface HomeNearbyItem {
  id: string
  name: string
  requestId: string
  event: EventRef | null
  neededBy: string
}

export interface HomeFinanceBoard {
  pending: HomeReceived
  nearby: { items: HomeNearbyItem[]; total: number }
  settling: {
    events: (HomeSettling['events'][number] & { endedDays: number | null })[]
    total: number
  }
  budgets: {
    events: { event: EventRef; budget: FinanceOverviewEvent | null }[]
    total: number
  }
  // 부서 직급이 있는 재정부원에게만 온다. 확인할 일이 없는 부서는 없다.
  departments: { id: string; name: string; overdue: number; unassigned: number }[]
  // 부서 직급이 있는 사람이 책임자인 완료 전의 끝난 행사.
  ownedEnded: HomeFollowUp[]
}
