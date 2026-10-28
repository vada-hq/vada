import {
  CALENDAR_ITEM_LIMIT,
  CALENDAR_KINDS,
  KOREAN_DATE_LENGTH,
  type CalendarItem,
  type CalendarResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import type { Db } from '../db/types.js'
import type { CalendarRange } from './range.js'
import { eventItems } from './sources/events.js'
import { purchaseNeededItems } from './sources/purchases.js'
import { registrationCloseItems } from './sources/registrations.js'
import { taskDueItems } from './sources/tasks.js'

const byWhen = (a: CalendarItem, b: CalendarItem) =>
  a.start.slice(0, KOREAN_DATE_LENGTH).localeCompare(b.start.slice(0, KOREAN_DATE_LENGTH)) ||
  Number(b.allDay) - Number(a.allDay) ||
  a.start.localeCompare(b.start) ||
  CALENDAR_KINDS.indexOf(a.kind) - CALENDAR_KINDS.indexOf(b.kind) ||
  a.key.localeCompare(b.key)

export async function calendarOf(
  db: Pick<Db, 'select'>,
  actor: Actor,
  range: CalendarRange,
  now: Date,
): Promise<CalendarResponse> {
  // 같은 읽기 거래에서 차례로 읽어 네 원본의 시점이 어긋나지 않는다.
  const items = [
    ...(await eventItems(db, actor, range)),
    ...(await taskDueItems(db, actor, range, now)),
    ...(await registrationCloseItems(db, actor, range)),
    ...(await purchaseNeededItems(db, actor, range, now)),
  ].sort(byWhen)
  return {
    items: items.slice(0, CALENDAR_ITEM_LIMIT),
    truncated: items.length > CALENDAR_ITEM_LIMIT,
  }
}
