// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { DeliverySummary, PurchaseDetail } from '@vada/contracts'
import DeliveryPanel from './DeliveryPanel'
import { draft } from '../purchases/purchase-test-fixtures'
import { deferredResponse, json, mockApi } from '../test-support/mock-api'
import { carrierCache } from './useDeliveries'

const root = '/api/organizations/o'
const list = `${root}/events/e/deliveries`
let api: ReturnType<typeof mockApi>
beforeEach(() => { api = mockApi(); carrierCache.clear() })
afterEach(() => { cleanup(); api.assertNoUnexpectedRequests(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

const approved = (): PurchaseDetail => {
  const request = draft()
  return { ...request, status: 'approved', items: [request.items[0]!, { ...request.items[0]!, id: 'j', position: 1, productName: '의자', quantity: 4 }] }
}
const shipment = (over: Partial<DeliverySummary> = {}): DeliverySummary => ({
  linkId: 'l1', id: 's1', carrierId: 'kr.cjlogistics', trackingNumber: '1234-5678', trackingNumberMasked: false, status: 'in_transit',
  lastEventAt: '2026-10-01T03:00:00Z', lastCheckedAt: '2026-10-01T04:00:00Z', lastAttemptAt: '2026-10-01T04:00:00Z',
  refreshFailed: false, trackingActive: true, webhookExpiresAt: null, ...over,
})
const deliveries = (first: DeliverySummary[] = [], second: DeliverySummary[] = []) => ({ nextCursor: null, items: [
  { id: 'i', requestId: 'r', productName: '테이블', quantity: 2, shipments: first },
  { id: 'j', requestId: 'r', productName: '의자', quantity: 4, shipments: second },
  { id: 'x', requestId: 'other', productName: '다른 요청 품목', quantity: 1, shipments: [] },
] })
const carriers = { carriers: [{ id: 'kr.cjlogistics', name: 'CJ대한통운' }, { id: 'kr.epost', name: '우체국택배' }], nextCursor: null }
const lookedUp = { status: 'in_transit', providerStatus: 'IN_TRANSIT', lastEventAt: '2026-10-01T03:00:00Z', checkedAt: '2026-10-01T04:00:00Z' }
const row = (name: string) => screen.getByRole('row', { name: new RegExp(name) })
async function fillShipment(number = '1234-5678') {
  await screen.findByRole('option', { name: 'CJ대한통운' })
  fireEvent.change(screen.getByLabelText('택배사'), { target: { value: 'kr.cjlogistics' } })
  fireEvent.change(screen.getByLabelText('송장번호'), { target: { value: number } })
}

test('members see per-item delivery status of this request only, without finance controls', async () => {
  api.on('GET', list, () => json(deliveries([shipment({ trackingNumber: '****5678', trackingNumberMasked: true })])))
  render(<DeliveryPanel request={approved()} finance={false} />)
  const panel = await screen.findByRole('region', { name: '구매·발주 처리' })
  await within(panel).findByText('배송 중')
  expect(row('테이블').textContent).toContain('CJ대한통운')
  expect(row('테이블').textContent).toContain('****5678')
  expect(within(row('의자')).getByText('—')).toBeTruthy()
  expect(screen.queryByText('다른 요청 품목')).toBeNull()
  expect(screen.queryByRole('button', { name: '송장 조회' })).toBeNull()
  expect(screen.queryByRole('button', { name: '연결 해제' })).toBeNull()
})

test('the panel stays hidden when the server has delivery turned off', async () => {
  api.on('GET', list, () => new Response('404 Not Found', { status: 404 }))
  render(<DeliveryPanel request={approved()} finance />)
  await waitFor(() => expect(api.calls).toHaveLength(1))
  await waitFor(() => expect(screen.queryByRole('region', { name: '구매·발주 처리' })).toBeNull())
})

test('later pages are followed so every item of the request is shown', async () => {
  const pages = deliveries()
  api.on('GET', list, () => json({ items: [pages.items[0]], nextCursor: 'c1' }))
  api.on('GET', `${list}?after=c1`, () => json({ items: [{ ...pages.items[1]!, shipments: [shipment({ status: 'delivered' })] }], nextCursor: null }))
  render(<DeliveryPanel request={approved()} finance={false} />)
  expect(await within(await screen.findByRole('row', { name: /의자/ })).findByText('배송 완료')).toBeTruthy()
})

test('a failed automatic refresh is flagged next to the last known status', async () => {
  api.on('GET', list, () => json(deliveries([shipment({ refreshFailed: true })])))
  render(<DeliveryPanel request={approved()} finance={false} />)
  expect((await screen.findByRole('row', { name: /테이블/ })).textContent).toContain('최근 확인 실패')
})

test('finance looks a tracking number up before registering it for the unshipped items', async () => {
  let registered = false
  api.on('GET', list, () => json(registered ? deliveries([shipment()], [shipment({ linkId: 'l2' })]) : deliveries()))
  api.on('GET', `${root}/delivery-carriers`, () => json(carriers))
  api.on('POST', `${root}/delivery-lookups`, () => json(lookedUp))
  api.on('POST', `${root}/shipments`, () => { registered = true; return json({ shipmentId: 's1', replayed: false }, 201) })
  render(<DeliveryPanel request={approved()} finance />)
  await fillShipment(' 1234-5678 ')
  const register = screen.getByRole('button', { name: '이 송장으로 등록' })
  expect(register.hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '송장 조회' }))
  expect((await screen.findByText(/^조회 결과:/)).textContent).toContain('배송 중')
  expect(api.calls.at(-1)?.body).toEqual({ carrierId: 'kr.cjlogistics', trackingNumber: '1234-5678' })
  fireEvent.click(register)
  expect((await screen.findByRole('status')).textContent).toContain('송장을 등록했어요')
  const body = api.calls.find(call => call.path === `${root}/shipments`)?.body as Record<string, unknown>
  expect(body).toMatchObject({ carrierId: 'kr.cjlogistics', trackingNumber: '1234-5678', purchaseItemIds: ['i', 'j'] })
  expect(String(body.idempotencyKey).length).toBeGreaterThan(10)
  expect(await within(row('의자')).findByText('배송 중')).toBeTruthy()
})

test('changing the input after a lookup requires a new lookup, and malformed numbers cannot be looked up', async () => {
  api.on('GET', list, () => json(deliveries()))
  api.on('GET', `${root}/delivery-carriers`, () => json(carriers))
  api.on('POST', `${root}/delivery-lookups`, () => json(lookedUp))
  render(<DeliveryPanel request={approved()} finance />)
  await fillShipment()
  fireEvent.click(screen.getByRole('button', { name: '송장 조회' }))
  await screen.findByText(/^조회 결과:/)
  fireEvent.change(screen.getByLabelText('송장번호'), { target: { value: '1234 5678' } })
  expect(screen.queryByText(/^조회 결과:/)).toBeNull()
  expect(screen.getByRole('button', { name: '이 송장으로 등록' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: '송장 조회' }).hasAttribute('disabled')).toBe(true)
})

test.each([
  [404, 'DELIVERY_NOT_FOUND', '송장을 찾을 수 없어요'],
  [429, 'DELIVERY_RATE_LIMITED', '잠시 후 다시'],
  [502, 'DELIVERY_PROVIDER_FAILED', '택배 조회 서비스'],
])('lookup failure %i explains what to do', async (status, error, message) => {
  api.on('GET', list, () => json(deliveries()))
  api.on('GET', `${root}/delivery-carriers`, () => json(carriers))
  api.on('POST', `${root}/delivery-lookups`, () => json({ error }, status))
  render(<DeliveryPanel request={approved()} finance />)
  await fillShipment()
  fireEvent.click(screen.getByRole('button', { name: '송장 조회' }))
  expect((await screen.findByRole('alert')).textContent).toContain(message)
  expect(screen.getByRole('button', { name: '이 송장으로 등록' }).hasAttribute('disabled')).toBe(true)
})

test('a retried registration reuses its idempotency key', async () => {
  let attempts = 0
  api.on('GET', list, () => json(deliveries()))
  api.on('GET', `${root}/delivery-carriers`, () => json(carriers))
  api.on('POST', `${root}/delivery-lookups`, () => json(lookedUp))
  api.on('POST', `${root}/shipments`, () => ++attempts === 1 ? json({ error: 'DELIVERY_PROVIDER_FAILED' }, 502) : json({ shipmentId: 's1', replayed: false }, 201))
  render(<DeliveryPanel request={approved()} finance />)
  await fillShipment()
  fireEvent.click(screen.getByRole('button', { name: '송장 조회' }))
  await screen.findByText(/^조회 결과:/)
  fireEvent.click(screen.getByRole('button', { name: '이 송장으로 등록' }))
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: '이 송장으로 등록' }))
  await screen.findByRole('status')
  const keys = api.calls.filter(call => call.path === `${root}/shipments`).map(call => (call.body as { idempotencyKey: string }).idempotencyKey)
  expect(keys).toHaveLength(2)
  expect(keys[0]).toBe(keys[1])
})

test('finance unlinks a wrong shipment after confirming', async () => {
  let unlinked = false
  api.on('GET', list, () => json(unlinked ? deliveries() : deliveries([shipment()])))
  api.on('GET', `${root}/delivery-carriers`, () => json(carriers))
  api.on('POST', `${root}/shipments/s1/unlink`, () => { unlinked = true; return json({}) })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<DeliveryPanel request={approved()} finance />)
  fireEvent.click(await screen.findByRole('button', { name: '연결 해제' }))
  await waitFor(() => expect(within(row('테이블')).getByText('—')).toBeTruthy())
  expect(api.calls.find(call => call.path.endsWith('/unlink'))?.body).toEqual({ linkIds: ['l1'] })
})

test('refresh reloads the delivery status', async () => {
  let status: DeliverySummary['status'] = 'in_transit'
  api.on('GET', list, () => json(deliveries([shipment({ status })])))
  render(<DeliveryPanel request={approved()} finance={false} />)
  await within(await screen.findByRole('row', { name: /테이블/ })).findByText('배송 중')
  status = 'delivered'
  fireEvent.click(screen.getByRole('button', { name: '배송 상태 새로고침' }))
  expect(await within(row('테이블')).findByText('배송 완료')).toBeTruthy()
})

test('every carrier page is loaded and domestic carriers are listed first', async () => {
  api.on('GET', list, () => json(deliveries()))
  api.on('GET', `${root}/delivery-carriers`, () => json({ carriers: [{ id: 'de.dhl', name: 'DHL' }, { id: 'kr.cjlogistics', name: 'CJ대한통운' }], nextCursor: 'c2' }))
  api.on('GET', `${root}/delivery-carriers?after=c2`, () => json({ carriers: [{ id: 'kr.lotte', name: '롯데택배' }, { id: 'us.ups', name: 'UPS' }], nextCursor: null }))
  render(<DeliveryPanel request={approved()} finance />)
  await screen.findByRole('option', { name: '롯데택배' })
  expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['택배사를 선택해 주세요', 'CJ대한통운', '롯데택배', 'DHL', 'UPS'])
})

test('the carrier list is fetched once and reused when another request is opened', async () => {
  api.on('GET', list, () => json(deliveries()))
  api.on('GET', `${root}/delivery-carriers`, () => json(carriers))
  const first = render(<DeliveryPanel request={approved()} finance />)
  await screen.findByRole('option', { name: 'CJ대한통운' })
  first.unmount()
  render(<DeliveryPanel request={approved()} finance />)
  await screen.findByRole('option', { name: 'CJ대한통운' })
  // 외부 조회는 사용자별 분당 횟수 제한이 있다. 요청서를 열 때마다 목록을 다시 받으면 조회·등록이 막힌다.
  expect(api.calls.filter(call => call.path.startsWith(`${root}/delivery-carriers`))).toHaveLength(1)
})

test('carrier search waits for the initial list so two external calls never overlap', async () => {
  const pending = deferredResponse()
  api.on('GET', list, () => json(deliveries()))
  api.on('GET', `${root}/delivery-carriers`, () => pending.promise)
  render(<DeliveryPanel request={approved()} finance />)
  const search = await screen.findByRole('button', { name: '택배사 검색' })
  expect(search.hasAttribute('disabled')).toBe(true)
  pending.resolve(json(carriers))
  await screen.findByRole('option', { name: 'CJ대한통운' })
  expect(search.hasAttribute('disabled')).toBe(false)
})
