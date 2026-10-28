import { expect, test } from 'vitest'
import { message, room } from '@/test-support/chat-fixtures'
import { appended, refreshed, type RoomState } from './room-state'

const deleted = message('a1', '', {
  body: null,
  photos: [],
  deletedAt: '2026-10-28T00:00:00Z',
  made: [{ id: 'e1', kind: 'expense', title: '옛 제목', blocking: true }],
})
const state: RoomState = {
  kind: 'ready',
  room: room('r1'),
  participants: [],
  messages: [deleted],
  hasOlder: false,
}

test.each([
  ['refreshed', refreshed],
  ['appended', appended],
] as const)('%s는 삭제된 메시지의 이름과 연결 기록을 서버 값으로 갱신한다', (_name, merge) => {
  const latest = {
    ...deleted,
    senderName: '떠난 운영진 2',
    made: [{ id: 'e1', kind: 'expense' as const, title: '새 제목', blocking: false }],
  }
  const result = merge(state, [latest])
  expect(result.kind === 'ready' && result.messages).toEqual([latest])
})

test('늦은 응답의 이름과 연결 기록은 갱신하되 삭제된 본문·사진·시각은 되돌리지 않는다', () => {
  const latest = message('a1', '삭제 전 본문', {
    senderName: '떠난 운영진 2',
    photos: [{ id: 'f1' }],
    made: [{ id: 'e1', kind: 'expense', title: '새 제목', blocking: false }],
  })
  const result = refreshed(state, [latest])
  expect(result.kind === 'ready' && result.messages).toEqual([
    { ...latest, body: null, photos: [], deletedAt: deleted.deletedAt },
  ])
})
