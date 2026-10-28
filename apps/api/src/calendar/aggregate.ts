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
import { scheduleItems } from './sources/schedule.js'

const CALENDAR_FEED_ITEM_LIMIT = 1000

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
  options: { now: Date; feed?: boolean },
): Promise<CalendarResponse> {
  const { now, feed = false } = options
  // 같은 읽기 거래에서 차례로 읽어 원본의 시점이 어긋나지 않는다.
  const items = [
    ...(await eventItems(db, actor, range)),
    ...(await taskDueItems(db, actor, range, now)),
    ...(await registrationCloseItems(db, actor, range)),
    ...(await purchaseNeededItems(db, actor, range, now)),
    ...(await scheduleItems(db, actor, range, { memo: feed })),
  ]
    .filter(
      item =>
        !feed || (item.source !== 'task_due' && item.source !== 'purchase_needed_by') || item.mine,
    )
    .sort(byWhen)
  const limit = feed ? CALENDAR_FEED_ITEM_LIMIT : CALENDAR_ITEM_LIMIT
  return {
    items: items.slice(0, limit),
    truncated: items.length > limit,
  }
}
