import { useSyncExternalStore } from 'react'

// 보내기 전 사진 한 장. 고르는 즉시 줄여서 올리고, 올라가면 키를 쥐고 있다가 보낼 때 싣는다.
export type PhotoDraft = {
  id: number
  name: string
  preview: string | null
  // sending은 보낸 응답을 기다리는 사진이다. 방을 떠났다 돌아와도 같은 사진을 또 보내지 못하게 한다.
  state: 'uploading' | 'ready' | 'sending' | 'failed'
  key?: string
  error?: string
}

// 붙인 사진: 글(composer-drafts.ts)처럼 방을 바꿔도 남게 메모리에만 둔다(새로 고침 전까지, DEC-78 이동 10).
// 올리기와 보내기의 응답은 입력칸이 사라진 뒤에도 오므로, 화면의 상태가 아니라 이곳이 사진의 원문이다.
// 미리 보기 주소는 사진을 뺄 때만 거둔다. 방을 떠날 때 거두면 돌아왔을 때 사진이 깨진다.
// 방마다 사진 상한까지만 쌓이고, 보내거나 빼면 그 사진의 주소를 거둬 메모리를 돌려준다.
const rooms = new Map<string, PhotoDraft[]>()
const listeners = new Set<() => void>()
const NONE: PhotoDraft[] = []

export const photosOf = (room: string) => rooms.get(room) ?? NONE

function put(room: string, photos: PhotoDraft[]) {
  if (photos.length === 0) rooms.delete(room)
  else rooms.set(room, photos)
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useRoomPhotos = (room: string) => useSyncExternalStore(subscribe, () => photosOf(room))

export const addPhotos = (room: string, photos: PhotoDraft[]) =>
  put(room, [...photosOf(room), ...photos])

// 줄이는 사이에 뺀 사진의 미리 보기는 늦게 온다. 쥘 사진이 없으니 바로 거둔다.
export function patchPhoto(room: string, id: number, change: Partial<PhotoDraft>) {
  const photos = photosOf(room)
  if (photos.some(photo => photo.id === id))
    put(
      room,
      photos.map(photo => (photo.id === id ? { ...photo, ...change } : photo)),
    )
  else if (change.preview) URL.revokeObjectURL(change.preview)
}

export function markPhotos(room: string, keys: string[], state: PhotoDraft['state']) {
  put(
    room,
    photosOf(room).map(photo =>
      photo.key !== undefined && keys.includes(photo.key) ? { ...photo, state } : photo,
    ),
  )
}

export function dropPhotos(room: string, drop: (photo: PhotoDraft) => boolean) {
  const photos = photosOf(room)
  for (const photo of photos) if (photo.preview && drop(photo)) URL.revokeObjectURL(photo.preview)
  put(
    room,
    photos.filter(photo => !drop(photo)),
  )
}

// 시험용: 앞 시험이 남긴 사진을 비운다.
export const resetPhotoDrafts = () => rooms.clear()
