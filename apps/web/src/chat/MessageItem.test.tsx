// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { ChatMessage } from '@vada/contracts'
import { message } from '@/test-support/chat-fixtures'
import MessageItem from './MessageItem'

afterEach(cleanup)

const KKIRUK = message(
  'k1',
  '가을 축제 일시가 바뀌었어요 · 11월 5일 (목) 14:00 → 11월 6일 (금) 14:00\n가을 축제 장소가 바뀌었어요 · 대운동장 → 체육관',
  { senderId: null, senderName: null },
)
const LINKED = message('a1', '이거 사 주세요 https://example.com/a')
const draw = (item: ChatMessage = KKIRUK, mine = false) =>
  render(
    <ul>
      <MessageItem
        councilId="c1"
        message={item}
        continued={false}
        mine={mine}
        canRequest
        onRequest={() => {}}
        canWriteExpense
        onWriteExpense={() => {}}
      />
    </ul>,
  )

// 보낸 사람 없는 글(행사 알림)은 와이어프레임 MSG-03 03의 시스템 글: 가운데 정렬한 작은 회색 글이고,
// 끼룩이 그림·사람 이름·말풍선·메뉴가 없다(notes/chat-redesign 4c).
test('보낸 사람 없는 글은 가운데 회색 글이고 끼룩이 그림과 이름, 메시지 동작이 없다', () => {
  draw()
  const item = screen.getByRole('listitem')
  expect(item.textContent).toContain('가을 축제 장소가 바뀌었어요 · 대운동장 → 체육관')
  expect(screen.queryByText('시스템')).toBeNull()
  expect(screen.queryByRole('button', { name: '메시지 동작' })).toBeNull()
  expect(item.querySelector('img')).toBeNull()
  const text = screen.getByText(/일시가 바뀌었어요/)
  expect(text.className).toContain('text-center')
  expect(text.className).toContain('text-gray-500')
  // 두 줄은 줄바꿈 그대로다.
  expect(text.className).toContain('whitespace-pre-wrap')
})

test('사람이 보낸 글은 그대로 이름과 메시지 동작이 있다', () => {
  draw(message('m1', '현수막 2개 사 주세요'))
  expect(screen.getByText('이재정')).toBeTruthy()
  expect(screen.getByRole('button', { name: '메시지 동작' })).toBeTruthy()
  expect(screen.getByRole('listitem').querySelector('img')).toBeNull()
})

// 와이어프레임 메시지 화면: 내 말풍선은 오른쪽 파란색에 흰 글자, 남의 말풍선은 흰 바탕에 테두리.
test('내 메시지는 파란 말풍선이고 안의 링크는 같은 흰 글자에 밑줄이다(DEC-90)', () => {
  draw(LINKED, true)
  const link = screen.getByRole('link', { name: 'https://example.com/a' })
  const bubble = link.closest('p')!
  expect(bubble.className).toContain('bg-primary')
  expect(bubble.className).toContain('text-primary-foreground')
  expect(link.className).toContain('underline')
  expect(link.className).not.toContain('text-blue')
  expect(screen.queryByText('이재정')).toBeNull()
  expect(screen.queryByText('이')).toBeNull()
})

test('남의 메시지는 이름 첫 글자 얼굴과 이름 아래 테두리 말풍선이고 링크는 파란 글자다', () => {
  draw(LINKED)
  const link = screen.getByRole('link', { name: 'https://example.com/a' })
  const bubble = link.closest('p')!
  expect(bubble.className).toContain('border')
  expect(bubble.className).not.toContain('bg-primary')
  expect(link.className).toContain('text-blue')
  expect(screen.getByText('이재정')).toBeTruthy()
  expect(screen.getByText('이').getAttribute('aria-hidden')).toBe('true')
})

test('탈퇴한 사람의 얼굴은 첫 글자가 아니라 사람 아이콘이다', () => {
  draw(message('m2', '그동안 고마웠어요', { senderName: '떠난 운영진 2' }))
  expect(screen.getByText('떠난 운영진 2')).toBeTruthy()
  expect(screen.queryByText('떠')).toBeNull()
  expect(screen.getByRole('listitem').querySelector('svg.lucide-user')).toBeTruthy()
})

test('남의 글도 고친 시각이 있으면 보낸 시각 옆에 고침을 보인다', () => {
  draw(message('m1', '고친 글', { editedAt: '2026-10-28T01:00:00Z' }))
  expect(screen.getByText('(고침)').className).toContain('text-muted-foreground')
  expect(screen.getByText('(고침)').parentElement?.querySelector('time')).toBeTruthy()
})

test('삭제된 글에는 고침을 보이지 않는다', () => {
  draw(
    message('m1', '', {
      body: null,
      editedAt: '2026-10-28T01:00:00Z',
      deletedAt: '2026-10-28T02:00:00Z',
    }),
  )
  expect(screen.queryByText('(고침)')).toBeNull()
})
