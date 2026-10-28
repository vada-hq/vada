import type { RoomSummary } from '@vada/contracts'

export const MESSAGE_INPUT_HINT = '메시지 입력 · @ 부르기'
export const sendToRoom = (name: string) => `${name}에 보내기`

export function councilRoomScope(room: RoomSummary) {
  if (room.type === 'all_members') return '학생회 · 모든 운영진'
  if (room.type === 'leadership') return '학생회 · 회장단만 보는 방'
  return `학생회 · ${room.name ?? '부서'}만 보는 방`
}
