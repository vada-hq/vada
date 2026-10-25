import type {
  ChatMessage,
  MessagePageResponse,
  RoomDetailResponse,
  RoomListResponse,
  RoomSummary,
} from '@vada/contracts'

// 대화 화면 시험이 같이 쓰는 응답. 시각은 먼 과거라 시험을 돌리는 날과 상관없이 연도가 붙은 날짜로 보인다.
export const message = (
  id: string,
  body: string,
  options: Partial<ChatMessage> = {},
): ChatMessage => ({
  id,
  senderId: 'm2',
  senderName: '이재정',
  body,
  sentAt: '2020-03-02T01:30:00Z',
  photos: [],
  ...options,
})

export const room = (id: string, options: Partial<RoomSummary> = {}): RoomSummary => ({
  id,
  type: 'all_members',
  name: null,
  departmentId: null,
  readOnly: false,
  unread: 0,
  mentions: 0,
  lastMessageAt: '2020-03-02T01:30:00Z',
  lastMessage: null,
  memberCount: 3,
  ...options,
})

// 공지방(안 읽은 3, 나를 부름, 마지막 말), 회장단방, 재정부, 상대가 떠난 1:1. 서버가 정한 순서다.
export function roomList(options: Partial<RoomListResponse> = {}): RoomListResponse {
  return {
    rooms: [
      room('r1', {
        unread: 3,
        mentions: 1,
        lastMessage: { senderName: '이재정', preview: '회의록 올렸어요' },
        memberCount: 12,
      }),
      room('r2', { type: 'leadership', lastMessageAt: null }),
      room('r3', { type: 'department', name: '재정부', departmentId: 'd1' }),
      room('r4', { type: 'direct', name: '박새내', readOnly: true }),
    ],
    unreadTotal: 3,
    mentionTotal: 1,
    ...options,
  }
}

export const roomDetail = (summary: RoomSummary = room('r1')): RoomDetailResponse => ({
  room: summary,
  participants: [
    { memberId: 'm1', name: '김회장' },
    { memberId: 'm2', name: '이재정' },
  ],
})

export const messagePage = (
  messages: ChatMessage[] = [message('a1', '안녕하세요'), message('a2', '모레 회의 있어요')],
  options: Partial<MessagePageResponse> = {},
): MessagePageResponse => ({ messages, hasOlder: false, hasNewer: false, ...options })
