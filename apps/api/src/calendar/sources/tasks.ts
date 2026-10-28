import { and, eq, gte, isNull, lt, ne } from 'drizzle-orm'
import { koreanDateOf, type CalendarItem } from '@vada/contracts'
import type { Actor } from '../../access/actor.js'
import { department, event, record, task } from '../../db/schema.js'
import type { Db } from '../../db/types.js'
import { isOverdue } from '../../tasks/due.js'
import type { CalendarRange } from '../range.js'

export async function taskDueItems(
  db: Pick<Db, 'select'>,
  actor: Actor,
  range: CalendarRange,
  now: Date,
): Promise<CalendarItem[]> {
  const rows = await db
    .select({
      id: task.id,
      title: task.title,
      dueAt: task.dueAt,
      assigneeId: task.assigneeId,
      event: { id: event.id, name: event.name },
      department: { id: department.id, name: department.name },
    })
    .from(task)
    .innerJoin(record, eq(record.id, task.id))
    .leftJoin(event, eq(event.id, task.eventId))
    .leftJoin(department, eq(department.id, task.departmentId))
    .where(
      and(
        eq(record.councilId, actor.councilId),
        isNull(task.cancelledAt),
        ne(task.status, 'done'),
        gte(task.dueAt, range.from),
        lt(task.dueAt, range.until),
      ),
    )
  return rows.flatMap(row =>
    row.dueAt
      ? [
          {
            key: `task_due:${row.id}`,
            source: 'task_due' as const,
            kind: 'deadline' as const,
            title: row.title,
            allDay: true,
            start: koreanDateOf(row.dueAt),
            end: null,
            place: null,
            event: row.event,
            department: row.department,
            mine: row.assigneeId === actor.memberId,
            overdue: isOverdue(row.dueAt, 'todo', now),
            target: { record: 'tasks' as const, id: row.id },
          },
        ]
      : [],
  )
}
