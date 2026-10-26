import { z } from 'zod'
import { EmptyRequestSchema, text, token, UUID_LENGTH } from './input.js'
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

// 메시지 한 쪽의 크기(기능 003). 서버가 정하고 화면은 다시 적지 않는다.
export const MESSAGE_PAGE_SIZE = 50

// 사진 한 장 10MB, 한 메시지 10장, 형식은 JPEG(DEC-50). 휴대폰이 줄여 올리고 서버는 저장소에서 크기와 형식을 확인한다.
const BYTES_PER_MB = 1_048_576
const PHOTO_MAX_MB = 10
export const PHOTO_MAX_BYTES = PHOTO_MAX_MB * BYTES_PER_MB
export const PHOTO_MAX_COUNT = 10
export const PHOTO_MEDIA_TYPE = 'image/jpeg'
// 사진 키 `chat/{학생회}/{운영진}/{번호}`의 길이 상한(uuid 셋과 글자 일곱)
export const PHOTO_KEY_MAX = 128

export interface ChatPhoto {
  // 사진 보기 주소(`files/:fileId`)의 번호
  id: string
}

// 증빙으로 고를 대화 사진 목록의 상한(기능 011). 넘치면 truncated다.
export const CHAT_PHOTO_LIST_MAX = 60

// 고를 수 있는 대화 사진 한 장. 방 이름은 부서방·1:1만 있고 나머지는 화면이 종류로 이름을 붙인다.
interface ChatPhotoChoice {
  id: string
  messageId: string
  room: { id: string; type: RoomType; name: string | null }
  senderId: string | null
  senderName: string | null
  sentAt: string
}
export interface ChatPhotoListResponse {
  photos: ChatPhotoChoice[]
  truncated: boolean
}

// 지운 메시지(DEC-54)의 자리. 서버가 만드는 방 줄 미리보기와 화면의 대화 흐름·업무 결과물이 같은 말을 한다.
export const DELETED_MESSAGE = '삭제된 메시지'

// 메시지 아래 기록 하나. blocking: 같은 메시지로 같은 종류의 새 기록을 막는다(반려·취소가 아닌 요청, 취소되지 않은 지출,
// 022 정한 것 23). 화면은 막힌 메뉴 자리에 '구매 요청 보기'·'지출 보기'를 보인다.
export interface MadeRecord {
  kind: 'purchase_request' | 'expense'
  id: string
  title: string
  blocking: boolean
}

export interface ChatMessage {
  id: string
  // 보낸 운영진. 시스템이 만든 메시지는 비어 있다.
  senderId: string | null
  senderName: string | null
  // 지운 메시지(DEC-54)는 본문이 null이고 사진이 없으며 지운 시각이 있다. 화면은 그 자리에 '삭제된 메시지'를 보인다.
  body: string | null
  sentAt: string
  deletedAt: string | null
  photos: ChatPhoto[]
  // 이 메시지를 근거로 만든 구매 요청(제목)과 지출(내역), 만든 차례(DEC-71, DEC-90). 보는 사람이 읽을 수 있는 기록만 싣는다.
  made: MadeRecord[]
  // 원글에 달린 답글 가운데 내가 볼 수 있는 것의 수와 마지막 답글 시각(DEC-90). 답글 자신과 답글 없는 원글은 0과 null이다.
  replyCount: number
  lastReplyAt: string | null
}

export interface RoomSummary {
  id: string
  // all_members는 공지방이다(DEC-90). 공지는 공지방에 보낸 메시지다.
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
  // 내가 볼 수 있는 마지막 메시지(DEC-20, DEC-90): 보낸 사람과 첫 줄 앞 100자(사진만이면 '사진'). 볼 메시지가 없으면 null.
  lastMessage: { senderName: string | null; preview: string } | null
  // 방 참여 인원(참여자 목록과 같은 수)
  memberCount: number
  // 행사 방(DEC-90)은 그 행사의 번호와 이름, 학생회 방과 1:1은 null이다. 화면은 '{행사 이름} 공지방', '{행사 이름} {부서 이름} 방'으로 부른다.
  // 서버는 늘 채운다. 선택 칸인 것은 이 칸을 모르는 화면 시험 자료(home/)가 고쳐지기 전까지다(022 조각 8 보고).
  eventId?: string | null
  eventName?: string | null
}

export interface RoomListResponse {
  rooms: RoomSummary[]
  unreadTotal: number
  mentionTotal: number
}

// 행사 메시지 탭의 방(GET .../events/:eventId/rooms): 그 행사의 공지방과 내 부서방이다. 메시지가 없어도 있다.
// 완료한 행사는 보관이라 읽기만 되고(archived) 방마다 readOnly다(DEC-83, DEC-90).
export interface EventRoomsResponse {
  rooms: RoomSummary[]
  archived: boolean
}

export interface RoomParticipant {
  memberId: string
  name: string
}
export interface RoomDetailResponse {
  room: RoomSummary
  participants: RoomParticipant[]
}

// 내가 볼 수 있는 메시지 한 쪽(들어온 뒤의 것, 공지방은 같은 기수의 들어오기 전 것도, DEC-90). 오래된 것부터 담긴다. 커서가 없으면 가장 최근 쪽이다.
// 방 흐름(GET .../messages)에는 원글만 있다. 답글은 원글을 열어 읽는다(DEC-90).
export interface MessagePageResponse {
  messages: ChatMessage[]
  hasOlder: boolean
  hasNewer: boolean
}

// 원글 하나와 그 답글 한 쪽(GET .../rooms/:roomId/messages/:messageId/replies). 커서는 방 흐름과 같고(MessagePageQuerySchema)
// 답글 번호다. 쪽 안은 보낸 순이다. 원글이 내게 보이지 않거나 답글이면 404다.
export interface ReplyPageResponse extends MessagePageResponse {
  original: ChatMessage
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
// 사진은 올리기 주소로 받은 키다. 사진만 보내면 본문을 비운다(없으면 빈 글).
export const SendMessageSchema = z
  .strictObject({
    body: text(MESSAGE_BODY_MAX).optional(),
    mentions: z.array(recordIdInput).max(MENTION_MAX).default([]),
    photos: z.array(token(PHOTO_KEY_MAX)).max(PHOTO_MAX_COUNT).default([]),
    // 이 메시지를 공지 결과물로 이을 업무(기능 015). 공지방에 보낼 때만 받고 아니면 서버가 400이다(DEC-90).
    taskId: recordIdInput.nullish(),
    // 답글이면 원글 번호(DEC-90). 같은 방의, 내가 볼 수 있는 원글이어야 하고 답글에는 답글을 달지 않는다(서버가 404·400).
    replyTo: recordIdInput.nullish(),
  })
  .refine(value => value.body !== undefined || value.photos.length > 0)
  // 업무의 공지 결과물은 공지방 흐름에 보이는 원글이라 답글로 잇지 않는다.
  .refine(value => !(value.taskId && value.replyTo))
  .refine(value => new Set(value.photos).size === value.photos.length)
export type SendMessageRequest = z.input<typeof SendMessageSchema>

// 사진 올리기 주소 받기. 보낼 값이 없다.
export const CreatePhotoUploadSchema = EmptyRequestSchema
export interface PhotoUploadResponse {
  // 보낼 때 이 키를 photos에 넣는다.
  key: string
  url: string
  // 올릴 때 그대로 붙이는 머리
  headers: Record<string, string>
  expiresAt: string
}

// 1:1 열기. 이미 있으면 그 방을 돌려준다.
export const OpenDirectSchema = z.strictObject({ memberId: recordIdInput })
export interface OpenDirectResponse {
  roomId: string
}
