import type { RoomListResponse } from '@vada/contracts'

// 기기가 학생회마다 마지막에 연 방을 기억한다. PC에서 대화를 누르면 그 방부터 보이기 위해서다(Slack 마지막 채널).
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

// 열어 둘 방: 기억한 방이 아직 목록에 있으면 그 방, 아니면 1:1이 아닌 첫 방(서버 순서상 전체방).
export function roomToShow(data: RoomListResponse, saved: string | null): string | null {
  const rooms = data.rooms
  if (saved !== null && rooms.some(room => room.id === saved)) return saved
  return (rooms.find(room => room.type !== 'direct') ?? rooms[0])?.id ?? null
}
