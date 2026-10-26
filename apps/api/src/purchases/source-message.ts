import { and, asc, eq, isNull } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { visibleMessage } from '../chat/messages.js'
import { chatRoom, evidenceLink, message, record, roomMembership } from '../db/schema.js'
import type { Db } from '../db/types.js'

// 요청을 읽을 수 있어도 원문방 권한을 물려받지 않는다. 현재 방 참여/들어온 시각/기수/학생회와
// 지운 원문을 다시 검사하고, 접근할 수 있을 때만 본문 없는 참조를 돌려준다.
export async function purchaseSourceMessage(
  db: Pick<Db, 'select'>,
  actor: Actor,
  requestId: string,
) {
  const [source] = await db
    .select({ id: message.id, roomId: message.roomId })
    .from(evidenceLink)
    .innerJoin(message, eq(message.id, evidenceLink.messageId))
    .innerJoin(record, eq(record.id, message.id))
    .innerJoin(chatRoom, eq(chatRoom.id, message.roomId))
    .innerJoin(
      roomMembership,
      and(eq(roomMembership.roomId, message.roomId), eq(roomMembership.memberId, actor.memberId)),
    )
    .where(
      and(eq(evidenceLink.recordId, requestId), visibleMessage(actor), isNull(message.deletedAt)),
    )
    .orderBy(asc(message.id))
    .limit(1)
  return source ?? null
}
