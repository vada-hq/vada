import { and, count, eq, isNull, notExists } from 'drizzle-orm'
import {
  HOME_ENDED_LIMIT,
  HOME_EVENT_LIMIT,
  type HomeBlocked,
  type HomeCouncil,
  type HomeEventCard,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { councilMembership, departmentMembership } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { openEventsOf, taskCountsByEvent } from '../events/queries.js'
import type { OpenTask } from '../tasks/open-tasks.js'
import { listOf } from './open-tasks.js'
import { settlementSummaryOf } from '../settlement/settling.js'

type Reader = Pick<Db, 'select'>

const LAST = '￿'

// 지남이나 담당자 없음이 있는 부서와 '부서 없음'(null). 부서 이름 차례, 부서 없음이 마지막이다.
function blockedOf(open: OpenTask[]): HomeBlocked[] {
  const groups = new Map<string, HomeBlocked>()
  for (const item of open) {
    const dept = item.summary.department
    const key = dept?.id ?? ''
    const group = groups.get(key) ?? { department: dept, overdue: 0, unassigned: 0 }
    if (item.summary.overdue) group.overdue++
    if (item.unassigned) group.unassigned++
    groups.set(key, group)
  }
  return [...groups.values()]
    .filter(group => group.overdue > 0 || group.unassigned > 0)
    .sort((a, b) => (a.department?.name ?? LAST).localeCompare(b.department?.name ?? LAST))
}

// 미배정 운영진(DEC-87): 이 학생회 지금 기수의 끝나지 않은 학생회 소속이 있고, 학생회 직급이 없고, 그 기수에 열린 부서 소속이 없다.
// 기수(actor.cohortId)가 학생회를 가른다. 다른 학생회에서 부서가 있는 사람도 이 기수에 부서가 없으면 센다.
export async function unassignedMembersOf(db: Reader, actor: Actor): Promise<number> {
  const placed = db
    .select({ id: departmentMembership.id })
    .from(departmentMembership)
    .where(
      and(
        eq(departmentMembership.memberId, councilMembership.memberId),
        eq(departmentMembership.cohortId, actor.cohortId),
        isNull(departmentMembership.endsAt),
      ),
    )
  const [row] = await db
    .select({ total: count() })
    .from(councilMembership)
    .where(
      and(
        eq(councilMembership.cohortId, actor.cohortId),
        isNull(councilMembership.endsAt),
        isNull(councilMembership.councilRank),
        notExists(placed),
      ),
    )
  return row?.total ?? 0
}

export async function councilOf(
  db: Reader,
  actor: Actor,
  now: Date,
  open: OpenTask[],
): Promise<HomeCouncil> {
  const { events, truncated, endedTotal } = await openEventsOf(db, actor, now, {
    limit: HOME_EVENT_LIMIT,
    endedLimit: HOME_ENDED_LIMIT,
  })
  const totals = await taskCountsByEvent(
    db,
    events.map(item => item.id),
  )
  const cards: HomeEventCard[] = []
  for (const item of events) {
    const mine = open.filter(row => row.summary.event?.id === item.id)
    const total = totals.get(item.id)
    cards.push({
      event: item,
      tasks: {
        done: (total?.total ?? 0) - (total?.open ?? 0),
        total: total?.total ?? 0,
        overdue: mine.filter(row => row.summary.overdue).length,
        unassigned: mine.filter(row => row.unassigned).length,
      },
      ...(item.status === 'ended'
        ? { settlement: await settlementSummaryOf(db, actor, item) }
        : {}),
    })
  }
  return {
    events: cards,
    truncated,
    endedTotal,
    blocked: blockedOf(open),
    overdue: listOf(open.filter(row => row.summary.overdue)),
    unassignedMembers: await unassignedMembersOf(db, actor),
  }
}
