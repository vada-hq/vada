import { HOME_LIST_LIMIT, type HomeFinanceSummary } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { currentOverviewOf } from '../budget/overview.js'
import type { Db } from '../db/types.js'
import { allOpenEventsOf } from '../events/queries.js'

// 금액·행사별 합은 재정 첫 화면이 계산한 값 그대로다. 홈에서 다시 더하지 않는다(DEC-92·95).
export async function financeBudgetOf(db: Pick<Db, 'select'>, actor: Actor, now: Date) {
  const open = await allOpenEventsOf(db, actor, now)
  const overview = await currentOverviewOf(db, actor, now, open)
  const entered = overview?.events ?? []
  // 기간이 없으면 지출 예산 항목도 없으니 완료 전 행사가 모두 미입력이다.
  const missing = overview?.missingEvents ?? open.map(({ id, name }) => ({ id, name }))
  const totals =
    overview === null
      ? null
      : {
          total: overview.total,
          actual: overview.actual,
          committed: overview.committed,
          available: overview.available,
        }
  const summary: HomeFinanceSummary = { overview: totals, missing }
  const events = [
    ...entered.map(budget => ({ event: budget.event, budget })),
    ...missing.map(event => ({ event, budget: null })),
  ]
  return {
    summary,
    budgets: { events: events.slice(0, HOME_LIST_LIMIT), total: events.length },
    open,
    // 지금 기간에 지출 예산 항목이 있는 행사 모두(상한 없음). 회장단 홈 ②의 예산 초과 신호가 쓴다.
    entered,
  }
}
