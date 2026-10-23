import { and, asc, desc, eq, or, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { CHAT_PHOTO_LIST_MAX, PHOTO_MEDIA_TYPE, type ChatPhotoListResponse } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { chatRoom, file, member, message, record, roomMembership } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { createRecord } from '../records/records.js'
import type { FileStorage } from '../storage/storage.js'
import { issueUpload, verifyUploads, type VerifiedPhoto } from '../storage/uploads.js'
import { shownNotice, sinceJoined } from './messages.js'
import { namedRooms } from './queries.js'

type Reader = Pick<Db, 'select'>

const CHAT_AREA = 'chat'
const fileRecord = alias(record, 'file_record')

export const issuePhotoUpload = (storage: FileStorage, actor: Actor) =>
  issueUpload(storage, CHAT_AREA, actor)

export const verifyPhotos = (db: Reader, storage: FileStorage, actor: Actor, keys: string[]) =>
  verifyUploads(db, storage, { area: CHAT_AREA, actor }, keys)

// 사진 기록은 메시지에 붙고 판 1을 남긴다. 보낸 차례가 만든 시각 차례다.
export async function attachPhotos(
  tx: Tx,
  actor: Actor,
  messageId: string,
  photos: VerifiedPhoto[],
) {
  for (const [index, photo] of photos.entries())
    await createRecord(tx, {
      kind: 'file',
      councilId: actor.councilId,
      actor: actor.memberId,
      values: {
        name: `photo-${index + 1}.jpg`,
        mediaType: PHOTO_MEDIA_TYPE,
        sizeBytes: photo.size,
        storageKey: photo.key,
        attachedToId: messageId,
      },
    })
}

// 내가 볼 수 있는 메시지(같은 학생회, 방 참여자이고 들어온 뒤의 것이거나 보이는 같은 기수의 공지). 방 참여 줄을 합친 조회에서 쓴다.
// 사진 보기와 사진을 증빙으로 옮기기가 이 조건 하나를 같이 쓴다(보이는 조건과 여는 조건이 갈라지지 않게).
const visibleMessage = (actor: Actor) =>
  and(eq(record.councilId, actor.councilId), or(sinceJoined(actor.memberId), shownNotice(actor)))

// 내가 볼 수 있는 메시지 하나(요청·지출의 근거로 고를 수 있는 메시지). 사진 보기와 같은 조건이다.
// 없는 번호, 메시지가 아닌 기록, 다른 학생회, 안 들어간 방, 들어오기 전은 모두 false다.
export async function canSeeMessage(db: Reader, actor: Actor, messageId: string) {
  const [found] = await db
    .select({ id: message.id })
    .from(message)
    .innerJoin(record, eq(record.id, message.id))
    .innerJoin(chatRoom, eq(chatRoom.id, message.roomId))
    .innerJoin(
      roomMembership,
      and(eq(roomMembership.roomId, message.roomId), eq(roomMembership.memberId, actor.memberId)),
    )
    .where(and(eq(message.id, messageId), visibleMessage(actor)))
  return found !== undefined
}

// 내가 볼 수 있는 대화 사진을 고르는 조회. 사진 하나 보기와 사진 목록이 같은 연결과 같은 조건을 쓴다.
// 없는 번호, 다른 학생회, 안 들어간 방, 들어오기 전, 증빙 파일은 모두 빠진다. 호출하는 쪽이 정렬과 개수를 더한다.
function visiblePhotoRows(db: Reader, actor: Actor, extra?: SQL) {
  return db
    .select({
      id: file.id,
      key: file.storageKey,
      name: file.name,
      mediaType: file.mediaType,
      messageId: message.id,
      roomId: message.roomId,
      senderId: record.createdBy,
      senderName: member.name,
      sentAt: message.sentAt,
    })
    .from(file)
    .innerJoin(message, eq(message.id, file.attachedToId))
    .innerJoin(record, eq(record.id, message.id))
    .innerJoin(chatRoom, eq(chatRoom.id, message.roomId))
    .innerJoin(
      roomMembership,
      and(eq(roomMembership.roomId, message.roomId), eq(roomMembership.memberId, actor.memberId)),
    )
    .leftJoin(member, eq(member.id, record.createdBy))
    .where(and(visibleMessage(actor), extra))
}

export async function visiblePhoto(db: Reader, actor: Actor, fileId: string) {
  const [found] = await visiblePhotoRows(db, actor, eq(file.id, fileId))
  return (
    found && {
      key: found.key,
      name: found.name,
      mediaType: found.mediaType,
      messageId: found.messageId,
    }
  )
}

// 증빙으로 고를 대화 사진: 최근 것부터 한 장 더 읽어 넘침을 안다.
export async function visiblePhotoList(
  db: Reader,
  actor: Actor,
  now: Date,
): Promise<ChatPhotoListResponse> {
  const rows = await visiblePhotoRows(db, actor)
    .innerJoin(fileRecord, eq(fileRecord.id, file.id))
    // 한 메시지 안의 사진은 보낸 차례(만든 시각)대로다. 메시지끼리만 최근 것이 먼저다.
    .orderBy(desc(message.sentAt), desc(message.id), asc(fileRecord.createdAt), asc(file.id))
    .limit(CHAT_PHOTO_LIST_MAX + 1)
  const shown = rows.slice(0, CHAT_PHOTO_LIST_MAX)
  const rooms = await namedRooms(db, actor, now, [...new Set(shown.map(row => row.roomId))])
  return {
    photos: shown.map(row => ({
      id: row.id,
      messageId: row.messageId,
      room: rooms.get(row.roomId)!,
      senderId: row.senderId,
      senderName: row.senderName,
      sentAt: row.sentAt.toISOString(),
    })),
    truncated: rows.length > CHAT_PHOTO_LIST_MAX,
  }
}

// 사진 보기: 그 사진이 붙은 메시지를 내가 볼 수 있을 때만. 아니면 있는지도 드러내지 않는 404다.
// 공지 목록이 사진 번호를 내려주므로 열 수 있는 조건도 메시지 보기와 같다(markNotice와 같은 꼴).
export async function photoToView(db: Reader, actor: Actor, fileId: string) {
  const found = await visiblePhoto(db, actor, fileId)
  if (!found) throw new ApiError('NOT_FOUND')
  return found
}
