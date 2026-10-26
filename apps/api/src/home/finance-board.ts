import {
  HOME_LIST_LIMIT,
  dateFromKorean,
  type HomeFinanceBoard,
  type HomeReceived,
  type HomeSettling,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { headDepartmentIds } from '../access/permissions.js'
import type { Db } from '../db/types.js'
import { endedDaysOf } from '../events/header.js'
import { settlingOf, withSettlements } from '../settlement/settling.js'
import type { OpenTask } from '../tasks/open-tasks.js'
import { departmentsOf } from './departments.js'
import type { financeBudgetOf } from './finance-budget.js'
import { nearbyItemsOf } from './nearby-items.js'
import { followUpRowsOf } from './follow-up.js'

type Budget = Awaited<ReturnType<typeof financeBudgetOf>>
type Input = {
  pending: HomeReceived
  budget: Budget
  open: OpenTask[]
  settling: HomeSettling | undefined
}

export async function financeBoardOf(
  db: Pick<Db, 'select'>,
  actor: Actor,
  now: Date,
  input: Input,
): Promise<HomeFinanceBoard> {
  const heads = headDepartmentIds(actor)
  const departments = await departmentsOf(db, actor, heads, input.open)
  const owned = heads.length
    ? input.budget.open.filter(row => row.status === 'ended' && row.owner?.id === actor.memberId)
    : []
  const ownedEnded = await followUpRowsOf(db, await withSettlements(db, actor, owned), now)
  const settling = input.settling ?? (await settlingOf(db, actor, now, HOME_LIST_LIMIT))
  return {
    pending: input.pending,
    nearby: await nearbyItemsOf(db, actor, now),
    settling: {
      ...settling,
      events: settling.events.map(row => ({
        ...row,
        endedDays: endedDaysOf(
          {
            startsAt: row.event.startsAt ? dateFromKorean(row.event.startsAt) : null,
            endsAt: row.event.endsAt ? dateFromKorean(row.event.endsAt) : null,
          },
          now,
        ),
      })),
    },
    budgets: input.budget.budgets,
    departments: departments
      .filter(row => row.counts.overdue || row.counts.unassigned)
      .map(row => ({
        id: row.id,
        name: row.name,
        overdue: row.counts.overdue,
        unassigned: row.counts.unassigned,
      })),
    ownedEnded,
  }
}
