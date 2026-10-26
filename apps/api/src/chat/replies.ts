import { eq } from 'drizzle-orm'
import type { ReplyPageResponse } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { message } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { messageOf, pageIn, visibleInRoom } from './messages.js'

type Reader = Pick<Db, 'select'>

// 답글은 원글 아래 한 단계다(DEC-90). 이 방에서 내가 볼 수 있는 원글이 아니면(다른 방, 다른 학생회, 들어오기 전, 없는 것)
// 있는지 드러내지 않는 404이고, 답글을 고르면 답글에 답글이라 badReply다(보내기는 400, 읽기는 그런 원글이 없어 404).
export async function assertOriginal(
  db: Reader,
  actor: Actor,
  { roomId, messageId }: { roomId: string; messageId: string },
  badReply: 'INVALID_INPUT' | 'NOT_FOUND',
) {
  const found = await visibleInRoom(db, actor, roomId, messageId)
  if (!found) throw new ApiError('NOT_FOUND')
  if (found.replyToId !== null) throw new ApiError(badReply)
}

// 원글과 그 답글 한 쪽. 답글은 보낸 순이고 커서는 방 흐름과 같다(답글 번호). 방을 여는 문(room-access)을 지난 뒤에 부른다.
export async function replyPage(
  db: Reader,
  actor: Actor,
  { roomId, messageId }: { roomId: string; messageId: string },
  query: { before?: string | undefined; after?: string | undefined },
): Promise<ReplyPageResponse> {
  await assertOriginal(db, actor, { roomId, messageId }, 'NOT_FOUND')
  const page = await pageIn(db, actor, eq(message.replyToId, messageId), query)
  return { original: await messageOf(db, actor, messageId), ...page }
}
