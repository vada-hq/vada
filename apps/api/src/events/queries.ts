import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import {
  EVENT_LIST_LIMIT,
  koreanOf,
  type EventDetail,
  type EventSummary,
  type EventsResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { currentMembersAmong } from '../chat/current-members.js'
import { event, member, record, task } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { completedEventIdsAmong, completionApprovalsOf } from './completion.js'
import { eventHeaderOf } from './header.js'
import { eventHistoryOf } from './history.js'
import { actionsOf, blockersOf, factsOf } from './policy.js'
import { eventStatusOf } from './status.js'
import { displayNameOf } from '../team/display-name.js'

type Reader = Pick<Db, 'select'>

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
      ownerName: displayNameOf(member, record.councilId),
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

// 진행 중 → 예정(시작이 가까운 순) → 날짜 미정(만든 순) → 끝남(최근에 끝난 순).
const listOrder = (now: Date) => {
  const group = groupSql(now)
  return [
    group,
    sql`case when ${group} < 2 then ${event.startsAt} end asc`,
    sql`case when ${group} = 2 then ${record.createdAt} end asc`,
    sql`case when ${group} = 3 then ${endsAtSql} end desc`,
    event.id,
  ]
}

// 한 개 더 읽어 넘쳤는지 안다.
export async function eventListOf(db: Reader, actor: Actor, now: Date): Promise<EventsResponse> {
  const rows = await eventSelect(db)
    .where(eq(record.councilId, actor.councilId))
    .orderBy(...listOrder(now))
    .limit(EVENT_LIST_LIMIT + 1)
  return {
    events: await summariesOf(db, actor, rows.slice(0, EVENT_LIST_LIMIT), now),
    truncated: rows.length > EVENT_LIST_LIMIT,
  }
}

// 끝났고 완료하지 않은 행사(정산이 남은 것). 끝난 지 오래된 것부터 limit개까지 주고 전체 수를 따로 준다.
async function endedOpenRows(db: Reader, actor: Actor, now: Date, limit: number) {
  const ended = await eventSelect(db)
    .where(and(openScope(actor), sql`${groupSql(now)} = 3`))
    .orderBy(sql`${endsAtSql} asc`, event.id)
  return { rows: ended.slice(0, limit), total: ended.length }
}

const openScope = (actor: Actor) =>
  and(eq(record.councilId, actor.councilId), sql`not ${completedSql}`)

// 홈의 정산할 행사: 위와 같은 행사를 요약으로 준다.
export async function endedOpenEventsOf(db: Reader, actor: Actor, now: Date, limit: number) {
  const { rows, total } = await endedOpenRows(db, actor, now, limit)
  return { events: await summariesOf(db, actor, rows, now), total }
}

// 행사 끝 날짜(end-day.ts의 eventEndDayOf와 같다: 끝 시각, 없으면 시작 시각). 한국 날짜 범위는 [from, until) 순간으로 받는다.
const endDaySql = sql`coalesce(${event.endsAt}, ${event.startsAt})`
const instant = (value: Date) => sql`${value.toISOString()}::timestamptz`

// 재정 '행사 정산' 탭의 끝났고 완료하지 않은 것 밖의 행사(끝나지 않은 것과 완료한 것), 목록과 같은 차례.
// 기간이 있으면 결산 점검(closing/pending.ts)과 같은 기준으로 거른다: 완료하지 않은 행사는 끝 날짜가 기간 끝일 이하이거나 날짜 미정,
// 완료한 행사는 끝 날짜가 기간 안이다. 기간이 없으면 거르지 않는다. 한 개 더 읽어 넘쳤는지 안다.
export async function periodEventsOf(
  db: Reader,
  actor: Actor,
  now: Date,
  options: { range: { from: Date; until: Date } | null; limit: number },
) {
  const { range, limit } = options
  const open = and(
    sql`${groupSql(now)} < 3`,
    range ? or(isNull(event.startsAt), sql`${endDaySql} < ${instant(range.until)}`) : undefined,
  )
  const done = and(
    completedSql,
    range
      ? sql`${endDaySql} >= ${instant(range.from)} and ${endDaySql} < ${instant(range.until)}`
      : undefined,
  )
  const rows = await eventSelect(db)
    .where(and(eq(record.councilId, actor.councilId), or(open, done)))
    .orderBy(...listOrder(now))
    .limit(limit + 1)
  return {
    events: await summariesOf(db, actor, rows.slice(0, limit), now),
    truncated: rows.length > limit,
  }
}

// 홈의 행사 카드: 완료하지 않은 행사. 끝난 행사(정산이 남은 것)는 끝난 지 오래된 것부터 endedLimit개까지만 주고 전체 수를 따로 준다.
// 진행 중 → 예정(시작 순) → 날짜 미정(만든 순)은 그 뒤에 남은 자리(전체 limit개)까지다. 한 개 더 읽어 넘쳤는지 안다.
export async function openEventsOf(
  db: Reader,
  actor: Actor,
  now: Date,
  limits: { limit: number; endedLimit: number },
): Promise<EventsResponse & { endedTotal: number }> {
  const group = groupSql(now)
  const scope = openScope(actor)
  const { rows: shown, total: endedTotal } = await endedOpenRows(db, actor, now, limits.endedLimit)
  const rest = limits.limit - shown.length
  const others = await eventSelect(db)
    .where(and(scope, sql`${group} < 3`))
    .orderBy(
      group,
      sql`case when ${group} < 2 then ${event.startsAt} end asc`,
      sql`case when ${group} = 2 then ${record.createdAt} end asc`,
      event.id,
    )
    .limit(rest + 1)
  return {
    events: await summariesOf(db, actor, [...shown, ...others.slice(0, rest)], now),
    truncated: others.length > rest || endedTotal > shown.length,
    endedTotal,
  }
}

// 행사 여럿의 지우지 않은 업무 수(끝나지 않은 것, 전체). 행사 상세와 홈이 같이 쓴다.
export async function taskCountsByEvent(db: Reader, eventIds: string[]) {
  const counts = new Map<string, { open: number; total: number }>()
  if (!eventIds.length) return counts
  const rows = await db
    .select({
      eventId: task.eventId,
      total: sql<number>`count(*)`.mapWith(Number),
      open: sql<number>`count(*) filter (where ${task.status} <> 'done')`.mapWith(Number),
    })
    .from(task)
    .where(and(inArray(task.eventId, eventIds), isNull(task.cancelledAt)))
    .groupBy(task.eventId)
  for (const row of rows)
    if (row.eventId) counts.set(row.eventId, { open: row.open, total: row.total })
  return counts
}

// 행사 하나와 머리의 셈(header.ts), 그 사람이 할 수 있는 동작(events/policy.ts). 동작은 쓰기의 거절과 같은 판정이다.
export async function eventDetailOf(
  db: Reader,
  actor: Actor,
  eventId: string,
  now: Date,
): Promise<EventDetail> {
  const row = await eventRowOf(db, actor, eventId)
  const [summary] = await summariesOf(db, actor, [row], now)
  const facts = await factsOf(db, actor, row, { now })
  return {
    ...summary!,
    tasks: (await taskCountsByEvent(db, [eventId])).get(eventId) ?? { open: 0, total: 0 },
    ...(await eventHeaderOf(db, actor, row, { status: summary!.status, now })),
    history: await eventHistoryOf(db, eventId),
    approvals: await completionApprovalsOf(db, eventId),
    actions: actionsOf(actor, facts),
    blockers: blockersOf(actor, facts),
  }
}
