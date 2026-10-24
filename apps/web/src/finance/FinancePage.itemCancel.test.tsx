// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { PurchaseLineItem, PurchaseRequestDetail } from '@vada/contracts'
import { councilView, FINANCE_PERMISSIONS } from '@/test-support/council-fixtures'
import { deferredResponse, json, mockApi } from '@/test-support/mock-api'
import { purchaseDetail, purchaseSummary } from '@/test-support/purchase-fixtures'
import { PERMISSION_CHANGED, PURCHASE_ERRORS, PURCHASE_LOST } from '@/lib/messages'
import FinancePage from './FinancePage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const BASE = '/api/organizations/c1/purchase-requests'

const item = (
  id: string,
  name: string,
  extra: Partial<PurchaseLineItem> = {},
): PurchaseLineItem => ({
  id,
  name,
  quantity: 1,
  link: null,
  options: null,
  amount: 5000,
  budgetItem: null,
  status: 'approved',
  paid: false,
  actions: ['line_item.cancel'],
  ...extra,
})
const detail = (items: PurchaseLineItem[], extra: Partial<PurchaseRequestDetail> = {}) =>
  purchaseDetail('r1', { items, decisions: [], actions: [], ...extra })

function setup(first: PurchaseRequestDetail) {
  const api = mockApi()
  api.on('GET', `${BASE}?view=mine`, () =>
    json({ requests: [purchaseSummary('r1')], truncated: false }),
  )
  let reads = 0
  const second = { current: first }
  api.on('GET', `${BASE}/r1`, () => {
    reads += 1
    return json({ request: reads === 1 ? first : second.current })
  })
  const handlers = { onForbidden: vi.fn(), onChanged: vi.fn(), onOpenEvent: vi.fn() }
  render(
    <FinancePage view={councilView('c1', { permissions: FINANCE_PERMISSIONS })} {...handlers} />,
  )
  return { api, handlers, after: second }
}
const open = async () => {
  fireEvent.click(await screen.findByRole('button', { name: '요청 r1' }))
  return screen.findByRole('dialog')
}
const cancelCalls = (api: ReturnType<typeof mockApi>) =>
  api.calls.filter(c => c.path.endsWith('/items/i1/cancel'))

test('서버가 준 동작이 있는 품목에만 [품목 취소]가 있다', async () => {
  setup(detail([item('i1', '포스터'), item('i2', '테이프', { actions: [] })]))
  await open()
  expect(screen.getAllByRole('button', { name: '품목 취소' })).toHaveLength(1)
})

test('사유를 비우고 누르면 칸 아래 문제를 보이고 보내지 않는다', async () => {
  const { api } = setup(detail([item('i1', '포스터')]))
  await open()
  fireEvent.click(screen.getByRole('button', { name: '품목 취소' }))
  const dialog = await screen.findByRole('dialog', { name: '이 품목을 취소할까요?' })
  fireEvent.click(within(dialog).getByRole('button', { name: '품목 취소' }))
  expect(await within(dialog).findByText('취소 사유를 입력해 주세요')).toBeTruthy()
  expect(cancelCalls(api)).toHaveLength(0)
})

test('사유를 보내면 상세를 새로 읽어 칩이 취소됨이 되고 이력에 사유가 보인다', async () => {
  const { api, handlers, after } = setup(detail([item('i1', '포스터')]))
  const pending = deferredResponse()
  api.on('POST', `${BASE}/r1/items/i1/cancel`, () => pending.promise)
  await open()
  fireEvent.click(screen.getByRole('button', { name: '품목 취소' }))
  const dialog = await screen.findByRole('dialog', { name: '이 품목을 취소할까요?' })
  fireEvent.change(within(dialog).getByLabelText('취소 사유'), { target: { value: '잘못 샀어요' } })
  after.current = detail([item('i1', '포스터', { status: 'cancelled', actions: [] })], {
    decisions: [
      {
        id: 'd9',
        lineItemId: 'i1',
        outcome: 'cancelled',
        by: { id: 'm2', name: '이재정' },
        at: '2026-10-22T05:03:00.000Z',
        reason: '잘못 샀어요',
      },
    ],
  })
  fireEvent.click(within(dialog).getByRole('button', { name: '품목 취소' }))
  await waitFor(() => expect(cancelCalls(api)).toHaveLength(1))
  fireEvent.click(within(dialog).getByRole('button', { name: '품목 취소' }))
  expect(cancelCalls(api)).toHaveLength(1)
  expect(cancelCalls(api)[0]?.body).toEqual({ reason: '잘못 샀어요' })
  pending.resolve(json({ request: after.current }))
  expect(await screen.findByText('취소됨')).toBeTruthy()
  expect(screen.getByText(/취소: 잘못 샀어요/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: '품목 취소' })).toBeNull()
  expect(handlers.onChanged).toHaveBeenCalled()
})

test.each(['LINE_ITEM_NOT_CANCELLABLE', 'EVENT_COMPLETED'])(
  '%s면 창을 닫고 문구를 버튼 옆에 보이며 상세를 다시 읽는다',
  async code => {
    const { api, after } = setup(detail([item('i1', '포스터')]))
    api.on('POST', `${BASE}/r1/items/i1/cancel`, () => json({ error: code }, 409))
    await open()
    fireEvent.click(screen.getByRole('button', { name: '품목 취소' }))
    const dialog = await screen.findByRole('dialog', { name: '이 품목을 취소할까요?' })
    fireEvent.change(within(dialog).getByLabelText('취소 사유'), { target: { value: '사유' } })
    after.current = detail([item('i1', '포스터', { paid: true, actions: [] })])
    fireEvent.click(within(dialog).getByRole('button', { name: '품목 취소' }))
    expect(await screen.findByText(PURCHASE_ERRORS[code] ?? '')).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: '이 품목을 취소할까요?' })).toBeNull()
    expect(screen.getByText('결제함')).toBeTruthy()
  },
)

test('403이면 학생회를 다시 읽고 이유를 보인다', async () => {
  const { api, handlers } = setup(detail([item('i1', '포스터')]))
  api.on('POST', `${BASE}/r1/items/i1/cancel`, () => json({ error: 'FORBIDDEN' }, 403))
  await open()
  fireEvent.click(screen.getByRole('button', { name: '품목 취소' }))
  const dialog = await screen.findByRole('dialog', { name: '이 품목을 취소할까요?' })
  fireEvent.change(within(dialog).getByLabelText('취소 사유'), { target: { value: '사유' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '품목 취소' }))
  expect((await screen.findByRole('alert')).textContent).toBe(PERMISSION_CHANGED)
  expect(handlers.onForbidden).toHaveBeenCalled()
})

test('404면 닫고 이유를 보인다', async () => {
  const { api } = setup(detail([item('i1', '포스터')]))
  api.on('POST', `${BASE}/r1/items/i1/cancel`, () => json({ error: 'NOT_FOUND' }, 404))
  await open()
  fireEvent.click(screen.getByRole('button', { name: '품목 취소' }))
  const dialog = await screen.findByRole('dialog', { name: '이 품목을 취소할까요?' })
  fireEvent.change(within(dialog).getByLabelText('취소 사유'), { target: { value: '사유' } })
  fireEvent.click(within(dialog).getByRole('button', { name: '품목 취소' }))
  expect((await screen.findByRole('alert')).textContent).toBe(PURCHASE_LOST)
})
