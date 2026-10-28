import { and, eq, isNotNull } from 'drizzle-orm'
import { inCouncilChange, type AccessRequest } from '../access/authorize.js'
import type { Actor } from '../access/actor.js'
import { chatRoom, file, message, record } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import type { FileStorage } from '../storage/storage.js'
import { eraseMessages } from './erase.js'
import { decideDeletion } from './deletion-policy.js'
import { messageOf, visibleMessage } from './messages.js'

async function eraseOwn(tx: Tx, actor: Actor, messageId: string) {
  const [found] = await tx
    .select({ senderId: record.createdBy, deletedAt: message.deletedAt })
    .from(message)
    .innerJoin(record, eq(record.id, message.id))
    .innerJoin(chatRoom, eq(chatRoom.id, message.roomId))
    .where(and(eq(message.id, messageId), visibleMessage(actor)))
    .for('update', { of: message })
  if (!found) throw new ApiError('NOT_FOUND')
  // inCouncilChange가 학생회 행을 잠그고 그만두기 중이 아님을 확인한 뒤 부른다.
  const decision = decideDeletion(actor, { ...found, closing: false })
  if (decision !== 'delete' && decision !== 'deleted') throw new ApiError(decision)
  const storageKeys: string[] = []
  if (decision === 'delete') {
    const photos = await tx
      .select({ key: file.storageKey })
      .from(file)
      .where(and(eq(file.attachedToId, messageId), isNotNull(file.storageKey)))
    storageKeys.push(...photos.flatMap(photo => (photo.key === null ? [] : [photo.key])))
    await eraseMessages(tx, [messageId], { actor: actor.memberId, reason: null })
  }
  return { deleted: await messageOf(tx, actor, messageId), storageKeys }
}

// 소속·작성자·열람 범위를 한 거래에서 확인한다. 권한 없는 학생회도 메시지 존재를 드러내지 않는다.
export async function deleteOwnMessage(
  db: Db,
  request: AccessRequest,
  messageId: string,
  storage: FileStorage | undefined,
) {
  const result = await inCouncilChange(db, request, (tx, actor) =>
    eraseOwn(tx, actor, messageId),
  ).catch((error: unknown) => {
    if (error instanceof ApiError && error.code === 'FORBIDDEN') throw new ApiError('NOT_FOUND')
    throw error
  })
  for (const key of new Set(result.storageKeys)) {
    try {
      await storage?.remove(key)
    } catch {
      // 커밋 뒤 객체 삭제 실패는 성공 응답을 바꾸지 않고, 남은 객체는 조각 10이 지운다.
    }
  }
  return result.deleted
}
