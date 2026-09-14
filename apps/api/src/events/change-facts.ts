import { and, eq, ne } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { documents, meetings, tasks } from '../db/schema.ts'

export interface Touched {
  at: Date
  createdAt: Date
  title: string
}

export async function touchedOf(db: Db, orgId: string, eventId: string): Promise<Touched[]> {
  const [taskRows, documentRows, meetingRows] = await Promise.all([
    db
      .select({ at: tasks.updatedAt, createdAt: tasks.createdAt, title: tasks.title })
      .from(tasks)
      .where(and(eq(tasks.orgId, orgId), eq(tasks.eventId, eventId))),
    db
      .select({ at: documents.updatedAt, createdAt: documents.createdAt, title: documents.title })
      .from(documents)
      .where(and(eq(documents.orgId, orgId), eq(documents.eventId, eventId))),
    db
      .select({ at: meetings.updatedAt, createdAt: meetings.createdAt, title: meetings.title })
      .from(meetings)
      .where(
        and(
          eq(meetings.orgId, orgId),
          eq(meetings.eventId, eventId),
          ne(meetings.status, 'draft'),
        ),
      ),
  ])
  return [
    ...taskRows.map((row) => ({ ...row, title: label('업무', row) })),
    ...documentRows.map((row) => ({ ...row, title: label('문서', row) })),
    ...meetingRows.map((row) => ({ ...row, title: label('회의', row) })),
  ]
}

function label(kind: string, row: { at: Date; createdAt: Date; title: string }): string {
  return `${kind} ${row.at.getTime() === row.createdAt.getTime() ? '추가' : '수정'} · ${row.title}`
}
