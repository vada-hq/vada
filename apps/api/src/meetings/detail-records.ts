import { and, asc, eq, sql } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import {
  departments,
  documents,
  events,
  meetingAgendas,
  meetingParticipants,
  meetings,
  members,
} from '../db/schema.ts'
import { NotFound } from '../errors.ts'

export async function meetingOf(db: Db, orgId: string, meetingId: string) {
  const rows = await db
    .select({ id: meetings.id, status: meetings.status, creatorMemberId: meetings.creatorMemberId })
    .from(meetings)
    .where(and(eq(meetings.orgId, orgId), eq(meetings.id, meetingId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('그 회의를 찾지 못했습니다')
  return row
}

export async function participantsOf(db: Db, orgId: string, meetingId: string) {
  return db
    .select({
      memberId: meetingParticipants.memberId,
      isHost: meetingParticipants.isHost,
      attendance: meetingParticipants.attendance,
      name: members.name,
      department: departments.name,
    })
    .from(meetingParticipants)
    .innerJoin(members, and(eq(meetingParticipants.memberId, members.id), eq(members.orgId, orgId)))
    .leftJoin(
      departments,
      and(eq(members.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .where(
      and(eq(meetingParticipants.orgId, orgId), eq(meetingParticipants.meetingId, meetingId)),
    )
}

export async function agendasOf(db: Db, orgId: string, meetingId: string) {
  return db
    .select({
      id: meetingAgendas.id,
      title: meetingAgendas.title,
      description: meetingAgendas.description,
      plannedMinutes: meetingAgendas.plannedMinutes,
      status: meetingAgendas.status,
      discussionText: meetingAgendas.discussionText,
      decisionText: meetingAgendas.decisionText,
    })
    .from(meetingAgendas)
    .where(and(eq(meetingAgendas.orgId, orgId), eq(meetingAgendas.meetingId, meetingId)))
    .orderBy(asc(meetingAgendas.sortOrder), asc(meetingAgendas.id))
}

export async function materialCount(db: Db, orgId: string, meetingId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(documents)
    .where(and(eq(documents.orgId, orgId), eq(documents.meetingId, meetingId)))
  return Number(rows[0]?.total ?? 0)
}

export async function meetingDetailRow(db: Db, orgId: string, meetingId: string) {
  const rows = await db
    .select({
      id: meetings.id,
      kind: meetings.kind,
      eventId: meetings.eventId,
      title: meetings.title,
      purpose: meetings.purpose,
      status: meetings.status,
      minutesStatus: meetings.minutesStatus,
      scheduledAt: meetings.scheduledAt,
      plannedEndAt: meetings.plannedEndAt,
      place: meetings.place,
      creatorMemberId: meetings.creatorMemberId,
      startedAt: meetings.startedAt,
      endedAt: meetings.endedAt,
      updatedAt: meetings.updatedAt,
      cancelReason: meetings.cancelReason,
      cancelledByMemberId: meetings.cancelledByMemberId,
      cancelledAt: meetings.cancelledAt,
      creatorName: members.name,
      creatorDepartment: departments.name,
      eventTitle: events.title,
    })
    .from(meetings)
    .leftJoin(members, and(eq(meetings.creatorMemberId, members.id), eq(members.orgId, orgId)))
    .leftJoin(
      departments,
      and(eq(members.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .leftJoin(events, and(eq(meetings.eventId, events.id), eq(events.orgId, orgId)))
    .where(and(eq(meetings.orgId, orgId), eq(meetings.id, meetingId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('그 회의를 찾지 못했습니다')
  return row
}

export async function cancellerNote(
  db: Db,
  orgId: string,
  memberId: string,
): Promise<string | null> {
  const rows = await db
    .select({ name: members.name, department: departments.name })
    .from(members)
    .leftJoin(
      departments,
      and(eq(members.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .where(and(eq(members.orgId, orgId), eq(members.id, memberId)))
    .limit(1)
  const row = rows[0]
  return row === undefined ? null : personNote(row.name, row.department)
}

export function personNote(name: string | null, department: string | null): string | null {
  if (name === null) return null
  return department === null || department.trim() === '' ? name : `${name} · ${department}`
}
