import { and, gte, lt, or, sql } from 'drizzle-orm'
import { koreanDateOf, type CalendarItem, type ScheduleType } from '@vada/contracts'
import type { Actor } from '../../access/actor.js'
import { scheduleItem } from '../../db/schema.js'
import type { Db } from '../../db/types.js'
import { scheduleRowsOf, scheduleWhenOf } from '../../schedule/queries.js'
import type { CalendarRange } from '../range.js'

export async function scheduleItems(
  db: Pick<Db, 'select'>,
  actor: Actor,
  range: CalendarRange,
  options: { memo?: boolean } = {},
): Promise<(CalendarItem & { memo?: string | null })[]> {
  const rows = await scheduleRowsOf(
    db,
    actor,
    or(
      and(
        lt(scheduleItem.startsOn, koreanDateOf(range.until)),
        gte(
          sql`coalesce(${scheduleItem.endsOn}, ${scheduleItem.startsOn})`,
          koreanDateOf(range.from),
        ),
      ),
      and(
        lt(scheduleItem.startsAt, range.until),
        // 왼쪽이 칸이 아니라 drizzle이 Date를 인코딩하지 않는다. 운영 드라이버는 Date를 받지 못해 글자로 넘긴다.
        gte(
          sql`coalesce(${scheduleItem.endsAt}, ${scheduleItem.startsAt})`,
          sql`${range.from.toISOString()}::timestamptz`,
        ),
      ),
    ),
  )
  return rows.map(row => ({
    key: `schedule_item:${row.item.id}`,
    source: 'schedule_item',
    kind: row.item.type as ScheduleType,
    title: row.item.title,
    ...scheduleWhenOf(row.item),
    place: row.item.place,
    event: row.event,
    department: row.department,
    mine: row.createdBy === actor.memberId,
    overdue: false,
    target: { record: 'schedule', id: row.item.id },
    ...(options.memo ? { memo: row.item.memo } : {}),
  }))
}
