import type { EventRoomsResponse } from '@vada/contracts'
import { chatBase } from './chat-api'
import { useRoomsAt } from './useRoomList'

// 행사 메시지 탭의 방(022 조각 8의 GET .../events/:eventId/rooms): 그 행사의 공지방과 내 부서방, 보관 여부.
// 메시지가 없어도 방이 있다. 대화 목록처럼 보이는 동안 다시 읽어 방마다 안 읽은 수를 맞춘다.
export function useEventRooms(councilId: string, eventId: string, onForbidden: () => void) {
  const path = `${chatBase(councilId)}/events/${encodeURIComponent(eventId)}/rooms`
  return useRoomsAt<EventRoomsResponse>(path, onForbidden, true)
}
export type EventRooms = ReturnType<typeof useEventRooms>
