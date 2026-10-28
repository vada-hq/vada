import type { RoomSummary, RoomType } from '@vada/contracts'

// 공간(행사, 우리 학생회)의 메시지 탭이 쓰는 방 고르기(DEC-96: 공간에 무관하게 방 목록과 첫 방을 받는 부품).
// 방 탭의 배치는 공지방 → 회장단방 → 부서방이다. 처음 여는 방의 차례와는 다르다(US-MSG-01·DEC-90).
const SWITCH_ORDER: RoomType[] = ['all_members', 'leadership', 'department']

// 역할을 다시 판단하지 않고 서버가 준 방의 자리만 나눈다. 1:1·부서 간 방은 전체 목록에서 연다.
export const councilRooms = (rooms: RoomSummary[]) =>
  rooms.filter(room => !room.eventId && SWITCH_ORDER.includes(room.type))

export const switchRooms = (rooms: RoomSummary[]) =>
  SWITCH_ORDER.flatMap(type => rooms.filter(room => room.type === type))

// 처음 여는 방: 회장단방, 없으면 첫 부서방, 없으면 공지방(DEC-90 첫 방 차례, DEC-96 '탭을 열면 부서방부터').
// 행사에는 회장단방이 없어 내 부서방, 부서가 없으면 공지방이다.
const FIRST_ORDER: RoomType[] = ['leadership', 'department', 'all_members']

export function firstRoomOf(rooms: RoomSummary[]) {
  for (const type of FIRST_ORDER) {
    const found = rooms.find(room => room.type === type)
    if (found) return found
  }
  return null
}

// 주소가 고른 방이 이 공간의 방이면 그 방, 아니면 처음 여는 방이다(주소는 볼 권한을 주지 않는다, PRIN-5).
export const shownRoomOf = (rooms: RoomSummary[], wanted: string | null) =>
  rooms.find(room => room.id === wanted) ?? firstRoomOf(rooms)

// 탭 배지: 그 공간 방들의 안 읽은 수 합(DEC-90 '탭 배지는 공지방과 내 부서방의 안 읽은 수').
export const unreadSum = (rooms: RoomSummary[]) => rooms.reduce((sum, room) => sum + room.unread, 0)
