import { and, eq } from 'drizzle-orm'
import { HOME_LIST_LIMIT, type HomeAttention, type HomeDepartmentBoard } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { headDepartmentIds } from '../access/permissions.js'
import { event, record } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { openEventsAmong } from '../events/queries.js'
import { withSettlements } from '../settlement/settling.js'
import type { OpenTask } from '../tasks/open-tasks.js'
import { departmentsOf } from './departments.js'
import { congestionOf } from './department-congestion.js'
import { departmentMembersOf } from './department-members.js'
import { departmentPurchasesOf } from './department-purchases.js'
import { followUpRowsOf } from './follow-up.js'

async function ownedEndedOf(db: Pick<Db, 'select'>, actor: Actor, now: Date) {
  const rows = await db
    .select({ id: event.id })
    .from(event)
    .innerJoin(record, eq(record.id, event.id))
    .where(and(eq(record.councilId, actor.councilId), eq(event.ownerId, actor.memberId)))
  const events = (
    await openEventsAmong(
      db,
      actor,
      now,
      rows.map(row => row.id),
    )
  ).filter(row => row.status === 'ended')
  return followUpRowsOf(db, await withSettlements(db, actor, events), now)
}

export async function departmentBoardOf(
  db: Pick<Db, 'select'>,
  actor: Actor,
  now: Date,
  open: OpenTask[],
): Promise<HomeDepartmentBoard> {
  const ids = headDepartmentIds(actor)
  const departments = await departmentsOf(db, actor, ids, open)
  const scoped = open.filter(
    row => row.summary.department && ids.includes(row.summary.department.id),
  )
  const items: HomeAttention[] = [
    ...scoped
      .filter(row => row.summary.overdue)
      .map(row => ({ task: row.summary, reason: 'overdue' as const })),
    ...scoped
      .filter(row => row.unassigned && !row.summary.overdue)
      .map(row => ({ task: row.summary, reason: 'unassigned' as const })),
  ]
  return {
    departments: departments.map(({ id, name }) => ({ id, name })),
    purchases: await departmentPurchasesOf(db, actor),
    ownedEnded: await ownedEndedOf(db, actor, now),
    attention: { items: items.slice(0, HOME_LIST_LIMIT), total: items.length },
    congestion: congestionOf(scoped, await departmentMembersOf(db, actor), now),
  }
}
