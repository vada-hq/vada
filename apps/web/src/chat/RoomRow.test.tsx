// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { RoomSummary } from '@vada/contracts'
import { room } from '@/test-support/chat-fixtures'
import RoomRow from './RoomRow'

afterEach(cleanup)

const now = new Date('2020-03-02T03:00:00Z')
const show = (summary: RoomSummary) =>
  render(
    <ul>
      <RoomRow room={summary} now={now} active={false} onOpen={() => {}} />
    </ul>,
  )

test('방 줄은 이름 아래 마지막 말을 "보낸 사람: 미리보기"로, 그 아래 참여 인원을 보인다(DEC-90)', () => {
  show(
    room('r1', {
      lastMessage: { senderName: '떠난 운영진 2', preview: '사진' },
      memberCount: 12,
      unread: 3,
    }),
  )
  expect(screen.getByLabelText('안 읽은 메시지 3개').className).toContain('bg-red-600')
  const row = screen.getByRole('button', { name: /공지방/ })
  expect(screen.getByText('떠난 운영진 2: 사진')).toBeTruthy()
  expect(screen.getByText('참여 12명')).toBeTruthy()
  expect(row.textContent?.indexOf('공지방')).toBe(0)
})

test('보낸 사람이 없는 메시지는 미리보기만, 볼 메시지가 없으면 마지막 말 줄이 없다', () => {
  show(room('r1', { lastMessage: { senderName: null, preview: '방이 열렸어요' } }))
  expect(screen.getByText('방이 열렸어요')).toBeTruthy()
  cleanup()
  show(room('r2', { type: 'leadership', lastMessage: null, lastMessageAt: null, memberCount: 2 }))
  expect(screen.getByRole('button').textContent).toBe('회장단방참여 2명')
})
