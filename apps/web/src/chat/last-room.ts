import type { RoomListResponse, RoomType } from '@vada/contracts'

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

// 기억한 방이 없을 때 먼저 열 방의 차례(DEC-90): 회장단방, 내 부서방, 공지방. 목록에는 내가 든 방만 있고
// 회장단방은 학생회 직급, 부서방은 부서 소속이 있어야 들므로(DEC-18) 목록만 보고 고른다.
// 공지방을 먼저 열지 않는 것은 잡담이 공지방에 쌓여 공지가 묻히지 않게 하려는 것이다(DEC-90 '공지가 묻히는 위험').
const FIRST_ROOMS: RoomType[] = ['leadership', 'department', 'all_members']

// 열어 둘 방: 기억한 방이 아직 목록에 있으면 그 방, 아니면 위 차례의 첫 방(같은 종류는 서버 순서), 그것도 없으면 첫 방.
export function roomToShow(data: RoomListResponse, saved: string | null): string | null {
  // 행사 방은 전체 목록에 남지만 제 행사 탭에서 연다(v7 MSG-01). 자동 선택으로 메뉴를 떠나지 않게 한다.
  const rooms = data.rooms.filter(room => !room.eventId)
  if (saved !== null && rooms.some(room => room.id === saved)) return saved
  for (const type of FIRST_ROOMS) {
    const found = rooms.find(room => room.type === type)
    if (found) return found.id
  }
  return rooms[0]?.id ?? null
}
