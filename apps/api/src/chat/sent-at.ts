import { eq, sql } from 'drizzle-orm'
import { chatRoom, message } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { clockNow } from '../records/records.js'

// 방 행을 잠가 같은 방의 글쓰기를 줄 세운 뒤의 보낸 시각(SQL 식). 사람의 보내기와 끼룩이 글이 같이 쓴다.
// 보낸 시각은 잠근 뒤에 DB 시계로 정하고 방의 가장 늦은 메시지보다 뒤로 둬서, 커서와 읽음이 기대는
// "보낸 시각 순서 = 커밋 순서"가 같은 방에서 틀리지 않게 한다. 들어온 시각(DEC-20)과 같은 시계다.
export async function lockedSentAt(tx: Tx, roomId: string) {
  await tx
    .select({ id: chatRoom.id })
    .from(chatRoom)
    .where(eq(chatRoom.id, roomId))
    .for('no key update')
  return sql`greatest(${clockNow}, coalesce((select max(${message.sentAt}) from ${message}
    where ${message.roomId} = ${roomId}::uuid), '-infinity'::timestamptz) + interval '1 microsecond')`
}
