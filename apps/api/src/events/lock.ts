import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { events } from '../db/schema.js'
import { ApiError } from '../http/errors.js'

type Reader = Pick<PgDatabase<PgQueryResultHKT>, 'select'>

// 완료한 행사(M5a)는 기록을 바꾸지 않는다. 행사 기록을 바꾸는 쓰기는 거래 맨 앞에서 아래 함수로 행사 행을 잠그고 완료를 본다.
// FOR SHARE끼리는 서로 기다리지 않고, 완료·완료 취소(FOR NO KEY UPDATE)와는 하나씩 진행된다. 나중에 잠근 쓰기는 완료를 보고 멈춘다.
// 다른 학생회의 행사는 없는 것으로 본다.
export async function shareEvent(tx: Reader, organizationId: string, eventId: string) {
  const [event] = await tx.select({ completedAt: events.completedAt }).from(events)
    .where(and(eq(events.organizationId, organizationId), eq(events.id, eventId))).for('share')
  if (!event) throw new ApiError('NOT_FOUND', 404)
  return event
}
// 여러 행사는 ID 순서로 잠근다.
export async function requireActiveEvents(tx: Reader, organizationId: string, eventIds: string[]) {
  for (const id of [...new Set(eventIds)].sort()) {
    if ((await shareEvent(tx, organizationId, id)).completedAt) throw new ApiError('EVENT_COMPLETED', 409)
  }
}
// 행사 행을 바꾸거나, 행사 행을 잠근 채 세고 더하는 쓰기가 쓴다(FOR NO KEY UPDATE).
// 같은 거래에서 FOR SHARE를 먼저 잡고 올리면 교착이 날 수 있어 처음부터 이것으로 잠근다.
export async function lockActiveEvent(tx: Reader, organizationId: string, eventId: string) {
  const [event] = await tx.select().from(events)
    .where(and(eq(events.organizationId, organizationId), eq(events.id, eventId))).for('no key update')
  if (!event) throw new ApiError('NOT_FOUND', 404)
  if (event.completedAt) throw new ApiError('EVENT_COMPLETED', 409)
  return event
}
// 잠그지 않고 미리 본다. 끼룩이·배송 조회처럼 비싼 바깥 호출 전에 쓴다. 저장 거래에서 위 함수로 다시 본다.
export async function checkActiveEvents(db: Reader, organizationId: string, eventIds: string[]) {
  if (!eventIds.length) return
  const [completed] = await db.select({ id: events.id }).from(events)
    .where(and(eq(events.organizationId, organizationId), inArray(events.id, eventIds), isNotNull(events.completedAt))).limit(1)
  if (completed) throw new ApiError('EVENT_COMPLETED', 409)
}
