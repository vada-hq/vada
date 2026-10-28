import { and, eq, gte, isNull, lt, or, type SQL } from 'drizzle-orm'
import { koreanOf, type CalendarItem } from '@vada/contracts'
import type { Actor } from '../../access/actor.js'
import { event, record } from '../../db/schema.js'
import type { Db } from '../../db/types.js'
import type { CalendarRange } from '../range.js'

// 홈은 시작이 범위 안인 행사, 캘린더는 기간이 겹치는 행사다. 학생회 경계와 바탕 읽기는 공유한다.
export function eventRowsOf(db: Pick<Db, 'select'>, councilId: string, condition: SQL | undefined) {
  return db
    .select({
      id: event.id,
      name: event.name,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      place: event.place,
      ownerId: event.ownerId,
    })
    .from(event)
    .innerJoin(record, eq(record.id, event.id))
    .where(and(eq(record.councilId, councilId), condition))
}

export async function eventItems(
  db: Pick<Db, 'select'>,
  actor: Actor,
  range: CalendarRange,
): Promise<CalendarItem[]> {
  const rows = await eventRowsOf(
    db,
    actor.councilId,
    and(
      lt(event.startsAt, range.until),
      or(gte(event.endsAt, range.from), and(isNull(event.endsAt), gte(event.startsAt, range.from))),
    ),
  )
  return rows.flatMap(row =>
    row.startsAt
      ? [
          {
            key: `event:${row.id}`,
            source: 'event' as const,
            kind: 'event' as const,
            title: row.name,
            allDay: false,
            start: koreanOf(row.startsAt),
            end: row.endsAt ? koreanOf(row.endsAt) : null,
            place: row.place,
            event: null,
            department: null,
            mine: row.ownerId === actor.memberId,
            overdue: false,
            target: { record: 'events' as const, id: row.id, tab: 'overview' as const },
          },
        ]
      : [],
  )
}
