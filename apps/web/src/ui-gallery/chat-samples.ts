import type { RoomSummary } from '@vada/contracts'
import { longName, unbroken } from './sample-text'

// 메시지 시안의 방 목록 예시 데이터. 학생회 방·부서방·1:1과 긴 이름을 함께 둔다.
export const DIRECT_ID = '0199d1a0-0000-7000-8000-0000000000a9'

export const chatRoom = (id: string, extra: Partial<RoomSummary>): RoomSummary => ({
  id,
  type: 'all_members',
  name: null,
  departmentId: null,
  readOnly: false,
  unread: 0,
  mentions: 0,
  lastMessageAt: '2026-10-23T03:00:00.000Z',
  lastMessage: null,
  memberCount: 3,
  ...extra,
})

export const ROOMS = [
  chatRoom('all', {
    unread: 12,
    mentions: 1,
    memberCount: 24,
    lastMessage: { senderName: '김바다', preview: `이번 주 정기 회의는 목요일 18:00 ${longName}` },
  }),
  chatRoom('lead', { type: 'leadership', lastMessageAt: null, memberCount: 2 }),
  chatRoom('plan', {
    type: 'department',
    name: '기획부',
    departmentId: 'd1',
    unread: 120,
    lastMessage: { senderName: '박해랑', preview: unbroken },
  }),
  chatRoom('photo', {
    type: 'department',
    name: unbroken,
    departmentId: 'd2',
    lastMessageAt: '2026-10-20T03:00:00.000Z',
    lastMessage: { senderName: '정하늘', preview: '사진' },
  }),
  chatRoom('gone', {
    type: 'direct',
    name: '떠난 운영진 2',
    readOnly: true,
    memberCount: 2,
    lastMessage: { senderName: '떠난 운영진 2', preview: '그동안 고마웠어요' },
  }),
]
