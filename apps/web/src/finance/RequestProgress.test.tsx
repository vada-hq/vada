// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { purchaseDetail } from '@/test-support/purchase-fixtures'
import { RequestProgress } from './RequestProgress'

afterEach(cleanup)

test('승인만 받은 품목은 결제 완료가 아니며, 일부 결제 뒤에도 미결재 품목이 있으면 완료로 표시하지 않는다', () => {
  const request = purchaseDetail()
  const approved = { ...request.items[0]!, status: 'approved' as const, paid: false }
  const pending = { ...request.items[1]!, status: 'pending' as const }
  const ui = render(
    <RequestProgress request={{ ...request, items: [approved], status: 'approved' }} />,
  )
  expect(screen.getByText('결제').closest('li')?.textContent).toBe('결제대기')
  ui.rerender(
    <RequestProgress request={{ ...request, items: [{ ...approved, paid: true }, pending] }} />,
  )
  expect(screen.getByText('결제').closest('li')?.textContent).toBe('결제일부 결제')
  ui.rerender(<RequestProgress request={{ ...request, items: [{ ...approved, paid: true }] }} />)
  expect(screen.getByText('결제').closest('li')?.textContent).toBe('결제완료')
})

test.each(['rejected', 'cancelled'] as const)(
  '반려·취소는 진행 막대 대신 결과 한 줄이다: %s',
  status => {
    render(<RequestProgress request={{ ...purchaseDetail(), status }} />)
    expect(screen.queryByRole('list', { name: '구매 요청 진행' })).toBeNull()
    expect(screen.getByRole('status')).toBeTruthy()
  },
)
