import { eq } from 'drizzle-orm'
import { HOME_LIST_LIMIT, type HomeFinanceSummary } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { financeOverviewOf } from '../budget/overview.js'
import { event, record } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { openEventsAmong } from '../events/queries.js'

// 금액·행사별 합은 재정 첫 화면이 계산한 값 그대로다. 홈에서 다시 더하지 않는다(DEC-92·95).
export async function financeBudgetOf(db: Pick<Db, 'select'>, actor: Actor, now: Date) {
  const { overview } = await financeOverviewOf(db, actor, now)
  const rows = await db
    .select({ id: event.id })
    .from(event)
    .innerJoin(record, eq(record.id, event.id))
    .where(eq(record.councilId, actor.councilId))
  const open = await openEventsAmong(
    db,
    actor,
    now,
    rows.map(row => row.id),
  )
  const entered = overview?.events ?? []
  const missing = open
    .filter(row => !entered.some(item => item.event.id === row.id))
    .map(({ id, name }) => ({ id, name }))
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
  }
}
