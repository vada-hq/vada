import { PHOTO_MAX_COUNT } from '@vada/contracts'
import { useCallback, useState } from 'react'
import { useActive } from '@/lib/use-active'
import {
  PHOTO_CANNOT_OPEN,
  PHOTO_TOO_BIG,
  PHOTO_TOO_MANY,
  PHOTO_UPLOAD_FAILED,
} from '@/lib/messages'
import { photoName, sendPhoto, TOO_BIG, UNREADABLE } from '@/lib/photo-upload'
import { isRoomLost, sendErrorText, uploadsPath } from './chat-api'
import { draftKey } from './composer-drafts'
import {
  addPhotos,
  dropPhotos,
  markPhotos,
  patchPhoto,
  photosOf,
  useRoomPhotos,
  type PhotoDraft,
} from './photo-drafts'

let nextId = 0

const newDraft = (file: File): PhotoDraft => ({
  id: nextId++,
  name: photoName(file.name),
  preview: null,
  state: 'uploading',
})

const failureText = (result: { status: number; code: string }) => {
  if (result.code === UNREADABLE) return PHOTO_CANNOT_OPEN
  if (result.code === TOO_BIG) return PHOTO_TOO_BIG
  return sendErrorText(result, PHOTO_UPLOAD_FAILED)
}

// 입력칸의 사진 줄. 고르기·빼기·올리기 상태를 맡는다. 방을 잃으면(403·404) onLost로 알린다.
export function usePhotoDrafts(
  meId: string,
  councilId: string,
  roomId: string,
  onLost: () => void,
) {
  const room = draftKey(meId, councilId, roomId)
  const photos = useRoomPhotos(room)
  const [note, setNote] = useState<string | null>(null)
  const isActive = useActive()

  // 방을 떠나도 올리기는 끝까지 간다. 결과를 사진에 남겨, 돌아오면 그대로 보내거나 이유를 본다.
  const process = useCallback(
    async (draft: PhotoDraft, file: File) => {
      const result = await sendPhoto(uploadsPath(councilId, roomId), file, preview =>
        patchPhoto(room, draft.id, { preview }),
      )
      if (result.ok) return patchPhoto(room, draft.id, { state: 'ready', key: result.key })
      if (isRoomLost(result.status) && isActive()) onLost()
      patchPhoto(room, draft.id, { state: 'failed', error: failureText(result) })
    },
    [councilId, roomId, room, onLost, isActive],
  )

  const add = (files: File[]) => {
    const accepted = files.slice(0, Math.max(0, PHOTO_MAX_COUNT - photosOf(room).length))
    setNote(files.length > accepted.length ? PHOTO_TOO_MANY(PHOTO_MAX_COUNT) : null)
    const drafts = accepted.map(file => ({ draft: newDraft(file), file }))
    addPhotos(
      room,
      drafts.map(item => item.draft),
    )
    for (const { draft, file } of drafts) void process(draft, file)
  }

  const remove = (id: number) => {
    setNote(null)
    dropPhotos(room, item => item.id === id)
  }
  const holdForSend = (keys: string[]) => markPhotos(room, keys, 'sending')
  // 보낸 사진만 지운다. 보내는 동안 새로 고른 사진은 남는다. 실패하면 다시 보낼 수 있게 돌려놓는다.
  const settleSend = (keys: string[], sent: boolean) => {
    if (!sent) return markPhotos(room, keys, 'ready')
    setNote(null)
    dropPhotos(room, item => item.key !== undefined && keys.includes(item.key))
  }

  return { photos, note, add, remove, holdForSend, settleSend }
}
