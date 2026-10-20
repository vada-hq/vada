import { useCallback, useEffect, useRef, useState } from 'react'
import { useActive } from '@/lib/use-active'
import { PHOTO_CANNOT_OPEN, PHOTO_TOO_MANY, PHOTO_UPLOAD_FAILED } from '@/lib/messages'
import { isRoomLost, sendErrorText } from './chat-api'
import { PHOTO_MAX_COUNT } from './photo-resize'
import { photoName, sendPhoto, UNREADABLE } from './photo-upload'

// 보내기 전 사진 한 장. 고르는 즉시 줄여서 올리고, 올라가면 키를 쥐고 있다가 보낼 때 싣는다.
export type PhotoDraft = {
  id: number
  name: string
  preview: string | null
  state: 'uploading' | 'ready' | 'failed'
  key?: string
  error?: string
}

let nextId = 0
const revoke = (photos: PhotoDraft[]) => {
  for (const photo of photos) if (photo.preview) URL.revokeObjectURL(photo.preview)
}

const newDraft = (file: File): PhotoDraft => ({
  id: nextId++,
  name: photoName(file.name),
  preview: null,
  state: 'uploading',
})

// 입력칸의 사진 줄. 고르기·빼기·올리기 상태를 맡는다. 방을 잃으면(403·404) onLost로 알린다.
export function usePhotoDrafts(councilId: string, roomId: string, onLost: () => void) {
  const [photos, setPhotos] = useState<PhotoDraft[]>([])
  const [note, setNote] = useState<string | null>(null)
  // 아직 목록에 반영되지 않은 선택까지 센다. 연달아 골라도 상한을 넘지 않게 한다.
  const count = useRef(0)
  const latest = useRef<PhotoDraft[]>([])
  const isActive = useActive()
  useEffect(() => {
    latest.current = photos
  }, [photos])
  useEffect(() => () => revoke(latest.current), [])

  const patch = useCallback(
    (id: number, change: Partial<PhotoDraft>) =>
      setPhotos(list => list.map(item => (item.id === id ? { ...item, ...change } : item))),
    [],
  )

  const process = useCallback(
    async (draft: PhotoDraft, file: File) => {
      const where = { councilId, roomId }
      const result = await sendPhoto(where, file, draft.name, preview =>
        patch(draft.id, { preview }),
      )
      if (!isActive()) return
      if (result.ok) return patch(draft.id, { state: 'ready', key: result.key })
      if (isRoomLost(result.status)) onLost()
      const error =
        result.code === UNREADABLE ? PHOTO_CANNOT_OPEN : sendErrorText(result, PHOTO_UPLOAD_FAILED)
      patch(draft.id, { state: 'failed', error })
    },
    [councilId, roomId, onLost, isActive, patch],
  )

  const add = (files: File[]) => {
    const accepted = files.slice(0, Math.max(0, PHOTO_MAX_COUNT - count.current))
    setNote(files.length > accepted.length ? PHOTO_TOO_MANY(PHOTO_MAX_COUNT) : null)
    count.current += accepted.length
    const drafts = accepted.map(file => ({ draft: newDraft(file), file }))
    setPhotos(list => [...list, ...drafts.map(item => item.draft)])
    for (const { draft, file } of drafts) void process(draft, file)
  }

  // 남길 사진만 두고 나머지의 미리 보기를 거둔다.
  const keepOnly = (kept: PhotoDraft[]) => {
    revoke(photos.filter(item => !kept.includes(item)))
    count.current = kept.length
    setNote(null)
    setPhotos(kept)
  }
  const remove = (id: number) => keepOnly(photos.filter(item => item.id !== id))
  const clear = () => keepOnly([])

  return { photos, note, add, remove, clear }
}
