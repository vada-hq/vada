import { z } from 'zod'
import { text, token, UUID_LENGTH } from './input.js'
import { recordIdInput } from './team.js'

// 대화 칸의 길이 상한. DB CHECK(message.body, file.name)와 같은 값이다(기능 003).
export const MESSAGE_BODY_MAX = 2000
export const FILE_NAME_MAX = 200

// 방의 종류. DB CHECK(chat_room.type)와 같은 값이다.
export const ROOM_TYPES = [
  'all_members',
  'leadership',
  'department',
  'direct',
  'inter_department',
] as const
export type RoomType = (typeof ROOM_TYPES)[number]

// 메시지 한 쪽의 크기와 공지를 보이는 개수(기능 003). 서버가 정하고 화면은 다시 적지 않는다.
export const MESSAGE_PAGE_SIZE = 50
export const RECENT_NOTICE_COUNT = 3
export const NOTICE_LIST_MAX = 100

export interface ChatMessage {
  id: string
  // 보낸 운영진. 시스템이 만든 메시지는 비어 있다.
  senderId: string | null
  senderName: string | null
  body: string
  sentAt: string
  isNotice: boolean
}

export interface RoomSummary {
  id: string
  type: RoomType
  // 부서방은 부서 이름, 1:1은 상대 이름. 나머지는 화면이 종류로 이름을 붙인다.
  name: string | null
  departmentId: string | null
  // 상대가 학생회를 떠난 1:1처럼 보기만 되는 방
  readOnly: boolean
  // 내가 읽은 뒤 남이 보낸 메시지 수와, 그중 나를 부른 수
  unread: number
  mentions: number
  lastMessageAt: string | null
}

export interface RoomListResponse {
  rooms: RoomSummary[]
  // 같은 기수의 최근 공지. 들어오기 전 것도 있다(DEC-48).
  notices: ChatMessage[]
  unreadTotal: number
  mentionTotal: number
}

export interface RoomParticipant {
  memberId: string
  name: string
}
export interface RoomDetailResponse {
  room: RoomSummary
  participants: RoomParticipant[]
}

// 들어온 뒤의 메시지 한 쪽. 오래된 것부터 담긴다. 커서가 없으면 가장 최근 쪽이다.
export interface MessagePageResponse {
  messages: ChatMessage[]
  hasOlder: boolean
  hasNewer: boolean
}
export interface NoticeListResponse {
  notices: ChatMessage[]
}

// 읽음 표시: 이 메시지까지 읽었다. 뒤로 가지 않는다.
export const ReadMarkerSchema = z.strictObject({ messageId: recordIdInput })

// 메시지 쪽 읽기의 쿼리. 커서는 메시지 번호이고, 형식과 방은 서버가 본다(INVALID_CURSOR).
export const MessagePageQuerySchema = z
  .strictObject({
    before: token(UUID_LENGTH).optional(),
    after: token(UUID_LENGTH).optional(),
  })
  .refine(value => value.before === undefined || value.after === undefined)

// 한 메시지에서 부를 수 있는 사람 수. 이 수를 넘으면 400이다(Discord와 같다).
export const MENTION_MAX = 50

// 보내기: 본문 그대로("@이름"을 적은 채)와 부른 사람의 운영진 번호. 참여자가 아니거나 나이거나 없는 번호는 서버가 조용히 뺀다.
export const SendMessageSchema = z.strictObject({
  body: text(MESSAGE_BODY_MAX),
  mentions: z.array(recordIdInput).max(MENTION_MAX).default([]),
})
export type SendMessageRequest = z.input<typeof SendMessageSchema>

// 공지 표시를 붙이거나 뗀다. 같은 값이면 아무것도 바뀌지 않는다.
export const MarkNoticeSchema = z.strictObject({ isNotice: z.boolean() })

// 1:1 열기. 이미 있으면 그 방을 돌려준다.
export const OpenDirectSchema = z.strictObject({ memberId: recordIdInput })
export interface OpenDirectResponse {
  roomId: string
}
