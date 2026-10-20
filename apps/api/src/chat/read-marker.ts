import { and, eq, sql } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { message, roomMembership } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { sinceJoined } from './messages.js'
import { roomAccess } from './room-access.js'

// 이 메시지까지 읽었다고 남긴다. 읽음은 뒤로 가지 않는다(오래된 메시지로 다시 보내도 그대로).
// 볼 수 없는 메시지(들어오기 전, 다른 방, 없는 것)는 404다. 시각은 DB 안에서 옮겨 마이크로초가 깎이지 않게 한다.
export async function markRead(tx: Tx, actor: Actor, roomId: string, messageId: string) {
  await roomAccess(tx, actor, roomId)
  const [visible] = await tx
    .select({ id: message.id })
    .from(message)
    .where(and(eq(message.id, messageId), eq(message.roomId, roomId), sinceJoined(actor.memberId)))
  if (!visible) throw new ApiError('NOT_FOUND')
  await advanceRead(tx, roomId, actor.memberId, messageId)
}

// 내 읽음을 그 메시지의 시각까지 옮긴다. 읽음은 뒤로 가지 않는다. 내가 보낸 메시지에도 같이 쓴다.
export async function advanceRead(tx: Tx, roomId: string, memberId: string, messageId: string) {
  await tx
    .update(roomMembership)
    .set({
      lastReadAt: sql`greatest(coalesce(${roomMembership.lastReadAt}, '-infinity'::timestamptz),
        (select ${message.sentAt} from ${message} where ${message.id} = ${messageId}::uuid))`,
    })
    .where(and(eq(roomMembership.roomId, roomId), eq(roomMembership.memberId, memberId)))
}
