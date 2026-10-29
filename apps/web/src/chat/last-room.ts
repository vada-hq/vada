import type { RoomListResponse } from '@vada/contracts'
import { councilRooms, firstRoomOf } from './space-rooms'

// 기기가 학생회마다 마지막에 연 학생회 방을 기억한다(US-MSG-01).
// 저장소를 못 쓰는 브라우저(사생활 보호 모드 등)에서는 조용히 기억하지 않고 첫 방을 연다.
const PREFIX = 'vada.chat.room.'
const DIRECT_PREFIX = 'vada.chat.direct-tab.'
// 열쇠가 있으면 칸이 열려 있다. 값은 칸에 연 1:1이고, null이면 1:1 목록이다.
const sidePanels = new Map<string, string | null>()

// 열린 칸은 로그인한 사람·학생회마다 메모리에만 둔다. 쓰던 글과 같이 기기 저장소에는 남기지 않는다.
// 그래서 같은 탭에서 방·메뉴를 오가도 열린 채이고, 새로 들어오면 닫혀 있다.
export const savedSideRoom = (councilId: string, meId: string) =>
  sidePanels.get(`${councilId}:${meId}`) ?? null

export const savedSideOpen = (councilId: string, meId: string) =>
  sidePanels.has(`${councilId}:${meId}`)

export function saveSideRoom(
  councilId: string,
  meId: string,
  roomId: string | null,
  open = roomId !== null,
) {
  const key = `${councilId}:${meId}`
  if (open) sidePanels.set(key, roomId)
  else sidePanels.delete(key)
}

// 휴대폰 '1:1' 탭 기억은 기기를 돌려 쓰는 다른 운영진에게 이어지지 않게 사람마다 둔다.
// 사람이 없던 옛 열쇠는 누구의 선택인지 몰라 읽지 않는다(한 번 학생회 방 탭으로 열릴 뿐이다).
const directKey = (councilId: string, meId: string) => `${DIRECT_PREFIX}${councilId}:${meId}`

export function savedDirectTab(councilId: string, meId: string) {
  try {
    return window.localStorage.getItem(directKey(councilId, meId)) === 'true'
  } catch {
    return false
  }
}

export function saveDirectTab(councilId: string, meId: string, direct: boolean) {
  try {
    window.localStorage.setItem(directKey(councilId, meId), String(direct))
  } catch {
    // 저장소가 막혔으면 다음에는 학생회 방 탭을 연다.
  }
}

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
