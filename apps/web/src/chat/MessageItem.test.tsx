// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { message } from '@/test-support/chat-fixtures'
import MessageItem from './MessageItem'

afterEach(cleanup)

const KKIRUK = message(
  'k1',
  '가을 축제 일시가 바뀌었어요 · 11월 5일 (목) 14:00 → 11월 6일 (금) 14:00\n가을 축제 장소가 바뀌었어요 · 대운동장 → 체육관',
  { senderId: null, senderName: null },
)
const draw = (item = KKIRUK) =>
  render(
    <ul>
      <MessageItem
        councilId="c1"
        message={item}
        continued={false}
        mine={false}
        canRequest
        onRequest={() => {}}
        canWriteExpense
        onWriteExpense={() => {}}
      />
    </ul>,
  )

// 025 조각 4: 보낸 사람 없는 끼룩이 글은 와이어프레임의 시스템 글처럼 가운데 한 덩어리이고, 사람 이름·말풍선·메뉴가 없다.
test('보낸 사람 없는 글은 끼룩이 글로 그리고 이름과 메시지 동작이 없다', () => {
  draw()
  const item = screen.getByRole('listitem')
  expect(item.textContent).toContain('가을 축제 장소가 바뀌었어요 · 대운동장 → 체육관')
  expect(screen.queryByText('시스템')).toBeNull()
  expect(screen.queryByRole('button', { name: '메시지 동작' })).toBeNull()
  // 끼룩이 그림은 꾸밈이라 글만 읽힌다.
  expect(item.querySelector('img')?.getAttribute('alt')).toBe('')
  expect(item.className).toContain('justify-center')
  // 두 줄은 줄바꿈 그대로다.
  expect(screen.getByText(/일시가 바뀌었어요/).className).toContain('whitespace-pre-wrap')
})

test('사람이 보낸 글은 그대로 이름과 메시지 동작이 있다', () => {
  draw(message('m1', '현수막 2개 사 주세요'))
  expect(screen.getByText('이재정')).toBeTruthy()
  expect(screen.getByRole('button', { name: '메시지 동작' })).toBeTruthy()
  expect(screen.getByRole('listitem').querySelector('img')).toBeNull()
})
