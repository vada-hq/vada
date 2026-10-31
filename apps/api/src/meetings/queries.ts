import { and, asc, eq, type SQL } from 'drizzle-orm'
import {
  MEETING_LIST_LIMIT,
  koreanOf,
  type MeetingDetail,
  type MeetingListQuery,
  type MeetingSummary,
  type MeetingsResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { currentMembersAmong } from '../chat/current-members.js'
import { department, event, meeting, meetingAttendee, member, record } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { versionOf } from '../records/versions.js'
import { memberNamesOf, joinedDisplayNameOf } from '../team/display-name.js'
import { aggregatesOf } from './aggregates.js'
import { minutesAgendaOf } from './minutes-query.js'
import { listWhere } from './list-query.js'
import { actionsOf, relationOf } from './policy.js'
import { assertReferences } from './references.js'
import { statusOf } from './status.js'

// 회의 목록·상세·홈(③ 회의록 줄, ⑤ 다음 회의)이 같은 읽기를 쓴다.
export function meetingRowsOf(tx: Pick<Db, 'select'>, actor: Actor, where?: SQL) {
  return tx
    .select({
      meeting,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      confirmedAt: record.confirmedAt,
      confirmedBy: record.confirmedBy,
      event: { id: event.id, name: event.name },
      hostDepartment: { id: department.id, name: department.name },
      ...aggregatesOf(actor.memberId),
    })
    .from(meeting)
    .innerJoin(record, eq(record.id, meeting.id))
    .leftJoin(event, eq(event.id, meeting.eventId))
    .leftJoin(department, eq(department.id, meeting.hostDepartmentId))
    .where(and(eq(record.councilId, actor.councilId), where))
}
type Row = Awaited<ReturnType<typeof meetingRowsOf>>[number]
export const factsOf = (row: Row) => ({
  hostDepartmentId: row.meeting.hostDepartmentId,
  createdBy: row.createdBy,
  isAttendee: row.isAttendee,
  cancelledAt: row.meeting.cancelledAt,
  confirmedAt: row.confirmedAt,
  hasTasks: row.hasTasks,
})

function summaryOf(actor: Actor, row: Row, now: Date): MeetingSummary {
  const facts = factsOf(row)
  return {
    id: row.meeting.id,
    title: row.meeting.title,
    heldAt: koreanOf(row.meeting.heldAt),
    endsAt: row.meeting.endsAt ? koreanOf(row.meeting.endsAt) : null,
    place: row.meeting.place,
    event: row.event,
    hostDepartment: row.hostDepartment,
    status: statusOf({ ...row.meeting, confirmedAt: row.confirmedAt }, now),
    relation: relationOf(actor, facts),
    attendeeCount: row.attendeeCount,
    agendaCount: row.agendaCount,
    minutesStatus: row.confirmedAt ? 'confirmed' : row.hasNotes ? 'draft' : 'none',
    actions: actionsOf(actor, facts),
  }
}

export async function meetingListOf(
  tx: Tx,
  actor: Actor,
  query: MeetingListQuery,
  now: Date,
): Promise<MeetingsResponse> {
  if (query.event)
    await assertReferences(tx, actor, { eventId: query.event, hostDepartmentId: null })
  const rows = await meetingRowsOf(tx, actor, listWhere(actor, query))
    .orderBy(asc(meeting.heldAt), asc(meeting.id))
    .limit(MEETING_LIST_LIMIT + 1)
  return {
    meetings: rows.slice(0, MEETING_LIST_LIMIT).map(row => summaryOf(actor, row, now)),
    truncated: rows.length > MEETING_LIST_LIMIT,
  }
}

export async function meetingRowOf(tx: Tx, actor: Actor, id: string) {
  const [row] = await meetingRowsOf(tx, actor, eq(meeting.id, id))
  if (!row) throw new ApiError('NOT_FOUND')
  return row
}

async function attendeesOf(tx: Tx, actor: Actor, id: string, now: Date) {
  const rows = await tx
    .select({ id: member.id, name: joinedDisplayNameOf(member, actor.councilId) })
    .from(meetingAttendee)
    .innerJoin(member, eq(member.id, meetingAttendee.memberId))
    .where(eq(meetingAttendee.meetingId, id))
    .orderBy(asc(member.id))
  const current = await currentMembersAmong(
    tx,
    actor.councilId,
    rows.map(row => row.id),
    now,
  )
  return rows.map(row => ({ ...row, current: current.has(row.id) }))
}

export async function meetingDetailOf(
  tx: Tx,
  actor: Actor,
  id: string,
  now: Date,
): Promise<MeetingDetail> {
  const row = await meetingRowOf(tx, actor, id)
  const ids = [row.createdBy, row.confirmedBy].filter((id): id is string => id !== null)
  const names = await memberNamesOf(tx, actor.councilId, ids)
  const current = await currentMembersAmong(tx, actor.councilId, ids, now)
  return {
    ...summaryOf(actor, row, now),
    purpose: row.meeting.purpose,
    versionNo: await versionOf(tx, id),
    createdBy: row.createdBy
      ? { id: row.createdBy, name: names.get(row.createdBy)!, current: current.has(row.createdBy) }
      : null,
    createdAt: row.createdAt.toISOString(),
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    confirmedBy: row.confirmedBy
      ? {
          id: row.confirmedBy,
          name: names.get(row.confirmedBy)!,
          current: current.has(row.confirmedBy),
        }
      : null,
    cancelledAt: row.meeting.cancelledAt?.toISOString() ?? null,
    cancelReason: row.meeting.cancelReason,
    attendees: await attendeesOf(tx, actor, id, now),
    agenda: await minutesAgendaOf(tx, actor, id, now),
  }
}
