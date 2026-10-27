// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { message } from '@/test-support/chat-fixtures'
import { openRecord } from '@/lib/go-to'
import MessageItem from './MessageItem'

vi.mock('@/lib/go-to', () => ({ openRecord: vi.fn() }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const draw = (blocking = true, canRequest = true) =>
  render(
    <ul>
      <MessageItem
        councilId="c1"
        continued={false}
        mine={false}
        message={message('m1', '물품 부탁', {
          made: [
            { kind: 'purchase_request', id: 'p1', title: '생수', blocking },
            { kind: 'expense', id: 'e1', title: '간식비', blocking },
          ],
        })}
        canRequest={canRequest}
        onRequest={vi.fn()}
        canWriteExpense={canRequest}
        onWriteExpense={vi.fn()}
      />
    </ul>,
  )

test('만들 권한이 없어도 서버가 준 연결 기록은 제목으로 열 수 있다', () => {
  draw(true, false)
  fireEvent.click(screen.getByRole('button', { name: '구매 요청 · 생수' }))
  expect(openRecord).toHaveBeenCalledWith('purchases', 'c1', 'p1')
  fireEvent.click(screen.getByRole('button', { name: '지출 · 간식비' }))
  expect(openRecord).toHaveBeenCalledWith('expenses', 'c1', 'e1')
})

test('활성 기록이 있으면 만들기 대신 기존 기록 보기 메뉴를 제공한다', () => {
  draw()
  fireEvent.keyDown(screen.getByRole('button', { name: '메시지 동작' }), { key: 'Enter' })
  fireEvent.click(screen.getByRole('menuitem', { name: '구매 요청 보기' }))
  expect(openRecord).toHaveBeenCalledWith('purchases', 'c1', 'p1')
  expect(screen.queryByRole('menuitem', { name: '구매 요청 만들기' })).toBeNull()
})

test('반려·취소 기록은 남지만 새 요청 만들기를 다시 허용한다', () => {
  draw(false)
  expect(screen.getByRole('button', { name: '구매 요청 · 생수' })).toBeTruthy()
  fireEvent.keyDown(screen.getByRole('button', { name: '메시지 동작' }), { key: 'Enter' })
  expect(screen.getByRole('menuitem', { name: '구매 요청 만들기' })).toBeTruthy()
  expect(screen.getByRole('menuitem', { name: '지출 적기' })).toBeTruthy()
})
