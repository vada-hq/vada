import { statusOf } from '@vada/contracts'

// 새 메시지가 보이기까지의 최대 시간(기능 003: 3초 안에).
export const CHAT_POLL_MS = 3000
// 방 목록(안 읽은 수, 공지)은 열린 방보다 느리게 다시 읽는다(기능 003: 목록 15초, 열린 방 3초).
export const CHAT_LIST_POLL_MS = 15_000

export const chatBase = (councilId: string) => `/api/organizations/${encodeURIComponent(councilId)}`
export const roomPath = (councilId: string, roomId: string) =>
  `${chatBase(councilId)}/rooms/${encodeURIComponent(roomId)}`

// 방을 잃은 것으로 보는 응답: 로그인이 풀렸거나(401), 참여자가 아니거나(403), 방이 없다(404).
export const isRoomLost = (status: number) =>
  status === statusOf('UNAUTHENTICATED') ||
  status === statusOf('FORBIDDEN') ||
  status === statusOf('NOT_FOUND')

// 공지 붙이기·떼기(`POST messages/:messageId/notice`)와 1:1 열기(`POST direct`)의 본문과 응답. 기능 003 조각 4가 계약으로 정한다.
export const noticePath = (councilId: string, messageId: string) =>
  `${chatBase(councilId)}/messages/${encodeURIComponent(messageId)}/notice`
export const directPath = (councilId: string) => `${chatBase(councilId)}/direct`
export type NoticeBody = { isNotice: boolean }
export type DirectBody = { memberId: string }
export type DirectResponse = { roomId: string }
