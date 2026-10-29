import { and, eq, gte, isNull, lt, or } from 'drizzle-orm'
import { koreanOf, type CalendarItem } from '@vada/contracts'
import type { Actor } from '../../access/actor.js'
import { department, event, meeting, record } from '../../db/schema.js'
import type { Db } from '../../db/types.js'
import { aggregatesOf } from '../../meetings/aggregates.js'
import { relationOf } from '../../meetings/policy.js'
import type { CalendarRange } from '../range.js'

// 회의 읽기는 회의 목록과 같이 학생회 운영진 전체다(DEC-104 ⑤). 취소한 회의는 뺀다(DEC-102).
// 내 회의는 회의 화면의 내 관계(참가자·다루는 사람)와 같다.
export async function meetingItems(
  db: Pick<Db, 'select'>,
  actor: Actor,
  range: CalendarRange,
): Promise<CalendarItem[]> {
  const rows = await db
    .select({
      id: meeting.id,
      title: meeting.title,
      heldAt: meeting.heldAt,
      endsAt: meeting.endsAt,
      place: meeting.place,
      hostDepartmentId: meeting.hostDepartmentId,
      createdBy: record.createdBy,
      isAttendee: aggregatesOf(actor.memberId).isAttendee,
      event: { id: event.id, name: event.name },
      department: { id: department.id, name: department.name },
    })
    .from(meeting)
    .innerJoin(record, eq(record.id, meeting.id))
    .leftJoin(event, eq(event.id, meeting.eventId))
    .leftJoin(department, eq(department.id, meeting.hostDepartmentId))
    .where(
      and(
        eq(record.councilId, actor.councilId),
        isNull(meeting.cancelledAt),
        lt(meeting.heldAt, range.until),
        or(
          gte(meeting.endsAt, range.from),
          and(isNull(meeting.endsAt), gte(meeting.heldAt, range.from)),
        ),
      ),
    )
  return rows.map(row => ({
    key: `meeting:${row.id}`,
    source: 'meeting',
    kind: 'meeting',
    title: row.title,
    allDay: false,
    start: koreanOf(row.heldAt),
    end: row.endsAt ? koreanOf(row.endsAt) : null,
    place: row.place,
    event: row.event,
    department: row.department,
    mine: relationOf(actor, row) !== 'none',
    overdue: false,
    target: { record: 'meetings', id: row.id },
  }))
}
