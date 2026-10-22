import { and, eq, isNull, sql } from 'drizzle-orm'
import {
  EVENT_ACTIONS,
  EVENT_LIST_LIMIT,
  koreanOf,
  type EventAction,
  type EventDetail,
  type EventSummary,
  type EventsResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { currentMembersAmong } from '../chat/current-members.js'
import { event, member, record, task } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { completedEventIdsAmong, completionApprovalsOf } from './completion.js'
import { eventHistoryOf } from './history.js'
import { eventStatusOf } from './status.js'

type Reader = Pick<Db, 'select'>

const LOCKED_ACTIONS: ReadonlySet<EventAction> = new Set(['event.update', 'event.set_owner'])

// 끝나는 때와 목록 묶음의 SQL. status.ts의 eventEndOf, eventStatusOf와 같은 규칙이다(끝이 없으면 시작한 날 한국 23:59:59).
const endsAtSql = sql`coalesce(${event.endsAt}, (date_trunc('day', ${event.startsAt} at time zone 'Asia/Seoul') + interval '1 day') at time zone 'Asia/Seoul' - interval '1 second')`
// 마지막 결재(완료, 완료 취소)가 완료인 행사. completion.ts의 completedEventIdsAmong과 같은 규칙이다.
const completedSql = sql`exists (select 1 from approval done
  where done.target_id = ${event.id} and done.target_kind = 'event' and done.outcome = 'completed'
  and not exists (select 1 from approval later
    where later.target_id = done.target_id and later.target_kind = 'event'
    and later.outcome in ('completed', 'completion_cancelled')
    and (later.acted_at, later.id) > (done.acted_at, done.id)))`
// 0 진행 중, 1 예정, 2 날짜 미정, 3 끝남(완료한 행사도 끝남 자리)
const groupSql = (now: Date) => sql`(case
  when ${completedSql} then 3
  when ${event.startsAt} is null then 2
  when date_trunc('second', ${now.toISOString()}::timestamptz) > ${endsAtSql} then 3
  when ${now.toISOString()}::timestamptz < ${event.startsAt} then 1
  else 0 end)`

function eventSelect(db: Reader) {
  return db
    .select({
      id: event.id,
      name: event.name,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      place: event.place,
      ownerId: event.ownerId,
      ownerName: member.name,
    })
    .from(event)
    .innerJoin(record, eq(record.id, event.id))
    .leftJoin(member, eq(member.id, event.ownerId))
}

type Row = Awaited<ReturnType<ReturnType<typeof eventSelect>['where']>>[number]

// 이 학생회의 행사 하나. 다른 학생회 행사는 없는 것과 같아 404다.
export async function eventRowOf(db: Reader, actor: Actor, eventId: string) {
  const [row] = await eventSelect(db).where(
    and(eq(record.councilId, actor.councilId), eq(event.id, eventId)),
  )
  if (!row) throw new ApiError('NOT_FOUND')
  return row
}

// 책임자가 지금 이 학생회의 운영진인가. 떠난 책임자는 남기고 '떠난 사람'으로 보인다.
async function summariesOf(
  db: Reader,
  actor: Actor,
  rows: Row[],
  now: Date,
): Promise<EventSummary[]> {
  const ownerIds = [...new Set(rows.flatMap(row => (row.ownerId ? [row.ownerId] : [])))]
  const current = await currentMembersAmong(db, actor.councilId, ownerIds, now)
  const completed = await completedEventIdsAmong(
    db,
    rows.map(row => row.id),
  )
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    startsAt: row.startsAt ? koreanOf(row.startsAt) : null,
    endsAt: row.endsAt ? koreanOf(row.endsAt) : null,
    place: row.place,
    owner:
      row.ownerId && row.ownerName
        ? { id: row.ownerId, name: row.ownerName, current: current.has(row.ownerId) }
        : null,
    status: eventStatusOf(row.startsAt, row.endsAt, now, completed.has(row.id)),
  }))
}

// 진행 중 → 예정(시작이 가까운 순) → 날짜 미정(만든 순) → 끝남(최근에 끝난 순). 한 개 더 읽어 넘쳤는지 안다.
export async function eventListOf(db: Reader, actor: Actor, now: Date): Promise<EventsResponse> {
  const group = groupSql(now)
  const rows = await eventSelect(db)
    .where(eq(record.councilId, actor.councilId))
    .orderBy(
      group,
      sql`case when ${group} < 2 then ${event.startsAt} end asc`,
      sql`case when ${group} = 2 then ${record.createdAt} end asc`,
      sql`case when ${group} = 3 then ${endsAtSql} end desc`,
      event.id,
    )
    .limit(EVENT_LIST_LIMIT + 1)
  return {
    events: await summariesOf(db, actor, rows.slice(0, EVENT_LIST_LIMIT), now),
    truncated: rows.length > EVENT_LIST_LIMIT,
  }
}

async function taskCountsOf(db: Reader, eventId: string) {
  const [counts] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      open: sql<number>`count(*) filter (where ${task.status} <> 'done')`.mapWith(Number),
    })
    .from(task)
    .where(and(eq(task.eventId, eventId), isNull(task.cancelledAt)))
  return { open: counts?.open ?? 0, total: counts?.total ?? 0 }
}

// 행사 하나와 그 사람이 할 수 있는 동작. 동작은 책임자가 나일 때만 맞는 기준이라 책임자를 맥락으로 묻는다.
export async function eventDetailOf(
  db: Reader,
  actor: Actor,
  eventId: string,
  now: Date,
): Promise<EventDetail> {
  const row = await eventRowOf(db, actor, eventId)
  const [summary] = await summariesOf(db, actor, [row], now)
  const context = row.ownerId ? { eventOwnerId: row.ownerId } : {}
  return {
    ...summary!,
    tasks: await taskCountsOf(db, eventId),
    history: await eventHistoryOf(db, eventId),
    approvals: await completionApprovalsOf(db, eventId),
    // 완료한 행사는 고치기와 책임자 바꾸기가 잠긴다(완료 취소로 다시 열린다).
    actions: EVENT_ACTIONS.filter(
      action =>
        can(actor, action, context) &&
        !(LOCKED_ACTIONS.has(action) && summary!.status === 'completed'),
    ),
  }
}
