import { and, eq, or } from 'drizzle-orm'
import { PHOTO_MEDIA_TYPE } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { chatRoom, file, message, record, roomMembership } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { createRecord } from '../records/records.js'
import type { FileStorage } from '../storage/storage.js'
import { issueUpload, verifyUploads, type VerifiedPhoto } from '../storage/uploads.js'
import { shownNotice, sinceJoined } from './messages.js'

type Reader = Pick<Db, 'select'>

const CHAT_AREA = 'chat'

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
