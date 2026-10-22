import { and, eq } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { event, record } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'

type Reader = Pick<Db, 'select'>

// 기록이 이을 행사는 이 학생회의 행사여야 한다. 다른 학생회의 행사나 없는 행사는 409 EVENT_INVALID다.
// 완료 잠금 확인(assertEventsOpen)보다 먼저 부른다: 잠금 확인이 다른 학생회 행사의 완료 여부를 드러내지 않게.
export async function assertCouncilEvent(
  db: Reader,
  actor: Actor,
  eventId: string | null | undefined,
): Promise<void> {
  if (!eventId) return
  const [found] = await db
    .select({ id: event.id })
    .from(event)
    .innerJoin(record, eq(record.id, event.id))
    .where(and(eq(event.id, eventId), eq(record.councilId, actor.councilId)))
  if (!found) throw new ApiError('EVENT_INVALID')
}
