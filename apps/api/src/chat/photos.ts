import { randomUUID } from 'node:crypto'
import { and, eq, inArray, or } from 'drizzle-orm'
import {
  isUuid,
  PHOTO_MAX_BYTES,
  PHOTO_MEDIA_TYPE,
  type PhotoUploadResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { chatRoom, file, message, record, roomMembership } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { uniqueViolationOf } from '../db/error-code.js'
import { ApiError } from '../http/errors.js'
import { createRecord } from '../records/records.js'
import type { FileStorage } from '../storage/storage.js'
import { shownNotice, sinceJoined } from './messages.js'

type Reader = Pick<Db, 'select'>

// 저장소 위치는 서버가 정한다: 학생회와 올린 운영진이 들어 있어, 다른 사람의 사진을 내 것으로 보낼 수 없다(PRIN-5).
const keyPrefix = (actor: Actor) => `chat/${actor.councilId}/${actor.memberId}/`
const isOwnKey = (actor: Actor, key: string) =>
  key.startsWith(keyPrefix(actor)) && isUuid(key.slice(keyPrefix(actor).length))

export const PHOTO_UPLOAD_LIMIT = { limit: 100, windowMs: 10_000 }

export function requireStorage(storage: FileStorage | undefined): FileStorage {
  if (!storage) throw new ApiError('STORAGE_NOT_CONFIGURED')
  return storage
}

// 올리기 주소. 서버가 파일 바이트를 받지 않으므로 형식은 서명으로, 크기는 보낼 때 저장소에서 확인한다.
export async function issuePhotoUpload(
  storage: FileStorage,
  actor: Actor,
): Promise<PhotoUploadResponse> {
  const key = `${keyPrefix(actor)}${randomUUID()}`
  const signed = await storage.uploadUrl(key, PHOTO_MEDIA_TYPE)
  return {
    key,
    url: signed.url,
    headers: signed.headers,
    expiresAt: signed.expiresAt.toISOString(),
  }
}

export interface VerifiedPhoto {
  key: string
  size: number
}

async function assertNotSent(db: Reader, keys: string[]) {
  const sent = await db.select({ id: file.id }).from(file).where(inArray(file.storageKey, keys))
  if (sent.length) throw new ApiError('PHOTO_ALREADY_SENT')
}

// 보낼 때 저장소에서 크기(1바이트~10MB)와 형식(JPEG)을 확인한다. 어긋나면 그 객체를 지운다.
// 이미 보낸 키는 지우지 않으려고 head보다 먼저 가른다. 남의 키는 지우지도 않는다.
export async function verifyPhotos(
  db: Reader,
  storage: FileStorage,
  actor: Actor,
  keys: string[],
): Promise<VerifiedPhoto[]> {
  if (!keys.every(key => isOwnKey(actor, key))) throw new ApiError('INVALID_INPUT')
  await assertNotSent(db, keys)
  const verified: VerifiedPhoto[] = []
  for (const key of keys) {
    const stored = await storage.head(key)
    const fits =
      stored !== null &&
      stored.contentType === PHOTO_MEDIA_TYPE &&
      stored.size >= 1 &&
      stored.size <= PHOTO_MAX_BYTES
    if (!fits) {
      // 지우기가 실패해도 보내기는 어긋남으로 답한다. 남은 객체는 비공개 키라 보이지 않는다.
      if (stored !== null) await storage.remove(key).catch(() => undefined)
      throw new ApiError('UPLOAD_MISMATCH')
    }
    verified.push({ key, size: stored.size })
  }
  return verified
}

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

// 같은 키가 동시에 두 번 들어오면 저장소 위치의 UNIQUE가 막는다. 그것을 이미 보낸 사진으로 답한다.
export const isStorageKeyConflict = (error: unknown) =>
  uniqueViolationOf(error)?.includes('storage_key') === true

// 사진 보기: 그 사진이 붙은 메시지를 내가 볼 수 있을 때만(방 참여자이고, 들어온 뒤의 것이거나 보이는 같은 기수의 공지). 아니면 있는지도 드러내지 않는 404다.
// 공지 목록이 사진 번호를 내려주므로 열 수 있는 조건도 메시지 보기와 같다(markNotice와 같은 꼴).
export async function photoToView(db: Reader, actor: Actor, fileId: string) {
  const [found] = await db
    .select({ key: file.storageKey, name: file.name, mediaType: file.mediaType })
    .from(file)
    .innerJoin(message, eq(message.id, file.attachedToId))
    .innerJoin(record, eq(record.id, message.id))
    .innerJoin(chatRoom, eq(chatRoom.id, message.roomId))
    .innerJoin(
      roomMembership,
      and(eq(roomMembership.roomId, message.roomId), eq(roomMembership.memberId, actor.memberId)),
    )
    .where(
      and(
        eq(file.id, fileId),
        eq(record.councilId, actor.councilId),
        or(sinceJoined(actor.memberId), shownNotice(actor)),
      ),
    )
  if (!found) throw new ApiError('NOT_FOUND')
  return found
}
