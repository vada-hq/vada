import { and, eq, ne, sql } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, documents, meetings, members, tasks } from '../db/schema.ts'

export interface OpenTask {
  id: string
  title: string
  status: string
  dueDate: Date | null
  department: string | null
  assignee: string | null
}

export async function openTasksOf(db: Db, orgId: string, eventId: string): Promise<OpenTask[]> {
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      dueDate: tasks.dueDate,
      department: departments.name,
      assignee: members.name,
    })
    .from(tasks)
    .leftJoin(departments, and(eq(tasks.departmentId, departments.id), eq(departments.orgId, orgId)))
    .leftJoin(members, and(eq(tasks.assigneeMemberId, members.id), eq(members.orgId, orgId)))
    .where(and(eq(tasks.orgId, orgId), eq(tasks.eventId, eventId), ne(tasks.status, 'done')))
  return rows.sort((left, right) => orderKey(left).localeCompare(orderKey(right)))
}

function orderKey(row: { dueDate: Date | null; title: string }): string {
  return `${row.dueDate === null ? '9' : '0'}${row.dueDate?.toISOString() ?? ''}${row.title}`
}

export async function unorganizedDocumentCount(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<number> {
  const rows = await db
    .select({ left: sql<number>`count(*)::int` })
    .from(documents)
    .where(
      and(
        eq(documents.orgId, orgId),
        eq(documents.eventId, eventId),
        ne(documents.status, 'confirmed'),
      ),
    )
  return Number(rows[0]?.left ?? 0)
}

export async function unwrittenMinutesCount(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<number> {
  const rows = await db
    .select({ left: sql<number>`count(*)::int` })
    .from(meetings)
    .where(
      and(
        eq(meetings.orgId, orgId),
        eq(meetings.eventId, eventId),
        ne(meetings.minutesStatus, 'done'),
        sql`${meetings.status} not in ('draft', 'cancelled')`,
      ),
    )
  return Number(rows[0]?.left ?? 0)
}

export interface MeetingMoment {
  title: string
  scheduledAt: Date | null
  owner: string | null
}

export async function meetingMomentsOf(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<MeetingMoment[]> {
  return db
    .select({
      title: meetings.title,
      scheduledAt: meetings.scheduledAt,
      owner: members.name,
    })
    .from(meetings)
    .leftJoin(members, and(eq(meetings.creatorMemberId, members.id), eq(members.orgId, orgId)))
    .where(
      and(
        eq(meetings.orgId, orgId),
        eq(meetings.eventId, eventId),
        ne(meetings.status, 'draft'),
      ),
    )
}
