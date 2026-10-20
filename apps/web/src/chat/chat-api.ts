import {
  MarkNoticeSchema,
  OpenDirectSchema,
  statusOf,
  type OpenDirectResponse,
} from '@vada/contracts'
import { SEND_ERRORS } from '@/lib/messages'

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

// 공지 붙이기·떼기(`POST messages/:messageId/notice`)와 1:1 열기(`POST direct`)의 본문과 응답은 계약의 것이다.
export const noticePath = (councilId: string, messageId: string) =>
  `${chatBase(councilId)}/messages/${encodeURIComponent(messageId)}/notice`
export const directPath = (councilId: string) => `${chatBase(councilId)}/direct`
export type NoticeBody = ReturnType<typeof MarkNoticeSchema.parse>
export type DirectBody = ReturnType<typeof OpenDirectSchema.parse>
export type DirectResponse = OpenDirectResponse

export const messagesPath = (councilId: string, roomId: string) =>
  `${roomPath(councilId, roomId)}/messages`

// 올리기 주소 받기 `POST rooms/:roomId/uploads`(본문 없음): 서버가 정한 키와 올리기 주소(서명 PUT)를 준다.
export const uploadsPath = (councilId: string, roomId: string) =>
  `${roomPath(councilId, roomId)}/uploads`
// 사진 보기 `GET files/:fileId`는 참여자에게 서명 주소로 302한다.
export const filePath = (councilId: string, fileId: string) =>
  `${chatBase(councilId)}/files/${encodeURIComponent(fileId)}`

// 보내기·올리기 실패의 문구. 사진 저장소가 없을 때만 그 문구고, 다른 503(배포 중 등)은 일반 문구다.
export const sendErrorText = (result: { code: string }, fallback: string) =>
  SEND_ERRORS[result.code] ?? fallback
