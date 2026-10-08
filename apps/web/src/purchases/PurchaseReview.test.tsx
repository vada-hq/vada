// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { PurchaseReviewResponse } from '@vada/contracts'
import { json, mockApi } from '../test-support/mock-api'
import { carrierCache } from '../deliveries/useDeliveries'
import PurchaseReview from './PurchaseReview'
import { item } from './purchase-fixtures'
import { usePurchaseReview } from './usePurchaseReview'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); carrierCache.clear() })
const base = '/api/organizations/o/purchase-review'
function Harness() {
  const state = usePurchaseReview('o', true)
  return <PurchaseReview organizationId="o" state={state} />
}
function setup(body: PurchaseReviewResponse, deliveries: 'on' | 'off' = 'on') {
  const api = mockApi()
  api.on('GET', base, () => json(body))
  api.on('GET', '/api/organizations/o/delivery-carriers', () => deliveries === 'on'
    ? json({ carriers: [{ id: 'kr.cjlogistics', name: 'CJ대한통운' }], nextCursor: null }) : json({ error: 'NOT_FOUND' }, 404))
  render(<Harness />)
  return api
}
const reviewGets = (api: ReturnType<typeof mockApi>) => api.calls.filter(call => call.method === 'GET' && call.path === base)

test('같이 제출한 품목을 묶어 보여 주고, 모두 승인은 묶음의 품목을 한 번에 보낸다', async () => {
  const other = { mine: false, requester: { id: 'q', name: '다른 기획' }, departmentName: '홍보부', status: 'pending' as const, submissionId: 's1', submittedAt: '2026-10-08T05:00:00Z' }
  const a = item({ ...other, id: 'a', productName: '박스테이프', version: 2 })
  const b = item({ ...other, id: 'b', productName: '생수', version: 3, estimatedUnitPrice: null })
  const own = item({ id: 'c', productName: '이름표', status: 'pending', submissionId: 's2', version: 2, submittedAt: '2026-10-08T06:00:00Z', neededByChanged: true })
  const api = setup({ pending: [a, b, own], approved: [], truncated: false })
  const group = await screen.findByRole('region', { name: '다른 기획의 제출' })
  expect(within(group).getByText('다른 기획 · 홍보부 · 체육대회')).toBeTruthy()
  expect(within(group).getByText('합계 9,800원 · 일부 금액 확인 필요')).toBeTruthy()
  const mine = screen.getByRole('region', { name: '기획 테스터의 제출' })
  expect(within(mine).getByText('내 품목')).toBeTruthy()
  expect(within(mine).getByText('날짜 바뀜')).toBeTruthy()
  api.on('POST', `${base}/decisions`, () => json({ items: [] }))
  fireEvent.click(within(group).getByRole('button', { name: '모두 승인' }))
  await waitFor(() => expect(reviewGets(api)).toHaveLength(2))
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ decisions: [
    { id: 'a', version: 2, decision: 'approved' }, { id: 'b', version: 3, decision: 'approved' }] })
})

test('반려는 사유를 적어야 보낼 수 있다', async () => {
  const api = setup({ pending: [item({ id: 'a', productName: '박스테이프', status: 'pending', submissionId: 's1', version: 2 })], approved: [], truncated: false })
  fireEvent.click(await screen.findByRole('button', { name: '반려' }))
  expect(screen.getByRole('button', { name: '반려하기' }).hasAttribute('disabled')).toBe(true)
  fireEvent.change(screen.getByLabelText('반려 사유'), { target: { value: '   ' } })
  expect(screen.getByRole('button', { name: '반려하기' }).hasAttribute('disabled')).toBe(true)
  fireEvent.change(screen.getByLabelText('반려 사유'), { target: { value: '규격을 확인해 주세요' } })
  api.on('POST', `${base}/decisions`, () => json({ items: [] }))
  fireEvent.click(screen.getByRole('button', { name: '반려하기' }))
  await waitFor(() => expect(api.calls.some(call => call.method === 'POST')).toBe(true))
  expect(api.calls.find(call => call.method === 'POST')?.body).toEqual({ decisions: [{ id: 'a', version: 2, decision: 'rejected', reason: '규격을 확인해 주세요' }] })
})

test('구매·배송은 살 품목과 산 품목으로 나누고, 먼저 바뀐 품목이면 안내한다', async () => {
  const first = item({ id: 'x', productName: '생수', status: 'approved', submissionId: 's1', version: 3, neededBy: '2026-10-10', mine: false, requester: { id: 'q', name: '다른 기획' } })
  const second = item({ id: 'y', productName: '테이프', status: 'approved', submissionId: 's1', version: 3 })
  const bought = item({ id: 'z', productName: '이름표', status: 'approved', submissionId: 's2', version: 4, purchasedAt: '2026-10-08T06:00:00Z' })
  const api = setup({ pending: [], approved: [first, second, bought], truncated: false })
  fireEvent.click(await screen.findByRole('button', { name: '구매·배송 3' }))
  const toBuy = screen.getByRole('region', { name: '살 품목' })
  expect(within(toBuy).getByText('다른 기획')).toBeTruthy()
  api.on('POST', `${base}/x/purchased`, () => json({ items: [] }))
  fireEvent.click(within(toBuy).getAllByRole('button', { name: '샀어요' })[0]!)
  await waitFor(() => expect(api.calls.find(call => call.path === `${base}/x/purchased`)?.body).toEqual({ version: 3, purchased: true }))
  await waitFor(() => expect(reviewGets(api)).toHaveLength(2))
  api.on('POST', `${base}/y/revoke`, () => json({ error: 'VERSION_CONFLICT' }, 409))
  fireEvent.click(within(screen.getByRole('region', { name: '살 품목' })).getAllByRole('button', { name: '승인 취소' })[1]!)
  expect(await screen.findByText('다른 곳에서 먼저 바뀌었어요. 목록을 새로 불러왔어요.')).toBeTruthy()
  expect(within(screen.getByRole('region', { name: '산 품목' })).getByRole('button', { name: '구매 표시 취소' })).toBeTruthy()
})

test('송장 등록은 산 품목에 송장을 연결하고 목록을 새로 불러온다', async () => {
  const bought = item({ id: 'z', productName: '이름표', status: 'approved', submissionId: 's2', version: 4, purchasedAt: '2026-10-08T06:00:00Z' })
  const api = setup({ pending: [], approved: [bought], truncated: false })
  api.on('POST', '/api/organizations/o/delivery-lookups', () => json({ status: 'in_transit', providerStatus: 'IN_TRANSIT', lastEventAt: null, checkedAt: '2026-10-08T07:00:00Z' }))
  api.on('POST', '/api/organizations/o/shipments', () => json({ shipmentId: 's1', replayed: false }, 201))
  fireEvent.click(await screen.findByRole('button', { name: '구매·배송 1' }))
  fireEvent.click(await screen.findByRole('button', { name: '송장 등록' }))
  const dialog = await screen.findByRole('dialog', { name: '송장 등록' })
  fireEvent.change(within(dialog).getByLabelText('택배사'), { target: { value: 'kr.cjlogistics' } })
  fireEvent.change(within(dialog).getByLabelText('송장번호'), { target: { value: '000123456789' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '송장 조회' }))
  await waitFor(() => expect(within(dialog).getByRole('button', { name: '이 송장으로 등록' }).hasAttribute('disabled')).toBe(false))
  fireEvent.click(within(dialog).getByRole('button', { name: '이 송장으로 등록' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(api.calls.find(call => call.path === '/api/organizations/o/shipments')?.body)
    .toMatchObject({ carrierId: 'kr.cjlogistics', trackingNumber: '000123456789', purchaseItemIds: ['z'] })
  await waitFor(() => expect(reviewGets(api)).toHaveLength(2))
})

test('배송 기능이 꺼진 서버에서는 송장 등록을 숨긴다', async () => {
  const api = setup({ pending: [], approved: [item({ id: 'z', status: 'approved', submissionId: 's2', purchasedAt: '2026-10-08T06:00:00Z' })], truncated: false }, 'off')
  fireEvent.click(await screen.findByRole('button', { name: '구매·배송 1' }))
  await waitFor(() => expect(api.calls.some(call => call.path === '/api/organizations/o/delivery-carriers')).toBe(true))
  await waitFor(() => expect(screen.getByRole('button', { name: '구매 표시 취소' })).toBeTruthy())
  expect(screen.queryByRole('button', { name: '송장 등록' })).toBeNull()
})
