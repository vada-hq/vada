import type { Db } from '../db/client.ts'
import { daysBetween } from '../time.ts'
import {
  LABEL,
  shortDay,
  sinceSunday,
  type Schedule,
  type ScheduleType,
} from './calendar-domain.ts'
import { orgSchedules } from './calendar-schedules.ts'

export interface CalendarWeekRow {
  id: string
  typeLabel: string
  typeTone: string
  dateLabel: string
  title: string
  actionLabel?: string
  eventId?: string
}

/** 그 줄에서 열 수 있는 것. **행사에 딸리지 않은 줄에는 오지 않는다**(명세가 그렇게 적었다). */
const OPEN_EVENT_SCHEDULE = '행사 일정 보기'

/**
 * 이번 주에 걸린 일정 줄(`ops.calendarWeek`).
 *
 * **보고 있는 달과 무관하다** — '이번 주'는 오늘이 정한다.
 */
export async function opsCalendarWeek(
  db: Db,
  orgId: string,
  type: ScheduleType | null,
  now: Date,
): Promise<CalendarWeekRow[]> {
  const schedules = await orgSchedules(db, orgId, type)
  return schedules.filter((one) => inThisWeek(one.at, now)).map(weekRow)
}

/** 그 날짜가 이번 주에 드는가. 시각이 아니라 **날짜**로 센다. */
export function inThisWeek(at: Date, now: Date): boolean {
  const start = -sinceSunday(now)
  const days = daysBetween(now, at)
  return days >= start && days <= start + 6
}

function weekRow(one: Schedule): CalendarWeekRow {
  return {
    id: one.id,
    typeLabel: LABEL.get(one.type) ?? one.type,
    typeTone: one.type,
    dateLabel: shortDay(one.at),
    title: one.title,
    // **함께 오거나 함께 오지 않는다**(명세가 그렇게 적었다).
    ...(one.eventId === null
      ? {}
      : { actionLabel: OPEN_EVENT_SCHEDULE, eventId: one.eventId }),
  }
}
