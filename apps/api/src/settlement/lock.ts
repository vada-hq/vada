import { and, eq } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { eventFinances, events } from '../db/schema.js'
import { ApiError } from '../http/errors.js'

type Reader = Pick<PgDatabase<PgQueryResultHKT>, 'select'>

// 정산된 행사의 지출·증빙 삭제·구매 제출을 막는다. 상시 운영(null)은 정산이 없어 건너뛴다.
// 행사 행을 FOR SHARE로 잠근다. 정산·다시 열기·예산은 같은 행을 FOR NO KEY UPDATE로 잠그므로 정산 확인과 겹치지 않는다.
// 여러 행사는 ID 순서로 잠근다. 다른 학생회의 행사는 없는 것으로 본다.
export async function requireOpenEvents(tx: Reader, organizationId: string, eventIds: (string | null)[]) {
  const ids = [...new Set(eventIds.filter((id): id is string => id !== null))].sort()
  for (const id of ids) {
    const [event] = await tx.select({ id: events.id }).from(events)
      .where(and(eq(events.organizationId, organizationId), eq(events.id, id))).for('share')
    if (!event) throw new ApiError('NOT_FOUND', 404)
    const [finance] = await tx.select({ settledAt: eventFinances.settledAt }).from(eventFinances)
      .where(and(eq(eventFinances.organizationId, organizationId), eq(eventFinances.eventId, id)))
    if (finance?.settledAt) throw new ApiError('EVENT_SETTLED', 409)
  }
}
