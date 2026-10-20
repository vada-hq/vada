import { useState } from 'react'
import { statusOf, type ChatMessage } from '@vada/contracts'
import { postJson } from '@/lib/api'
import { NOTICE_ERRORS, NOTICE_FAILED, PERMISSION_CHANGED } from '@/lib/messages'
import { noticePath, type NoticeBody } from './chat-api'
import type { RoomList } from './useRoomList'
import type { Room } from './useRoom'

// 공지 붙이기·떼기. 실패하면 문구를, 성공하면 null을 돌려준다.
// 권한을 잃었으면(403) 학생회를 다시 읽게 하고, 메뉴가 사라지므로 까닭은 note로 흐름 위에 남긴다.
// 메시지가 사라졌으면(404) 흐름을 다시 읽는다.
export function useNoticeMark(args: {
  councilId: string
  room: Room
  rooms: RoomList
  onForbidden: () => void
}) {
  const { councilId, room, rooms, onForbidden } = args
  const [note, setNote] = useState<string | null>(null)
  const markNotice = async (message: ChatMessage, isNotice: boolean) => {
    const result = await postJson(noticePath(councilId, message.id), {
      isNotice,
    } satisfies NoticeBody)
    if (result.ok) {
      room.setNoticeLocally(message.id, isNotice)
      void rooms.reload()
      return null
    }
    if (result.status === statusOf('FORBIDDEN')) {
      setNote(PERMISSION_CHANGED)
      onForbidden()
    }
    if (result.status === statusOf('NOT_FOUND')) void room.retry()
    return NOTICE_ERRORS[result.code] ?? NOTICE_FAILED
  }
  return { note, markNotice }
}
