// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { resetAddress } from '@/test-support/address-reset'
import { councilView } from '@/test-support/council-fixtures'
import { EVENT_ID, eventDetail } from '@/test-support/event-fixtures'
import { json, mockApi } from '@/test-support/mock-api'
import { purchaseDetail, purchaseSummary } from '@/test-support/purchase-fixtures'
import { PurchaseRoute } from '@/test-support/purchase-route'
import { eventSummary } from '@/test-support/event-fixtures'
import { budgetWithPeriod } from '@/test-support/budget-fixtures'
import { settlementOf } from '@/test-support/settlement-fixtures'
import { COUNCIL_ID } from '@/test-support/workspace-at'
import { EventMoneyTab } from './EventMoneyTab'

afterEach(async () => {
  cleanup()
  await resetAddress()
  vi.unstubAllGlobals()
})

const BASE = `/api/organizations/${COUNCIL_ID}`
const ADDRESS = `/events/${COUNCIL_ID}/${EVENT_ID}?tab=money`
const LIST = `${BASE}/purchase-requests?view=all&event=${EVENT_ID}`
const REQUEST = '0199d1a0-0000-7000-8000-000000000001'
const request = purchaseSummary(REQUEST, {
  title: '환영회 간식',
  event: { id: EVENT_ID, name: '환영회' },
})
const counts = { pending: 1, unpaid: 0, paid: 0, closed: 0 }
const response = () => json({ requests: [request], truncated: false, stageCounts: counts })

function setup(query = '') {
  window.history.replaceState(null, '', ADDRESS + query)
  const api = mockApi()
  api.on('GET', `${BASE}/events/${EVENT_ID}/settlement`, () => json(settlementOf()))
  for (const view of ['all', 'mine']) {
    const list = `${BASE}/purchase-requests?view=${view}&event=${EVENT_ID}`
    api.on('GET', list, response)
    api.on('GET', `${list}&stage=pending`, response)
  }
  const props = {
    view: councilView(COUNCIL_ID, { permissions: ['council.view'] }),
    event: eventDetail(),
    refresh: 0,
    reloadEvent: vi.fn(async () => {}),
    onLost: vi.fn(),
    onForbidden: vi.fn(),
  }
  const ui = render(<EventMoneyTab {...props} />)
  return { api, props, ...ui }
}

test('행사 구매 탭은 예산 → 전체 요청·단계·목록 → 정산에 남은 것 순서로 모든 운영진에게 보인다', async () => {
  const { api } = setup()
  const row = await screen.findByRole('heading', { name: '환영회 간식' })
  const filters = screen.getByRole('group', { name: '구매 요청 거르기' })
  expect(
    within(filters)
      .getAllByRole('button')
      .map(button => button.textContent),
  ).toEqual(['전체 요청', '내 요청'])
  expect(
    within(filters).getByRole('button', { name: '전체 요청' }).getAttribute('aria-pressed'),
  ).toBe('true')
  expect(api.calls.some(call => call.path === LIST)).toBe(true)
  expect(screen.queryByRole('group', { name: '구매 범위' })).toBeNull()
  expect(screen.queryByRole('button', { name: '구매 요청 내기' })).toBeNull()
  const budget = await screen.findByRole('region', { name: '행사 예산' })
  const remaining = await screen.findByRole('region', { name: '정산에 남은 것' })
  expect(budget.compareDocumentPosition(filters) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(row.compareDocumentPosition(remaining) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  fireEvent.click(within(row).getByRole('button'))
  expect(window.location.pathname).toBe(`/purchases/${COUNCIL_ID}/${REQUEST}`)
  api.assertNoUnexpectedRequests()
})

test('단계·내 요청은 행사 주소를 replace하고, 보기 변경은 단계를 비우며 새로고침해도 남는다', async () => {
  const { api, unmount } = setup()
  await screen.findByRole('heading', { name: '환영회 간식' })
  const historyLength = window.history.length
  fireEvent.click(screen.getByRole('button', { name: '결재 대기 1건' }))
  await waitFor(() =>
    expect(api.calls.some(call => call.path === `${LIST}&stage=pending`)).toBe(true),
  )
  expect(window.location.search).toBe('?tab=money&stage=pending')
  fireEvent.click(screen.getByRole('button', { name: '내 요청' }))
  await waitFor(() =>
    expect(
      api.calls.some(call => call.path === `${BASE}/purchase-requests?view=mine&event=${EVENT_ID}`),
    ).toBe(true),
  )
  expect(window.location.search).toBe('?tab=money&view=mine')
  expect(screen.getByRole('button', { name: '결재 대기 1건' }).getAttribute('aria-pressed')).toBe(
    'false',
  )
  expect(window.history.length).toBe(historyLength)
  unmount()
  setup('&view=mine&stage=pending')
  await waitFor(() =>
    expect(screen.getByRole('button', { name: '결재 대기 1건' }).getAttribute('aria-pressed')).toBe(
      'true',
    ),
  )
  expect(screen.getByRole('button', { name: '내 요청' }).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: '전체 요청' }))
  await waitFor(() => expect(window.location.search).toBe('?tab=money'))
})

test('머리 완료·완료 취소의 refresh가 바뀌면 정산과 행사 요청을 함께 다시 읽는다', async () => {
  const { api, props, rerender } = setup()
  await screen.findByRole('heading', { name: '환영회 간식' })
  const reads = () => api.calls.filter(call => call.path === LIST).length
  const before = reads()
  rerender(<EventMoneyTab {...props} refresh={1} />)
  await waitFor(() => expect(reads()).toBeGreaterThan(before))
  api.assertNoUnexpectedRequests()
})

test('구매 요청을 낸 뒤 상세에서 행사로 돌아오면 요청 목록과 정산을 다시 읽는다', async () => {
  const { api, props } = setup()
  await screen.findByRole('heading', { name: '환영회 간식' })
  cleanup()
  const view = councilView(COUNCIL_ID, { permissions: ['council.view', 'purchase.request'] })
  api.on('GET', `${BASE}/events`, () => json({ events: [eventSummary()], truncated: false }))
  api.on('GET', `${BASE}/budget`, () => json(budgetWithPeriod()))
  api.on('GET', `${BASE}/purchase-requests/${REQUEST}`, () =>
    json({ request: purchaseDetail(REQUEST) }),
  )
  api.on('POST', `${BASE}/purchase-requests`, () => {
    api.on('GET', LIST, () =>
      json({
        requests: [{ ...request, title: '방금 낸 요청' }],
        truncated: false,
        stageCounts: counts,
      }),
    )
    return json({ request: purchaseDetail(REQUEST) }, 201)
  })
  render(
    <PurchaseRoute view={view} onForbidden={props.onForbidden}>
      <EventMoneyTab {...props} view={view} />
    </PurchaseRoute>,
  )
  await screen.findByRole('heading', { name: '환영회 간식' })
  const before = api.calls.filter(call => call.path === LIST).length
  fireEvent.click(screen.getByRole('button', { name: '구매 요청 내기' }))
  const form = await screen.findByRole('form', { name: '구매 요청 내기' })
  fireEvent.change(within(form).getByLabelText('제목'), { target: { value: '방금 낸 요청' } })
  fireEvent.change(within(form).getByLabelText('품목 1 이름'), { target: { value: '간식' } })
  fireEvent.click(within(form).getByRole('button', { name: '내기' }))
  await screen.findByRole('region', { name: '구매 요청 상세' })
  fireEvent.click(screen.getByRole('button', { name: '들어온 곳으로 돌아가기' }))
  await screen.findByRole('heading', { name: '방금 낸 요청' })
  expect(window.location.pathname + window.location.search).toBe(ADDRESS)
  expect(api.calls.filter(call => call.path === LIST).length).toBeGreaterThan(before)
  api.assertNoUnexpectedRequests()
})
