import { and, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm'
import { DAY_MS, dateFromKorean, type MeetingListQuery } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can, headDepartmentIds } from '../access/permissions.js'
import { meeting, record } from '../db/schema.js'

function mineWhere(actor: Actor) {
  const departments = headDepartmentIds(actor)
  const managesAll = can(actor, 'meeting.manage')
  return and(
    isNull(meeting.cancelledAt),
    isNull(record.confirmedAt),
    managesAll
      ? undefined
      : or(
          eq(record.createdBy, actor.memberId),
          departments.length ? inArray(meeting.hostDepartmentId, departments) : undefined,
          sql`exists(select 1 from meeting_attendee ma where ma.meeting_id = ${meeting.id} and ma.member_id = ${actor.memberId}::uuid)`,
        ),
  )
}

export function listWhere(actor: Actor, query: MeetingListQuery) {
  const from = query.from ? dateFromKorean(`${query.from}T00:00`) : null
  const to = query.to ? new Date(dateFromKorean(`${query.to}T00:00`).getTime() + DAY_MS) : null
  return and(
    eq(record.councilId, actor.councilId),
    query.view === 'mine' ? mineWhere(actor) : undefined,
    query.event ? eq(meeting.eventId, query.event) : undefined,
    from ? gte(meeting.heldAt, from) : undefined,
    to ? lt(meeting.heldAt, to) : undefined,
  )
}
