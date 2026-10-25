// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { message } from '@/test-support/chat-fixtures'
import { DELETED_MESSAGE } from '@vada/contracts'
import MessageItem from './MessageItem'

afterEach(cleanup)

const actions = {
  canRequest: true,
  onRequest: () => {},
  canWriteExpense: true,
  onWriteExpense: () => {},
}

// 지운 메시지(DEC-54): 그 자리에 '삭제된 메시지'만 남고, 사진과 메시지 메뉴(구매 요청·지출 적기)가 없다.
test.each([false, true])('지운 메시지는 삭제된 메시지로 보이고 메뉴가 없다(내 메시지 %s)', mine => {
  render(
    <ul>
      <MessageItem
        councilId="c1"
        message={message('m1', '', {
          body: null,
          deletedAt: '2020-03-03T01:30:00Z',
          photos: [],
        })}
        continued={false}
        mine={mine}
        {...actions}
      />
    </ul>,
  )
  expect(screen.getByText(DELETED_MESSAGE)).toBeTruthy()
  expect(screen.queryByRole('button', { name: '메시지 동작' })).toBeNull()
  expect(screen.queryByRole('img')).toBeNull()
})

test('지우지 않은 메시지는 본문과 메뉴가 그대로다', () => {
  render(
    <ul>
      <MessageItem
        councilId="c1"
        message={message('m1', '현수막 사 주세요')}
        continued={false}
        mine={false}
        {...actions}
      />
    </ul>,
  )
  expect(screen.getByText('현수막 사 주세요')).toBeTruthy()
  expect(screen.queryByText(DELETED_MESSAGE)).toBeNull()
  expect(screen.getByRole('button', { name: '메시지 동작' })).toBeTruthy()
})
