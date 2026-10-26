import { and, desc, eq, isNull, sql, type SQL } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { chatRoom, message, record, roomMembership } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { visibleInRoom, visibleMessage } from './messages.js'
import { roomAccess } from './room-access.js'

// 이 메시지까지 읽었다고 남긴다. 읽음은 뒤로 가지 않는다(오래된 메시지로 다시 보내도 그대로).
// 볼 수 없는 메시지(들어오기 전, 다른 기수, 다른 방, 없는 것)는 404다. 시각은 DB 안에서 옮겨 마이크로초가 깎이지 않게 한다.
export async function markRead(tx: Tx, actor: Actor, roomId: string, messageId: string) {
  await roomAccess(tx, actor, roomId)
  if (!(await visibleInRoom(tx, actor, roomId, messageId))) throw new ApiError('NOT_FOUND')
  // 방 흐름에는 원글만 있어 화면은 마지막 원글로 읽음을 보낸다. 그것이 방의 가장 최근 원글이면 방을 끝까지 본 것이라
  // 그 뒤 답글까지 읽은 것으로 둔다(방 단위 읽음, 022 정한 것 32). 볼 수 없는 답글은 읽음을 앞당기지 않는다.
  const lastOriginal = await latestVisible(tx, actor, roomId, isNull(message.replyToId))
  const target =
    lastOriginal === messageId
      ? ((await latestVisible(tx, actor, roomId, undefined)) ?? messageId)
      : messageId
  await advanceRead(tx, roomId, actor.memberId, target)
}

// 이 방에서 내가 볼 수 있는 가장 최근 메시지(보낸 시각, 번호 차례). extra로 원글만 고른다.
async function latestVisible(tx: Tx, actor: Actor, roomId: string, extra: SQL | undefined) {
  const [found] = await tx
    .select({ id: message.id })
    .from(message)
    .innerJoin(record, eq(record.id, message.id))
    .innerJoin(chatRoom, eq(chatRoom.id, message.roomId))
    .where(and(eq(message.roomId, roomId), visibleMessage(actor), extra))
    .orderBy(desc(message.sentAt), desc(message.id))
    .limit(1)
  return found?.id
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
