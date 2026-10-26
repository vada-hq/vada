import type { ReactNode } from 'react'
import type { EventRoomsResponse } from '@vada/contracts'
import type { RoomPage } from '@/chat/ChatPage'
import { useRoomList } from '@/chat/useRoomList'
import { useTeam } from '@/team/useTeam'
import { roomList } from './chat-fixtures'
import { json, type mockApi } from './mock-api'

// 행사 화면은 메시지 탭 배지를 위해 어느 탭에서나 그 행사의 방을 읽는다(022 조각 9).
// 대화 목록(옆 메뉴 배지)과 그 행사의 방 응답을 등록한다. 운영진(/members)은 시험마다 등록한다.
export function serveEventRooms(
  api: ReturnType<typeof mockApi>,
  councilId: string,
  eventId: string,
  body: EventRoomsResponse = { rooms: [], archived: false },
) {
  const org = `/api/organizations/${councilId}`
  api.on('GET', `${org}/rooms`, () => json(roomList()))
  api.on('GET', `${org}/events/${eventId}/rooms`, () => json(body))
}

// 작업 공간처럼 운영진과 대화 목록을 읽어 행사 화면에 넘긴다.
export function WithChat({
  councilId,
  children,
}: {
  councilId: string
  children: (chat: Pick<RoomPage, 'team' | 'rooms'>) => ReactNode
}) {
  const team = useTeam(councilId, () => {})
  const rooms = useRoomList(councilId, () => {}, true)
  return children({ team, rooms })
}
