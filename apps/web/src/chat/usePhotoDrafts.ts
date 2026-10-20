import { PHOTO_MAX_COUNT } from '@vada/contracts'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useActive } from '@/lib/use-active'
import {
  PHOTO_CANNOT_OPEN,
  PHOTO_TOO_BIG,
  PHOTO_TOO_MANY,
  PHOTO_UPLOAD_FAILED,
} from '@/lib/messages'
import { isRoomLost, sendErrorText } from './chat-api'
import { photoName, sendPhoto, TOO_BIG, UNREADABLE } from './photo-upload'

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

const failureText = (result: { status: number; code: string }) => {
  if (result.code === UNREADABLE) return PHOTO_CANNOT_OPEN
  if (result.code === TOO_BIG) return PHOTO_TOO_BIG
  return sendErrorText(result, PHOTO_UPLOAD_FAILED)
}

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
      const result = await sendPhoto(where, file, preview => patch(draft.id, { preview }))
      if (!isActive()) return
      if (result.ok) return patch(draft.id, { state: 'ready', key: result.key })
      if (isRoomLost(result.status)) onLost()
      const error = failureText(result)
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

  // 남길 사진만 두고 나머지의 미리 보기를 거둔다. 보내는 사이에 더 고른 사진이 있어도 최신 목록에서 거른다.
  const dropWhere = (drop: (item: PhotoDraft) => boolean) => {
    revoke(latest.current.filter(drop))
    setNote(null)
    setPhotos(list => {
      const kept = list.filter(item => !drop(item))
      count.current = kept.length
      return kept
    })
  }
  const remove = (id: number) => dropWhere(item => item.id === id)
  // 보낸 사진만 지운다. 보내는 동안 새로 고른 사진은 남는다.
  const removeSent = (keys: string[]) =>
    dropWhere(item => item.key !== undefined && keys.includes(item.key))

  return { photos, note, add, remove, removeSent }
}
