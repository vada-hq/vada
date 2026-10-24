import { and, eq } from 'drizzle-orm'
import type { ChatMessage } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { chatRoom, message, record } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { updateRecord } from '../records/records.js'
import { messageOf, visibleMessage } from './messages.js'
import { inNoticeRoom } from './plan-room.js'

// 전체방 메시지에 공지 표시를 붙이거나 뗀다(DEC-14). 학생회 행을 잠근 거래 안에서 부른다.
// 이 학생회 전체방의 메시지이고 내가 볼 수 있는(들어온 뒤의 것이거나 보이는 같은 기수의 공지) 것이어야 한다. 아니면 부서방·회장단방·다른 학생회·없는 메시지 모두 404다.
// 같은 값이면 판을 늘리지 않는다. 바꾼 사람은 판에 남는다.
export async function markNotice(
  tx: Tx,
  actor: Actor,
  messageId: string,
  isNotice: boolean,
): Promise<ChatMessage> {
  const [found] = await tx
    .select({ isNotice: message.isNotice })
    .from(message)
    .innerJoin(record, eq(record.id, message.id))
    .innerJoin(chatRoom, eq(chatRoom.id, message.roomId))
    .where(
      and(
        eq(message.id, messageId),
        eq(record.councilId, actor.councilId),
        inNoticeRoom,
        // 들어온 뒤의 메시지이거나, 띠와 목록에 보이는 같은 기수의 공지다. 보이는 공지는 뗄 수도 있어야 한다.
        visibleMessage(actor),
      ),
    )
  if (!found) throw new ApiError('NOT_FOUND')
  if (found.isNotice !== isNotice)
    await updateRecord(tx, {
      kind: 'message',
      id: messageId,
      actor: actor.memberId,
      reason: null,
      changes: { isNotice },
    })
  return messageOf(tx, messageId)
}
