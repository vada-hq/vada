// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { message } from '@/test-support/chat-fixtures'
import MessageItem from './MessageItem'

afterEach(cleanup)

const show = (mine: boolean) =>
  render(
    <ul>
      <MessageItem
        councilId="c1"
        message={message('a1', '이거 사 주세요 https://example.com/a')}
        continued={false}
        mine={mine}
        canRequest={false}
        onRequest={() => {}}
        canWriteExpense={false}
        onWriteExpense={() => {}}
      />
    </ul>,
  )

// 와이어프레임 메시지 화면: 내 말풍선은 오른쪽 파란색에 흰 글자, 남의 말풍선은 흰 바탕에 테두리.
test('내 메시지는 파란 말풍선이고 안의 링크는 같은 흰 글자에 밑줄이다(DEC-90)', () => {
  show(true)
  const link = screen.getByRole('link', { name: 'https://example.com/a' })
  const bubble = link.closest('p')!
  expect(bubble.className).toContain('bg-primary')
  expect(bubble.className).toContain('text-primary-foreground')
  expect(link.className).toContain('underline')
  expect(link.className).not.toContain('text-blue')
  expect(screen.queryByText('이재정')).toBeNull()
})

test('남의 메시지는 이름 아래 테두리 말풍선이고 링크는 파란 글자다', () => {
  show(false)
  const link = screen.getByRole('link', { name: 'https://example.com/a' })
  const bubble = link.closest('p')!
  expect(bubble.className).toContain('border')
  expect(bubble.className).not.toContain('bg-primary')
  expect(link.className).toContain('text-blue')
  expect(screen.getByText('이재정')).toBeTruthy()
})
