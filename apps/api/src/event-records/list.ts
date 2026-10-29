import { and, eq, inArray, max } from 'drizzle-orm'
import { EVENT_LIST_LIMIT, type RecordEventItem, type RecordEventsResponse } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { approval, event, record } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { completedEventIdsAmong } from '../events/completion.js'
import { eventRowsAmong, summariesOf, taskCountsByEvent } from '../events/queries.js'
import {
  departmentsByEvent,
  moneyByEvent,
  percentOf,
  registrationCountsByEvent,
  type RecordScope,
} from './counts.js'

type Reader = Pick<Db, 'select'>

// 완료한 행사의 완료 처리 시각: 마지막 완료 결재의 시각. 완료한 행사의 마지막 결재는 완료이므로 완료 결재 시각의 가장 늦은 것이다.
async function completedAtByEvent(db: Reader, eventIds: string[]) {
  if (!eventIds.length) return new Map<string, Date>()
  const rows = await db
    .select({ id: approval.targetId, at: max(approval.actedAt) })
    .from(approval)
    .where(
      and(
        eq(approval.targetKind, 'event'),
        inArray(approval.targetId, eventIds),
        eq(approval.outcome, 'completed'),
      ),
    )
    .groupBy(approval.targetId)
  return new Map(rows.flatMap(row => (row.at ? [[row.id, row.at] as const] : [])))
}

// 이 학생회의 완료한 행사(완료 판단은 completedEventIdsAmong 한 곳), 완료 처리가 최근인 것부터.
async function completedOrderOf(db: Reader, actor: Actor) {
  const all = await db
    .select({ id: event.id })
    .from(event)
    .innerJoin(record, eq(record.id, event.id))
    .where(eq(record.councilId, actor.councilId))
  const completed = [
    ...(await completedEventIdsAmong(
      db,
      all.map(row => row.id),
    )),
  ]
  const at = await completedAtByEvent(db, completed)
  const time = (id: string) => at.get(id)?.getTime() ?? 0
  return {
    ids: completed.sort((a, b) => time(b) - time(a) || a.localeCompare(b)),
    at,
  }
}

async function chipsOf(db: Reader, scope: RecordScope) {
  const registrations = await registrationCountsByEvent(db, scope)
  const money = await moneyByEvent(db, scope)
  const tasks = await taskCountsByEvent(db, scope.eventIds)
  return (id: string): RecordEventItem['chips'] => {
    const counts = registrations.get(id) ?? { total: 0, cancelled: 0, attended: 0 }
    const { budget, actual } = money.get(id) ?? { budget: 0, actual: 0 }
    const task = tasks.get(id) ?? { open: 0, total: 0 }
    return {
      attended: counts.attended,
      applied: counts.total - counts.cancelled,
      budget,
      actual,
      executionRate: percentOf(actual, budget),
      tasksDone: task.total - task.open,
    }
  }
}

// 기록 메뉴의 완료한 행사 목록(REC-01). 카드의 셈은 행사 여럿에 한 번씩 묶어 센다. 한 개라도 넘치면 truncated다.
export async function eventRecordListOf(
  db: Reader,
  actor: Actor,
  now: Date,
): Promise<RecordEventsResponse> {
  const order = await completedOrderOf(db, actor)
  const ids = order.ids.slice(0, EVENT_LIST_LIMIT)
  const truncated = order.ids.length > EVENT_LIST_LIMIT
  if (!ids.length) return { events: [], truncated }
  const summaries = new Map(
    (await summariesOf(db, actor, await eventRowsAmong(db, actor, ids), now)).map(item => [
      item.id,
      item,
    ]),
  )
  const scope = { councilId: actor.councilId, eventIds: ids }
  const chips = await chipsOf(db, scope)
  const departments = await departmentsByEvent(db, scope)
  const events = ids.map((id): RecordEventItem => {
    const { name, startsAt, endsAt, owner } = summaries.get(id)!
    return {
      id,
      name,
      startsAt,
      endsAt,
      owner,
      departments: departments.get(id) ?? [],
      completedAt: order.at.get(id)!.toISOString(),
      chips: chips(id),
    }
  })
  return { events, truncated }
}
