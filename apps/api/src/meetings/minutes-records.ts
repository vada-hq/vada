import { and, asc, eq, sql } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { meetingAgendas, meetings, tasks } from '../db/schema.ts'
import { NotFound } from '../errors.ts'

export async function minutesRow(db: Db, orgId: string, meetingId: string) {
  const rows = await db
    .select({
      status: meetings.status,
      minutesStatus: meetings.minutesStatus,
      minutesSummary: meetings.minutesSummary,
    })
    .from(meetings)
    .where(and(eq(meetings.orgId, orgId), eq(meetings.id, meetingId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) throw new NotFound('그 회의를 찾지 못했습니다')
  return row
}

export async function linkedTaskCount(db: Db, orgId: string, meetingId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(tasks)
    .where(and(eq(tasks.orgId, orgId), eq(tasks.fromMeetingId, meetingId)))
  return Number(rows[0]?.total ?? 0)
}

export async function agendaRecordsOf(db: Db, orgId: string, meetingId: string) {
  return db
    .select({
      id: meetingAgendas.id,
      title: meetingAgendas.title,
      status: meetingAgendas.status,
      discussionText: meetingAgendas.discussionText,
      decisionText: meetingAgendas.decisionText,
      noDecision: meetingAgendas.noDecision,
      noFollowUp: meetingAgendas.noFollowUp,
    })
    .from(meetingAgendas)
    .where(and(eq(meetingAgendas.orgId, orgId), eq(meetingAgendas.meetingId, meetingId)))
    .orderBy(asc(meetingAgendas.sortOrder), asc(meetingAgendas.id))
}
