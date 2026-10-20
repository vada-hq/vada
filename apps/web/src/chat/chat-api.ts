import {
  MarkNoticeSchema,
  OpenDirectSchema,
  statusOf,
  type ChatMessage,
  type OpenDirectResponse,
  type SendMessageRequest,
} from '@vada/contracts'
import { SEND_ERRORS, STORAGE_NOT_CONFIGURED } from '@/lib/messages'

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

// 글 보내기의 본문과 응답은 계약의 것이다(`SendMessageSchema`).
type SendBody = SendMessageRequest

// ---- 사진: 조각 6(서버)과 맞출 임시 모양. 조각 6이 계약에 넣으면 이 블록을 계약 타입으로 바꾼다. ----
// 올리기 주소 받기 `POST rooms/:roomId/uploads`: 파일 이름을 보내면 서버가 정한 키와 10분짜리 올리기 주소(서명 PUT)를 준다.
export const uploadsPath = (councilId: string, roomId: string) =>
  `${roomPath(councilId, roomId)}/uploads`
export type UploadBody = { name: string }
export type UploadResponse = { key: string; url: string }
// 사진을 붙인 보내기: 올리고 받은 키와 이름을 `photos`에 싣는다. 사진만이면 본문은 빈 글이다.
type PhotoRef = { key: string; name: string }
export type SendWithPhotosBody = SendBody & { photos?: PhotoRef[] }
// 메시지에 붙어 오는 사진. 보기는 `GET files/:fileId`(참여자에게 5분 서명 주소로 302)다.
export type ChatPhoto = { id: string; name: string }
export const photosOf = (message: ChatMessage): ChatPhoto[] =>
  (message as ChatMessage & { photos?: ChatPhoto[] }).photos ?? []
export const filePath = (councilId: string, fileId: string) =>
  `${chatBase(councilId)}/files/${encodeURIComponent(fileId)}`
// 저장소 값이 없을 때의 상태. 계약 오류 목록에는 아직 없고, 5xx는 `api.ts`가 코드를 'FAILED'로 바꾸므로 상태로 가른다.
const STORAGE_UNAVAILABLE_STATUS = 503

// 보내기·올리기 실패의 문구. 503은 사진 저장소가 없는 것이다.
export function sendErrorText(result: { status: number; code: string }, fallback: string) {
  if (result.status === STORAGE_UNAVAILABLE_STATUS) return STORAGE_NOT_CONFIGURED
  return SEND_ERRORS[result.code] ?? fallback
}
