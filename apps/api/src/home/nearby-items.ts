import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import {
  HOME_LIST_LIMIT,
  HOME_NEEDED_DAYS,
  DAY_MS,
  koreanDateOf,
  type HomeNearbyItem,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { event, lineItem, record, request } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { lastOutcomeOf } from '../purchases/last-outcome.js'
import { isPaid } from '../purchases/queries.js'

const requestRecord = alias(record, 'nearby_request_record')

// 결제 일부라도 있으면 준비 목록에서 뺀다. 결제 취소 여부도 요청 상세와 같은 isPaid로 판단한다(DEC-95).
export async function nearbyItemsOf(db: Pick<Db, 'select'>, actor: Actor, now: Date) {
  const until = koreanDateOf(new Date(now.getTime() + HOME_NEEDED_DAYS * DAY_MS))
  const rows = await db
    .select({
      id: lineItem.id,
      name: lineItem.name,
      requestId: request.id,
      neededBy: request.neededBy,
      eventId: event.id,
      eventName: event.name,
    })
    .from(lineItem)
    .innerJoin(request, eq(request.id, lineItem.requestId))
    .innerJoin(record, eq(record.id, lineItem.id))
    .innerJoin(requestRecord, eq(requestRecord.id, request.id))
    .leftJoin(event, eq(event.id, request.eventId))
    .where(
      and(
        eq(record.councilId, actor.councilId),
        eq(requestRecord.councilId, actor.councilId),
        isNull(request.cancelledAt),
        sql`${lastOutcomeOf(lineItem.id)} = 'approved'`,
        sql`not ${isPaid}`,
        sql`${request.neededBy} <= ${until}`,
      ),
    )
    .orderBy(asc(request.neededBy), asc(requestRecord.createdAt), asc(request.id), asc(lineItem.id))
  const items: HomeNearbyItem[] = rows.slice(0, HOME_LIST_LIMIT).map(row => ({
    id: row.id,
    name: row.name,
    requestId: row.requestId,
    neededBy: row.neededBy!,
    event: row.eventId && row.eventName ? { id: row.eventId, name: row.eventName } : null,
  }))
  return { items, total: rows.length }
}
