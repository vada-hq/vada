import { and, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { Actor } from '../access/actor.js'
import { chatRoom, record, roomMembership } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { clockNow, createRecord } from '../records/records.js'
import { currentMembersAmong } from './current-members.js'
import { isPlanRoom } from './plan-room.js'

async function existingDirect(tx: Tx, actor: Actor, peerId: string) {
  const mine = alias(roomMembership, 'mine')
  const theirs = alias(roomMembership, 'theirs')
  const [found] = await tx
    .select({ id: chatRoom.id })
    .from(chatRoom)
    .innerJoin(record, eq(record.id, chatRoom.id))
    .innerJoin(mine, and(eq(mine.roomId, chatRoom.id), eq(mine.memberId, actor.memberId)))
    .innerJoin(theirs, and(eq(theirs.roomId, chatRoom.id), eq(theirs.memberId, peerId)))
    .where(and(eq(chatRoom.type, 'direct'), isPlanRoom, eq(record.councilId, actor.councilId)))
  return found?.id
}

// 1:1 열기. 나와 상대가 같이 든 이 학생회의 1:1이 있으면 그 방을, 없으면 만든다(Slack conversations.open과 같다).
// 학생회 행을 잠근 거래 안에서 부른다. 잠그지 않으면 두 요청이 방을 둘 만든다(두 사람이 같은 방을 하나만 갖는다는 DB 보증은 없다).
// 상대는 지금 이 학생회의 운영진이어야 한다. 아니면 다른 학생회 사람이나 없는 사람과 같이 404다.
export async function openDirect(tx: Tx, actor: Actor, peerId: string, now: Date): Promise<string> {
  if (peerId === actor.memberId) throw new ApiError('CANNOT_DIRECT_SELF')
  if (!(await currentMembersAmong(tx, actor.councilId, [peerId], now)).has(peerId))
    throw new ApiError('NOT_FOUND')
  const existing = await existingDirect(tx, actor, peerId)
  if (existing) return existing
  const roomId = await createRecord(tx, {
    kind: 'chat_room',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: { type: 'direct' },
  })
  await tx
    .insert(roomMembership)
    .values([actor.memberId, peerId].map(memberId => ({ roomId, memberId, joinedAt: clockNow })))
  return roomId
}
