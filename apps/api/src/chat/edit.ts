import { and, eq } from 'drizzle-orm'
import { inCouncilChange, type AccessRequest } from '../access/authorize.js'
import type { Actor } from '../access/actor.js'
import { chatRoom, message, record } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { clockNow, updateRecords } from '../records/records.js'
import { isArchivedEvent } from './archive.js'
import { decideEdit } from './deletion-policy.js'
import { linkedMessageIds, messageOf, visibleMessage } from './messages.js'

async function editOwn(tx: Tx, actor: Actor, input: { messageId: string; body: string }) {
  const { messageId, body } = input
  const [found] = await tx
    .select({
      senderId: record.createdBy,
      body: message.body,
      deletedAt: message.deletedAt,
      eventId: chatRoom.eventId,
    })
    .from(message)
    .innerJoin(record, eq(record.id, message.id))
    .innerJoin(chatRoom, eq(chatRoom.id, message.roomId))
    .where(and(eq(message.id, messageId), visibleMessage(actor)))
    .for('update', { of: message })
  if (!found) throw new ApiError('NOT_FOUND')
  // 근거 잇기도 같은 메시지 행을 잠그므로 잠금 뒤의 조회는 먼저 끝난 연결을 본다.
  const linked = (await linkedMessageIds(tx, [messageId])).has(messageId)
  const archived = await isArchivedEvent(tx, found.eventId)
  const decision = decideEdit(actor, { ...found, closing: false, linked, archived })
  if (decision !== 'edit') throw new ApiError(decision)
  if (found.body !== body)
    await updateRecords(tx, [
      {
        kind: 'message',
        id: messageId,
        actor: actor.memberId,
        reason: null,
        changes: { body, editedAt: clockNow },
      },
    ])
  return messageOf(tx, actor, messageId)
}

export async function editOwnMessage(
  db: Db,
  request: AccessRequest,
  messageId: string,
  body: string,
) {
  return inCouncilChange(db, request, (tx, actor) => editOwn(tx, actor, { messageId, body })).catch(
    (error: unknown) => {
      if (error instanceof ApiError && error.code === 'FORBIDDEN') throw new ApiError('NOT_FOUND')
      throw error
    },
  )
}
