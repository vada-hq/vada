import { randomUUID } from 'node:crypto'
import { inArray } from 'drizzle-orm'
import {
  isUuid,
  PHOTO_MAX_BYTES,
  PHOTO_MEDIA_TYPE,
  type PhotoUploadResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { file } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { uniqueViolationOf } from '../db/error-code.js'
import { ApiError } from '../http/errors.js'
import type { FileStorage } from './storage.js'

const UPLOAD_MAX_AGE_MS = 86_400_000

type Reader = Pick<Db, 'select'>

// 대화 사진과 증빙 사진이 같이 쓰는 올리기 검사. 쓰는 곳마다 키의 맨 앞(chat, evidence)만 다르다.
export const PHOTO_UPLOAD_LIMIT = { limit: 100, windowMs: 10_000 }

export function requireStorage(storage: FileStorage | undefined): FileStorage {
  if (!storage) throw new ApiError('STORAGE_NOT_CONFIGURED')
  return storage
}

// 저장소 위치는 서버가 정한다: 학생회와 올린 운영진이 들어 있어, 다른 사람의 사진을 내 것으로 보낼 수 없다(PRIN-5).
const prefixOf = (area: string, actor: Actor) => `${area}/${actor.councilId}/${actor.memberId}/`
const isOwnKey = (area: string, actor: Actor, key: string) =>
  key.startsWith(prefixOf(area, actor)) && isUuid(key.slice(prefixOf(area, actor).length))

// 새 저장소 키. 올리기 주소와 저장소 안 복사가 같은 모양을 쓴다.
export const newStorageKey = (area: string, actor: Actor) =>
  `${prefixOf(area, actor)}${randomUUID()}`

// 올리기 주소. 서버가 파일 바이트를 받지 않으므로 형식은 서명으로, 크기는 보낼 때 저장소에서 확인한다.
export async function issueUpload(
  storage: FileStorage,
  area: string,
  actor: Actor,
): Promise<PhotoUploadResponse> {
  const key = newStorageKey(area, actor)
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
export async function verifyUploads(
  db: Reader,
  storage: FileStorage,
  owner: { area: string; actor: Actor; now: Date },
  keys: string[],
): Promise<VerifiedPhoto[]> {
  const { area, actor } = owner
  if (!keys.every(key => isOwnKey(area, actor, key))) throw new ApiError('INVALID_INPUT')
  await assertNotSent(db, keys)
  const verified: VerifiedPhoto[] = []
  for (const key of keys) {
    const stored = await storage.head(key)
    // 경계 직전 검사를 마친 다른 요청이 이미 붙였을 수 있다. 만료 객체는 여기서 지우지 않고 72시간 정리에 맡긴다.
    if (
      !stored?.lastModified ||
      !(owner.now.getTime() - stored.lastModified.getTime() <= UPLOAD_MAX_AGE_MS)
    )
      throw new ApiError('UPLOAD_MISMATCH')
    const fits =
      stored.contentType === PHOTO_MEDIA_TYPE && stored.size >= 1 && stored.size <= PHOTO_MAX_BYTES
    if (!fits) {
      // 지우기가 실패해도 보내기는 어긋남으로 답한다. 남은 객체는 비공개 키라 보이지 않는다.
      await storage.remove(key).catch(() => undefined)
      throw new ApiError('UPLOAD_MISMATCH')
    }
    verified.push({ key, size: stored.size })
  }
  return verified
}

// 같은 키가 동시에 두 번 들어오면 저장소 위치의 UNIQUE가 막는다. 그것을 이미 보낸 사진으로 답한다.
export const isStorageKeyConflict = (error: unknown) =>
  uniqueViolationOf(error)?.includes('storage_key') === true
