import { and, eq, gte, isNull, lt } from 'drizzle-orm'
import { koreanDateOf, type CalendarItem } from '@vada/contracts'
import type { Actor } from '../../access/actor.js'
import { event, record, request } from '../../db/schema.js'
import type { Db } from '../../db/types.js'
import { requestStagesOf } from '../../purchases/stage.js'
import type { CalendarRange } from '../range.js'

export async function purchaseNeededItems(
  db: Pick<Db, 'select'>,
  actor: Actor,
  range: CalendarRange,
  now: Date,
): Promise<CalendarItem[]> {
  const rows = await db
    .select({
      id: request.id,
      title: request.title,
      neededBy: request.neededBy,
      requestedBy: request.requestedBy,
      event: { id: event.id, name: event.name },
    })
    .from(request)
    .innerJoin(record, eq(record.id, request.id))
    .leftJoin(event, eq(event.id, request.eventId))
    .where(
      and(
        eq(record.councilId, actor.councilId),
        isNull(request.cancelledAt),
        gte(request.neededBy, koreanDateOf(range.from)),
        lt(request.neededBy, koreanDateOf(range.until)),
      ),
    )
  const requestIds = rows.map(row => row.id)
  const stages = await requestStagesOf(db, requestIds)
  const today = koreanDateOf(now)
  return rows.flatMap(row =>
    row.neededBy && stages.get(row.id) === 'in_progress'
      ? [
          {
            key: `purchase_needed_by:${row.id}`,
            source: 'purchase_needed_by' as const,
            kind: 'deadline' as const,
            title: row.title,
            allDay: true,
            start: row.neededBy,
            end: null,
            place: null,
            event: row.event,
            department: null,
            mine: row.requestedBy === actor.memberId,
            overdue: row.neededBy < today,
            target: { record: 'purchases' as const, id: row.id },
          },
        ]
      : [],
  )
}
