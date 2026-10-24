import type { Context } from '../access/permissions.js'
import { eventDepartmentIdsOf } from '../access/event-departments.js'
import type { Actor } from '../access/actor.js'
import type { Db } from '../db/types.js'

// 신청 칸이 묻는 맥락: 그 행사의 책임자와 담당 부서들. 양식 하나의 읽기와 쓰기가 같은 맥락을 쓴다(보이는 동작과 되는 동작이 어긋나지 않게).
export async function registrationContextOf(
  db: Pick<Db, 'select'>,
  actor: Actor,
  event: { id: string; ownerId: string | null },
): Promise<Context> {
  return {
    eventDepartmentIds: await eventDepartmentIdsOf(db, actor.councilId, event.id),
    ...(event.ownerId ? { eventOwnerId: event.ownerId } : {}),
  }
}
