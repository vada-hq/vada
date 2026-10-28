// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { resetAddress } from '@/test-support/address-reset'
import { councilView, FINANCE_PERMISSIONS } from '@/test-support/council-fixtures'
import { COUNCIL_ID, PurchasesAt } from '@/test-support/finance-at'
import { json, mockApi } from '@/test-support/mock-api'
import { purchaseSummary } from '@/test-support/purchase-fixtures'
import { EVENT_ID, eventSummary } from '@/test-support/event-fixtures'
import { settlementOf } from '@/test-support/settlement-fixtures'

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})
const base = `/api/organizations/${COUNCIL_ID}`
const list = (requests = [purchaseSummary('a')], truncated = false) => json({ requests, truncated })
const show = (view = councilView(COUNCIL_ID)) => {
  const onForbidden = vi.fn()
  render(<PurchasesAt view={view} onForbidden={onForbidden} />)
  return onForbidden
}

test.each([
  ['부원', councilView(COUNCIL_ID, { councilRank: null }), 'all'],
  ['회장', councilView(COUNCIL_ID), 'all'],
  [
    '재정부',
    councilView(COUNCIL_ID, { councilRank: null, permissions: FINANCE_PERMISSIONS }),
    'pending',
  ],
])('%s 기본 보기와 재정부 전용 결재 대기', async (_, view, filter) => {
  const api = mockApi()
  api.on('GET', `${base}/purchase-requests?view=${filter}`, () => list())
  show(view)
  await screen.findByRole('heading', { name: '요청 a' })
  const group = screen.getByRole('group', { name: '구매 요청 거르기' })
  expect(
    within(group)
      .getByRole('button', { name: filter === 'all' ? '전체 요청' : '결재 대기' })
      .getAttribute('aria-pressed'),
  ).toBe('true')
  expect(within(group).queryByRole('button', { name: '결재 대기' }) !== null).toBe(
    filter === 'pending',
  )
})

test('명시한 내 요청과 내 부서 보기는 기본값보다 먼저 적용한다', async () => {
  window.history.replaceState(null, '', `/purchases/${COUNCIL_ID}?view=mine`)
  const api = mockApi()
  api.on('GET', `${base}/purchase-requests?view=mine`, () => list())
  api.on('GET', `${base}/purchase-requests?view=department`, () => list([]))
  show(
    councilView(COUNCIL_ID, {
      departments: [{ id: EVENT_ID, name: '기획부', role: null, rank: 'head' }],
    }),
  )
  await screen.findByRole('heading', { name: '요청 a' })
  fireEvent.click(screen.getByRole('button', { name: '내 부서' }))
  await waitFor(() =>
    expect(api.calls.some(call => call.path.endsWith('?view=department'))).toBe(true),
  )
})

test('상시·행사 범위는 서버 질의와 주소에 남고 행사 요약과 새 요청에도 이어진다', async () => {
  const api = mockApi()
  api.on('GET', `${base}/purchase-requests?view=all`, () => list())
  api.on('GET', `${base}/purchase-requests?view=all&event=none`, () =>
    list([purchaseSummary('상시')]),
  )
  api.on('GET', `${base}/purchase-requests?view=all&event=${EVENT_ID}`, () =>
    list([purchaseSummary('행사')]),
  )
  api.on('GET', `${base}/events`, () => json({ events: [eventSummary()], truncated: false }))
  api.on('GET', `${base}/events/${EVENT_ID}/settlement`, () => json(settlementOf()))
  show(councilView(COUNCIL_ID, { councilRank: null }))
  await screen.findByRole('heading', { name: '요청 a' })
  expect(screen.getByRole('button', { name: '예산 현황' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '상시' }))
  await screen.findByRole('heading', { name: '요청 상시' })
  expect(window.location.search).toContain('scope=none')
  fireEvent.click(screen.getByRole('button', { name: '행사별' }))
  fireEvent.change(await screen.findByRole('combobox', { name: '행사' }), {
    target: { value: EVENT_ID },
  })
  await screen.findByRole('heading', { name: '요청 행사' })
  expect(window.location.search).toContain(`scope=${EVENT_ID}`)
  expect(await screen.findByText('500,000원')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '구매 요청 내기' }))
  const eventField = await screen.findByRole('combobox', { name: /행사/ })
  expect((eventField as HTMLSelectElement).value).toBe(EVENT_ID)
})

test('단계 수와 거른 목록은 같은 판정이며 일부 결제·반려·취소를 구분한다', async () => {
  const api = mockApi()
  api.on('GET', `${base}/purchase-requests?view=all`, () =>
    list(
      [
        purchaseSummary('대기'),
        purchaseSummary('결제전', {
          status: 'approved',
          progress: { decided: true, paid: false, partlyPaid: true, hasShipment: false },
        }),
        purchaseSummary('결제함', {
          status: 'partial',
          progress: { decided: true, paid: true, partlyPaid: false, hasShipment: true },
        }),
        purchaseSummary('반려', { status: 'rejected' }),
        purchaseSummary('취소', { status: 'cancelled' }),
      ],
      true,
    ),
  )
  show()
  const stages = await screen.findByRole('group', { name: '구매 단계 거르기' })
  await waitFor(() =>
    expect(within(stages).getByRole('button', { name: '결제 전 1건' })).toBeTruthy(),
  )
  expect(within(stages).getByRole('button', { name: '결재 대기 1건' })).toBeTruthy()
  expect(within(stages).getByRole('button', { name: '결제함 1건' })).toBeTruthy()
  fireEvent.click(within(stages).getByRole('button', { name: '반려·취소 2건' }))
  expect(screen.queryByRole('heading', { name: '요청 대기' })).toBeNull()
  expect(screen.getByRole('heading', { name: '요청 반려' })).toBeTruthy()
  expect(screen.getByRole('heading', { name: '요청 취소' })).toBeTruthy()
  expect(screen.getByText('요청이 많아서 100개만 보여요.')).toBeTruthy()
  fireEvent.click(within(stages).getByRole('button', { name: '결제함 1건' }))
  expect(screen.getByRole('heading', { name: '요청 결제함' })).toBeTruthy()
  expect(screen.getByRole('list', { name: '구매 요청 진행' }).textContent).toContain('송장 등록됨')
})

test('읽기 전·실패는 집계 전, 빈 목록은 0건이다', async () => {
  const api = mockApi()
  api.on('GET', `${base}/purchase-requests?view=all`, () => json({ error: 'INTERNAL' }, 500))
  show()
  const stages = screen.getByRole('group', { name: '구매 단계 거르기' })
  expect(within(stages).getAllByText('집계 전')).toHaveLength(4)
  await screen.findByRole('button', { name: '다시 시도' })
  expect(within(stages).getAllByText('집계 전')).toHaveLength(4)
  api.on('GET', `${base}/purchase-requests?view=all`, () => list([]))
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  await waitFor(() => expect(within(stages).getAllByText('0건')).toHaveLength(4))
})
