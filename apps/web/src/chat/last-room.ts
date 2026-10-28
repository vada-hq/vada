import type { RoomListResponse } from '@vada/contracts'
import { councilRooms, firstRoomOf } from './space-rooms'

// 기기가 학생회마다 마지막에 연 학생회 방을 기억한다(US-MSG-01).
// 저장소를 못 쓰는 브라우저(사생활 보호 모드 등)에서는 조용히 기억하지 않고 첫 방을 연다.
const PREFIX = 'vada.chat.room.'

export function savedRoom(councilId: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + councilId)
  } catch {
    return null
  }
}

export function saveRoom(councilId: string, roomId: string) {
  try {
    window.localStorage.setItem(PREFIX + councilId, roomId)
  } catch {
    // 가득 찼거나 막혔다. 다음에 첫 방이 열릴 뿐이다.
  }
}

// 옛 기기가 기억한 1:1·행사 방은 첫 화면의 탭이 아니다. 첫 방 차례는 행사와 같은 firstRoomOf를 쓴다(DEC-90).
export function roomToShow(data: RoomListResponse, saved: string | null): string | null {
  const rooms = councilRooms(data.rooms)
  if (saved !== null && rooms.some(room => room.id === saved)) return saved
  return firstRoomOf(rooms)?.id ?? null
}
