import { and, asc, eq, inArray, ne } from 'drizzle-orm'
import type { ChatMessage } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { chatRoom, roomMembership } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { authorizeChange, authorizeWrite, type AccessRequest } from '../access/authorize.js'
import { ApiError } from '../http/errors.js'
import { clockNow, createRecord } from '../records/records.js'
import { assertLinkableTask } from '../tasks/link.js'
import { currentMembersAmong, lockCurrentMembers } from './current-members.js'
import { messageOf } from './messages.js'
import { isStorageKeyConflict, type VerifiedPhoto } from '../storage/uploads.js'
import { attachPhotos } from './photos.js'
import { advanceRead } from './read-marker.js'
import { inCouncilNoticeRoom } from './plan-room.js'
import { roomAccess } from './room-access.js'
import { lockedSentAt } from './sent-at.js'

type SendInput = {
  roomId: string
  body: string
  mentions: string[]
  photos: VerifiedPhoto[]
  // 이 메시지를 공지 결과물로 이을 업무(기능 015). 공지방에 보낼 때만 받는다(DEC-90).
  taskId?: string | null | undefined
}

// 보내기 속도 제한: 계정마다 10초에 20개(기능 003 '속도 제한'). 넘으면 TOO_MANY_REQUESTS다.
export const SEND_LIMIT = { limit: 20, windowMs: 10_000 }

// 상대가 학생회를 떠난 1:1은 보기만 된다.
// 1:1은 내보내기가 참여 줄을 지우지 않아 내 참여 줄 잠금으로는 내보내기와 직렬화되지 않는다. 그래서 나와 상대의 소속 줄을 함께 잠그고
// (lockCurrentMembers) 다시 읽는다: 내가 먼저 내보내졌으면 FORBIDDEN, 상대가 먼저 떠났으면 ROOM_READ_ONLY다.
// 보내기가 먼저면 내보내기가 이 거래가 끝나기를 기다리므로, 떠난 사람의 마지막 글은 떠나기 전의 글이다.
async function assertWritable(tx: Tx, actor: Actor, room: { id: string; type: string }, now: Date) {
  if (room.type !== 'direct') return
  const peers = await tx
    .select({ memberId: roomMembership.memberId })
    .from(roomMembership)
    .where(and(eq(roomMembership.roomId, room.id), ne(roomMembership.memberId, actor.memberId)))
  const alive = await lockCurrentMembers(
    tx,
    actor.councilId,
    [actor.memberId, ...peers.map(peer => peer.memberId)],
    now,
  )
  if (!alive.has(actor.memberId)) throw new ApiError('FORBIDDEN')
  if (!peers.some(peer => alive.has(peer.memberId))) throw new ApiError('ROOM_READ_ONLY')
}

// 부른 번호 중 이 방의 지금 참여자(나 빼고)이고 지금 운영진인 사람. 나머지는 조용히 뺀다.
// 참여 줄을 FOR KEY SHARE로 잠가, 부르는 사이에 내보내져 줄이 지워지는 일과 겹치지 않게 한다(지우기는 FOR UPDATE를 기다린다).
// 내 줄의 FOR NO KEY UPDATE와는 부딪히지 않아 서로 부르는 두 사람이 교착하지 않는다.
// 1:1의 줄은 학생회를 떠난 뒤에도 남고 기록 모듈은 끝난 소속에게도 알림을 허용하므로, 지금 운영진인지는 따로 본다.
async function calledFrom(
  tx: Tx,
  actor: Actor,
  { roomId, mentions }: { roomId: string; mentions: string[] },
  now: Date,
) {
  const wanted = [...new Set(mentions)].filter(id => id !== actor.memberId)
  if (!wanted.length) return []
  const rows = await tx
    .select({ memberId: roomMembership.memberId })
    .from(roomMembership)
    .where(and(eq(roomMembership.roomId, roomId), inArray(roomMembership.memberId, wanted)))
    .orderBy(asc(roomMembership.memberId))
    .for('key share')
  const alive = await currentMembersAmong(
    tx,
    actor.councilId,
    rows.map(row => row.memberId),
    now,
  )
  return rows.map(row => row.memberId).filter(id => alive.has(id))
}

async function isCouncilNoticeRoom(tx: Tx, roomId: string) {
  const [found] = await tx
    .select({ id: chatRoom.id })
    .from(chatRoom)
    .where(and(eq(chatRoom.id, roomId), inCouncilNoticeRoom))
  return found !== undefined
}

// 글 보내기. 내 참여 줄을 FOR NO KEY UPDATE로 잠근 뒤에 보낸다: 내보내기나 부서 빼기가 먼저 줄을 지웠으면 잠금이 줄을 찾지 못해 403이고,
// 보내기가 먼저면 지우기가 이 거래가 끝나기를 기다린다. 읽기 전용 거래가 아니라 READ COMMITTED에서 불러야 기다린 뒤의 값을 본다.
// 공유 잠금 둘이 서로 기다리다 교착하지 않도록 처음부터 NO KEY UPDATE를 잡는다.
// 보낸 시각은 DB 시계다. 들어온 시각(DEC-20)과 같은 시계라야 내 글이 내게 안 보이는 일이 없다.
export async function sendMessage(
  tx: Tx,
  actor: Actor,
  input: SendInput,
  now: Date,
): Promise<ChatMessage> {
  // 업무를 잇는 보내기는 sendAs가 학생회 행을 잠근 뒤 권한을 다시 본 actor(authorizeChange)로 부른다.
  const room = await roomAccess(tx, actor, input.roomId)
  // 공지는 공지방에 보낸 보통 메시지다(DEC-90). 업무의 공지 결과물은 공지방에 보낼 때만 잇는다. 보내기는 그 방 참여자 누구나 한다.
  if (input.taskId && !(await isCouncilNoticeRoom(tx, room.id))) throw new ApiError('INVALID_INPUT')
  const [mine] = await tx
    .select({ memberId: roomMembership.memberId })
    .from(roomMembership)
    .where(and(eq(roomMembership.roomId, room.id), eq(roomMembership.memberId, actor.memberId)))
    .for('no key update')
  if (!mine) throw new ApiError('FORBIDDEN')
  await assertWritable(tx, actor, room, now)
  if (input.taskId) await assertLinkableTask(tx, actor, input.taskId, now)
  const called = await calledFrom(tx, actor, { roomId: room.id, mentions: input.mentions }, now)
  // 잠금 순서: 내 참여 줄 → 방 행.
  const sentAt = await lockedSentAt(tx, room.id)
  const messageId = await createRecord(tx, {
    kind: 'message',
    councilId: actor.councilId,
    actor: actor.memberId,
    ...(input.taskId ? { taskId: input.taskId } : {}),
    // is_notice 칸은 남아 있지만 읽는 코드가 없다(DEC-90). 새 메시지는 늘 false다.
    values: { roomId: room.id, body: input.body, sentAt, isNotice: false },
  })
  await attachPhotos(tx, actor, messageId, input.photos)
  await advanceRead(tx, room.id, actor.memberId, messageId)
  for (const recipientId of called)
    await createRecord(tx, {
      kind: 'notification',
      councilId: actor.councilId,
      actor: null,
      values: { recipientId, recordId: messageId, type: 'mention', notifiedAt: clockNow },
    })
  return messageOf(tx, messageId)
}

// 요청한 사람의 권한을 보고 보낸다. 업무를 잇는 보내기는 업무 상태를 옮기는 쓰기라 다른 직원 쓰기처럼 학생회 행을 잠근 뒤 권한을 다시 본다.
// 그만두는 학생회(DEC-55)에는 어느 쪽이든 보내지 못한다.
// 라우트가 아니라 여기서 정하므로 이 길을 지나는 시험(pg-smoke 포함)이 잠금을 함께 확인한다.
export async function sendAs(
  tx: Tx,
  request: AccessRequest,
  input: SendInput,
): Promise<ChatMessage> {
  const actor = await (input.taskId ? authorizeChange(tx, request) : authorizeWrite(tx, request))
  return sendMessage(tx, actor, input, request.now)
}

// 보내기 거래. READ COMMITTED 거래라야 줄을 잠그고 기다린 뒤의 값을 본다. 같은 사진 키가 동시에 두 번 들어와 저장소 위치 UNIQUE에 걸리면 이미 보낸 사진이다.
export async function postMessage(
  db: Db,
  request: AccessRequest,
  input: SendInput,
): Promise<ChatMessage> {
  try {
    return await db.transaction(tx => sendAs(tx, request, input))
  } catch (error) {
    if (isStorageKeyConflict(error)) throw new ApiError('PHOTO_ALREADY_SENT')
    throw error
  }
}
