import { and, eq, gte, lt, type SQL } from 'drizzle-orm'
import { koreanOf, type CalendarItem } from '@vada/contracts'
import type { Actor } from '../../access/actor.js'
import { event, record, registrationForm } from '../../db/schema.js'
import type { Db } from '../../db/types.js'
import type { CalendarRange } from '../range.js'

// 신청자 자료는 읽지 않는다. 홈과 캘린더가 양식·행사 이름과 마감만 공유한다(DEC-59).
export function registrationCloseRowsOf(
  db: Pick<Db, 'select'>,
  councilId: string,
  condition: SQL | undefined,
) {
  return db
    .select({
      id: registrationForm.id,
      name: registrationForm.name,
      closesAt: registrationForm.closesAt,
      eventId: event.id,
      eventName: event.name,
      ownerId: event.ownerId,
    })
    .from(registrationForm)
    .innerJoin(event, eq(event.id, registrationForm.eventId))
    .innerJoin(record, eq(record.id, registrationForm.id))
    .where(and(eq(record.councilId, councilId), condition))
}

export async function registrationCloseItems(
  db: Pick<Db, 'select'>,
  actor: Actor,
  range: CalendarRange,
): Promise<CalendarItem[]> {
  const rows = await registrationCloseRowsOf(
    db,
    actor.councilId,
    and(gte(registrationForm.closesAt, range.from), lt(registrationForm.closesAt, range.until)),
  )
  return rows.map(row => ({
    key: `registration_close:${row.id}`,
    source: 'registration_close',
    kind: 'deadline',
    title: row.name,
    allDay: false,
    start: koreanOf(row.closesAt),
    end: null,
    place: null,
    event: { id: row.eventId, name: row.eventName },
    department: null,
    mine: row.ownerId === actor.memberId,
    overdue: false,
    target: { record: 'events', id: row.eventId, tab: 'registrations' },
  }))
}
