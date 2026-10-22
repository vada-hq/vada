import {
  HOME_ENDED_LIMIT,
  HOME_EVENT_LIMIT,
  type HomeBlocked,
  type HomeCouncil,
  type HomeEventCard,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import type { Db } from '../db/types.js'
import { openEventsOf, taskCountsByEvent } from '../events/queries.js'
import { remainingOf } from '../settlement/remaining.js'
import { listOf, type OpenTask } from './open-tasks.js'

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

// 정산에 남은 것 수는 행사 '돈' 탭의 항목 수 합이다(같은 remainingOf). 끝났고 완료하지 않은 행사에만 센다.
async function settlementOf(db: Reader, actor: Actor, eventId: string) {
  const remaining = await remainingOf(db, { councilId: actor.councilId, eventId })
  return {
    remaining: remaining.reduce((sum, item) => sum + item.count, 0),
    settled: remaining.every(item => item.count === 0),
  }
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
      ...(item.status === 'ended' ? { settlement: await settlementOf(db, actor, item.id) } : {}),
    })
  }
  return {
    events: cards,
    truncated,
    endedTotal,
    blocked: blockedOf(open),
    overdue: listOf(open.filter(row => row.summary.overdue)),
  }
}
