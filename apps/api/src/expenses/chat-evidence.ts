import { PHOTO_MAX_BYTES, PHOTO_MEDIA_TYPE } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { visiblePhoto } from '../chat/photos.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import type { FileStorage } from '../storage/storage.js'
import { newStorageKey, type VerifiedPhoto } from '../storage/uploads.js'
import { EVIDENCE_AREA } from './evidence.js'

const dropQuietly = (storage: FileStorage, key: string) =>
  storage.remove(key).catch(() => undefined)

// 대화 사진을 증빙 자리로 복사한다(DEC-45). 같은 파일을 가리키지 않는다:
// 메시지를 지우면 붙은 파일을 저장소에서 지우는데 증빙은 남아야 하고, 저장소 위치는 UNIQUE다.
// 원본은 남의 키라 어떤 실패에도 지우지 않는다. 복사본은 복사가 어긋나면 여기서, 거래가 실패하면 dropCopyOnFailure가 지운다.
export async function copyChatPhoto(
  db: Pick<Db, 'select'>,
  storage: FileStorage,
  actor: Actor,
  photoId: string,
): Promise<VerifiedPhoto> {
  // 볼 수 없는 사진은 있는지도 드러내지 않는 같은 오류다.
  const source = await visiblePhoto(db, actor, photoId)
  if (!source) throw new ApiError('MESSAGE_INVALID')
  const original = await storage.head(source.key)
  const fits =
    original !== null &&
    original.contentType === PHOTO_MEDIA_TYPE &&
    original.size >= 1 &&
    original.size <= PHOTO_MAX_BYTES
  if (!fits) throw new ApiError('UPLOAD_MISMATCH')
  const key = newStorageKey(EVIDENCE_AREA, actor)
  try {
    await storage.copy(source.key, key)
    // CopyObject는 200 안에 오류를 담을 수 있어, 새 객체가 원본과 같을 때만 기록한다.
    const copy = await storage.head(key)
    if (copy?.size !== original.size || copy.contentType !== original.contentType)
      throw new Error('STORAGE_COPY_MISMATCH')
  } catch (error) {
    await dropQuietly(storage, key)
    throw error
  }
  return { key, size: original.size }
}

// 거래가 실패하면 복사본을 지운다(지우기가 실패해도 응답은 그 오류다).
export async function dropCopyOnFailure<T>(
  storage: FileStorage,
  photo: VerifiedPhoto,
  run: () => Promise<T>,
) {
  try {
    return await run()
  } catch (error) {
    await dropQuietly(storage, photo.key)
    throw error
  }
}
