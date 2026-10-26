// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { PurchaseLineItem, PurchaseRequestDetail, PurchaseShipment } from '@vada/contracts'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { purchaseDetail } from '@/test-support/purchase-fixtures'
import { PERMISSION_CHANGED, PURCHASE_LOST } from '@/lib/messages'
import StateMessage from '@/components/StateMessage'
import { RequestDetailDialog } from './RequestDetailDialog'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const REQUEST = '0199d1a0-0000-7000-8000-00000000a001'
const ITEM_A = '0199d1a0-0000-7000-8000-00000000a002'
const ITEM_B = '0199d1a0-0000-7000-8000-00000000a003'
const SHIPMENT = '0199d1a0-0000-7000-8000-00000000a004'
const BASE = `/api/organizations/c1/purchase-requests/${REQUEST}`
const URL = `${BASE}/shipments`
const TRACKING = 'https://www.coupangls.com/'
const item = (
  id: string,
  name: string,
  status: PurchaseLineItem['status'] = 'approved',
): PurchaseLineItem => ({
  id,
  name,
  status,
  quantity: 1,
  link: null,
  options: null,
  amount: 5000,
  budgetItem: null,
  paid: false,
  payable: false,
  actions: [],
})
const shipment = (extra: Partial<PurchaseShipment> = {}): PurchaseShipment => ({
  id: SHIPMENT,
  carrierId: 'kr.coupangls',
  trackingNumber: '123-456',
  lineItemIds: [ITEM_A],
  createdBy: { id: 'm1', name: '김재정' },
  createdAt: '2026-10-26T05:00:00Z',
  cancelledAt: null,
  editable: true,
  ...extra,
})
const request = (extra: Partial<PurchaseRequestDetail> = {}) =>
  purchaseDetail(REQUEST, {
    items: [item(ITEM_A, '네임펜'), item(ITEM_B, '테이프')],
    decisions: [],
    actions: [],
    canAddShipment: true,
    ...extra,
  })

function Harness({ onForbidden }: { onForbidden: () => void }) {
  const [lost, setLost] = useState<string | null>(null)
  return lost ? (
    <StateMessage kind="notice">{lost}</StateMessage>
  ) : (
    <RequestDetailDialog
      councilId="c1"
      requestId={REQUEST}
      onChanged={vi.fn()}
      onClose={vi.fn()}
      onLost={setLost}
      onForbidden={onForbidden}
      onOpenExpense={vi.fn()}
    />
  )
}
function setup(first = request()) {
  const api = mockApi()
  const current = { value: first }
  api.on('GET', BASE, () => json({ request: current.value }))
  api.on('GET', `${URL}/${SHIPMENT}/tracking`, () =>
    json({
      lastEvent: {
        time: '2026-10-26T05:00:00Z',
        status: { code: 'DELIVERING', name: '배송 중' },
        description: '배송 출발',
      },
      reason: null,
      trackingUrl: TRACKING,
    }),
  )
  const onForbidden = vi.fn()
  render(<Harness onForbidden={onForbidden} />)
  return { api, current, onForbidden }
}
const openCreate = async () => {
  fireEvent.click(await screen.findByRole('button', { name: '송장 넣기' }))
  return within(await screen.findByRole('dialog', { name: '송장 넣기' }))
}
const fill = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } })

test('승인 품목만 선택하고 이미 송장이 있는 품목을 빼고 기본 선택한 뒤 등록·재조회한다', async () => {
  const saved = shipment({ id: '0199d1a0-0000-7000-8000-00000000a005', lineItemIds: [ITEM_B] })
  const { api, current } = setup(
    request({
      items: [
        ...request().items,
        item('0199d1a0-0000-7000-8000-00000000a006', '대기 품목', 'pending'),
      ],
      shipments: [shipment()],
    }),
  )
  const pending = deferredResponse()
  api.on('POST', URL, () => pending.promise)
  const form = await openCreate()
  expect(form.getByLabelText<HTMLSelectElement>('택배사').value).toBe('kr.coupangls')
  expect(form.getByLabelText<HTMLInputElement>('네임펜').checked).toBe(false)
  expect(form.getByLabelText<HTMLInputElement>('테이프').checked).toBe(true)
  expect(form.queryByLabelText('대기 품목')).toBeNull()
  fill(form.getByLabelText('송장 번호'), '987-654')
  fireEvent.click(form.getByRole('button', { name: '넣기' }))
  await waitFor(() => expect(api.calls.filter(c => c.method === 'POST')).toHaveLength(1))
  expect(api.calls.find(c => c.method === 'POST')?.body).toEqual({
    carrierId: 'kr.coupangls',
    trackingNumber: '987-654',
    lineItemIds: [ITEM_B],
  })
  expect(form.getByRole<HTMLButtonElement>('button', { name: '넣기' }).disabled).toBe(true)
  current.value = request({ shipments: [shipment(), { ...saved, trackingNumber: '987-654' }] })
  api.on('GET', `${URL}/${saved.id}/tracking`, () =>
    json({ lastEvent: null, reason: 'not_found', trackingUrl: TRACKING }),
  )
  pending.resolve(json({ shipment: saved }, 201))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '송장 넣기' })).toBeNull())
  expect(await screen.findByText('987-654')).toBeTruthy()
})

test('등록 권한이 없어도 배송과 품목 대응·마지막 시각을 보고 수정 버튼은 보지 못한다', async () => {
  setup(request({ canAddShipment: false, shipments: [shipment({ editable: false })] }))
  expect(await screen.findByText('배송 출발')).toBeTruthy()
  expect(screen.getByText('배송 중')).toBeTruthy()
  expect(screen.getByText('10월 26일 (월) 14:00')).toBeTruthy()
  const region = within(screen.getByRole('region', { name: '배송' }))
  expect(region.getByText('네임펜')).toBeTruthy()
  expect(region.getByRole('link', { name: '택배사에서 보기' }).getAttribute('href')).toBe(TRACKING)
  expect(screen.queryByRole('button', { name: '송장 넣기' })).toBeNull()
  expect(region.queryByRole('button', { name: '고치기' })).toBeNull()
  expect(region.queryByRole('button', { name: '송장 취소' })).toBeNull()
})

test('업체 조회 안 됨에도 택배사 링크와 송장을 보인다', async () => {
  const { api } = setup(request({ shipments: [shipment()] }))
  api.on('GET', `${URL}/${SHIPMENT}/tracking`, () =>
    json({ lastEvent: null, reason: 'not_configured', trackingUrl: TRACKING }),
  )
  expect(await screen.findByText('조회 안 됨')).toBeTruthy()
  expect(screen.getByRole('link', { name: '택배사에서 보기' }).getAttribute('href')).toBe(TRACKING)
  expect(screen.getByText('123-456')).toBeTruthy()
})

test('조회 API 연결 실패에도 공개 조회 링크를 남긴다', async () => {
  const { api } = setup(request({ shipments: [shipment({ editable: false })] }))
  api.on('GET', `${URL}/${SHIPMENT}/tracking`, () => json({ error: 'INTERNAL' }, 500))
  expect(await screen.findByText('조회 안 됨')).toBeTruthy()
  expect(screen.getByRole('link', { name: '택배사에서 보기' }).getAttribute('href')).toBe(TRACKING)
})

test('행사 완료로 송장을 못 넣으면 창을 닫고 새 권한과 이유를 보인다', async () => {
  const { api, current } = setup()
  api.on('POST', URL, () => {
    current.value = request({ canAddShipment: false })
    return json({ error: 'EVENT_COMPLETED' }, 409)
  })
  const form = await openCreate()
  fill(form.getByLabelText('송장 번호'), '123456')
  fireEvent.click(form.getByRole('button', { name: '넣기' }))
  expect(await screen.findByText(/완료한 행사의 요청이라 바꿀 수 없어요/)).toBeTruthy()
  expect(screen.queryByRole('dialog', { name: '송장 넣기' })).toBeNull()
  expect(screen.queryByRole('button', { name: '송장 넣기' })).toBeNull()
})

test('송장을 고친 뒤 배송을 새로 조회하고 사유를 받아 취소한다', async () => {
  const { api, current } = setup(request({ shipments: [shipment()] }))
  const changed = shipment({
    carrierId: 'kr.cjlogistics',
    trackingNumber: '111222',
    lineItemIds: [ITEM_B],
  })
  api.on('POST', `${URL}/${SHIPMENT}`, () => {
    current.value = request({ shipments: [changed] })
    return json({ shipment: changed })
  })
  await screen.findByText('배송 출발')
  fireEvent.click(screen.getByRole('button', { name: '고치기' }))
  const edit = within(await screen.findByRole('dialog', { name: '송장 고치기' }))
  fill(edit.getByLabelText('택배사'), 'kr.cjlogistics')
  fill(edit.getByLabelText('송장 번호'), '111222')
  fireEvent.click(edit.getByLabelText('네임펜'))
  fireEvent.click(edit.getByLabelText('테이프'))
  fireEvent.click(edit.getByRole('button', { name: '저장' }))
  await screen.findByText('111222')
  expect(api.calls.find(c => c.method === 'POST')?.body).toEqual({
    carrierId: 'kr.cjlogistics',
    trackingNumber: '111222',
    lineItemIds: [ITEM_B],
  })
  expect(api.calls.filter(c => c.path.endsWith('/tracking')).length).toBeGreaterThan(1)
  api.on('POST', `${URL}/${SHIPMENT}/cancel`, () => {
    const cancelled = { ...changed, cancelledAt: '2026-10-26T06:00:00Z', editable: false }
    current.value = request({ shipments: [cancelled] })
    return json({ shipment: cancelled })
  })
  fireEvent.click(screen.getByRole('button', { name: '송장 취소' }))
  const cancel = within(await screen.findByRole('dialog', { name: '이 송장을 취소할까요?' }))
  fireEvent.click(cancel.getByRole('button', { name: '송장 취소' }))
  expect(await cancel.findByText('취소 사유를 입력해 주세요')).toBeTruthy()
  fill(cancel.getByLabelText('취소 사유'), '송장을 잘못 넣었어요')
  fireEvent.click(cancel.getByRole('button', { name: '송장 취소' }))
  expect(await screen.findByText('송장 취소됨')).toBeTruthy()
  expect(api.calls.find(c => c.path.endsWith('/cancel'))?.body).toEqual({
    reason: '송장을 잘못 넣었어요',
  })
})

test('잘못된 송장 번호와 비운 품목 선택을 칸 아래에 알리고 보내지 않는다', async () => {
  const { api } = setup()
  const form = await openCreate()
  fill(form.getByLabelText('송장 번호'), 'abc')
  fireEvent.click(form.getByLabelText('네임펜'))
  fireEvent.click(form.getByLabelText('테이프'))
  fireEvent.click(form.getByRole('button', { name: '넣기' }))
  expect(await form.findByText('숫자와 하이픈으로 송장 번호를 입력해 주세요')).toBeTruthy()
  expect(form.getByText('품목을 하나 이상 선택해 주세요')).toBeTruthy()
  expect(api.calls.some(c => c.method === 'POST')).toBe(false)
})

test.each([
  [403, 'FORBIDDEN', PERMISSION_CHANGED],
  [404, 'NOT_FOUND', PURCHASE_LOST],
] as const)('송장 등록 %s면 창을 닫고 이유를 보인다', async (status, error, message) => {
  const { api, onForbidden } = setup()
  api.on('POST', URL, () => json({ error }, status))
  const form = await openCreate()
  fill(form.getByLabelText('송장 번호'), '123456')
  fireEvent.click(form.getByRole('button', { name: '넣기' }))
  expect(await screen.findByText(message)).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(onForbidden).toHaveBeenCalledTimes(status === 403 ? 1 : 0)
})
