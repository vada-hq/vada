import { and, eq } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { chatRoom, record, roomMembership } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'

type Reader = Pick<Db, 'select'>

// 들어온 시각은 돌려주지 않는다. Date로 옮기면 마이크로초가 깎여 DEC-20 경계가 어긋나므로 조회가 참여 줄과 직접 비교한다.
// 방 하나를 여는 문. 이 학생회의 방이 아니면 404, 방 참여자가 아니면 403이다(회장단도 물려받지 않는다, PRIN-5).
// 다른 학생회의 방은 있는지조차 드러내지 않아 없는 방과 같은 답이다.
export async function roomAccess(db: Reader, actor: Actor, roomId: string) {
  const [room] = await db
    .select({
      id: chatRoom.id,
      type: chatRoom.type,
      departmentId: chatRoom.departmentId,
      eventId: chatRoom.eventId,
    })
    .from(chatRoom)
    .innerJoin(record, eq(record.id, chatRoom.id))
    .where(and(eq(chatRoom.id, roomId), eq(record.councilId, actor.councilId)))
  if (!room) throw new ApiError('NOT_FOUND')
  const [membership] = await db
    .select({ memberId: roomMembership.memberId })
    .from(roomMembership)
    .where(and(eq(roomMembership.roomId, roomId), eq(roomMembership.memberId, actor.memberId)))
  if (!can(actor, 'chat.use', { inRoom: membership !== undefined })) throw new ApiError('FORBIDDEN')
  return room
}
