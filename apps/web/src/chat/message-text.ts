import type { RoomSummary } from '@vada/contracts'

export const MENTION_INPUT_HINT = '메시지 입력 · @ 부르기'
export const MESSAGE_INPUT_HINT = `${MENTION_INPUT_HINT} · / 1:1 대화`
export const sendToRoom = (name: string) => `${name}에 보내기`
export const sendToPerson = (name: string) => `${name}님에게 보내기`
export const directTitle = (name: string) => `${name}님과 1:1`
export const directNameLabel = (name: string) => `${name}님과 1:1 대화`
export const DIRECT_LIST_TITLE = '1:1'
export const DIRECT_EMPTY = '1:1 대화 없음'
export const DIRECT_START = '1:1 대화 시작'
export const DIRECT_PEOPLE_LABEL = '1:1 대화 상대'
export const DIRECT_PEOPLE_EMPTY = '운영진 없음'
export const DIRECT_ROOMS_LABEL = '1:1 대화방'

export function councilRoomScope(room: RoomSummary) {
  if (room.type === 'all_members') return '학생회 · 모든 운영진'
  if (room.type === 'leadership') return '학생회 · 회장단만 보는 방'
  return `학생회 · ${room.name ?? '부서'}만 보는 방`
}
