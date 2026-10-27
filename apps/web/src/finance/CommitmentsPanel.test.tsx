// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { resetAddress } from '@/test-support/address-reset'
import { COUNCIL_ID } from '@/test-support/finance-at'
import { json, mockApi } from '@/test-support/mock-api'
import { ExpenseBrowser } from './ExpenseBrowser'

const period = '0199d1a0-0000-7000-8000-00000000c001'
const request = '0199d1a0-0000-7000-8000-00000000a001'
const path = `/api/organizations/${COUNCIL_ID}/finance-commitments?period=${period}`
afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})

function show() {
  window.history.replaceState(
    null,
    '',
    `/finance/${COUNCIL_ID}?tab=expenses&period=${period}&spending=committed`,
  )
  const onForbidden = vi.fn()
  render(
    <ExpenseBrowser
      councilId={COUNCIL_ID}
      onForbidden={onForbidden}
      onOpen={() => {}}
      list={{ state: { kind: 'loading' }, reload: async () => {}, replace: () => {} }}
    />,
  )
  return onForbidden
}

test('지출 예정 주소는 고른 기간의 품목 잔액·건수·합을 보여 주고 그 요청을 연다', async () => {
  const api = mockApi()
  api.on('GET', path, () =>
    json({
      items: [
        {
          id: 'item',
          name: '현수막',
          requestId: request,
          requestTitle: '홍보물 구매',
          amount: 20000,
          event: null,
          budgetItem: { id: 'budget', purpose: '홍보비' },
        },
      ],
    }),
  )
  show()
  await screen.findByRole('button', { name: '현수막' })
  expect(screen.getByText('1건')).toBeTruthy()
  expect(screen.getByText('합계 20,000원')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '현수막' }))
  expect(window.location.pathname).toBe(`/purchases/${COUNCIL_ID}/${request}`)
  api.assertNoUnexpectedRequests()
})

test('권한 오류에서는 가짜 0건을 보이지 않고 다시 읽을 수 있다', async () => {
  const api = mockApi()
  api.on('GET', path, () => json({ error: 'FORBIDDEN' }, 403))
  const forbidden = show()
  await screen.findByRole('alert')
  expect(forbidden).toHaveBeenCalledOnce()
  expect(screen.queryByText('0건')).toBeNull()
  api.on('GET', path, () => json({ items: [] }))
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  await screen.findByText('지출 예정 없음')
  expect(screen.getByText('0건')).toBeTruthy()
})
