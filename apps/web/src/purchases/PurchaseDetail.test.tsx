// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import PurchaseDetail from './PurchaseDetail'
import { draft } from './purchase-test-fixtures'
import { json, mockApi } from '../test-support/mock-api'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
test('a detail loaded in an inactive panel does not steal keyboard focus', () => {
  const control = document.createElement('button')
  document.body.append(control)
  control.focus()
  render(<div hidden><PurchaseDetail request={draft()} busy={false} stale={false} dirty={false} finance={false}
    onDirty={() => {}} onSave={() => {}} onDiscard={() => {}} onReload={() => {}} onSubmit={() => {}} onDecide={() => {}}
    onBack={() => {}} /></div>)
  try { expect(document.activeElement).toBe(control) } finally { control.remove() }
})
test('detail focuses its heading, separates evidence and delegates navigation', () => {
  const back = vi.fn(), chat = vi.fn()
  render(<PurchaseDetail request={draft()} busy={false} stale={false} dirty={false} finance={false}
    onDirty={() => {}} onSave={() => {}} onDiscard={() => {}} onReload={() => {}} onSubmit={() => {}} onDecide={() => {}}
    onBack={back} onReturnToChat={chat} />)
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: '구매요청서 · 검토 대기' }))
  expect(screen.getByRole('complementary', { name: '요청서 근거와 이력' }).textContent).toContain('테이블 2개 준비')
  fireEvent.click(screen.getByRole('button', { name: '대화로 돌아가기' }))
  fireEvent.click(screen.getByRole('button', { name: '요청 목록으로' }))
  expect(chat).toHaveBeenCalledOnce()
  expect(back).toHaveBeenCalledOnce()
})
test('only an approved request shows purchase processing with delivery status', async () => {
  const api = mockApi()
  api.on('GET', '/api/organizations/o/events/e/deliveries', () => json({ nextCursor: null,
    items: [{ id: 'i', requestId: 'r', productName: '테이블', quantity: 2, shipments: [] }] }))
  const detail = (status: 'approved' | 'submitted') => <PurchaseDetail request={{ ...draft(), status }} busy={false} stale={false} dirty={false} finance={false}
    onDirty={() => {}} onSave={() => {}} onDiscard={() => {}} onReload={() => {}} onSubmit={() => {}} onDecide={() => {}} onBack={() => {}} />
  const view = render(detail('approved'))
  expect(await screen.findByRole('region', { name: '구매·발주 처리' })).toBeTruthy()
  view.rerender(detail('submitted'))
  expect(screen.queryByRole('region', { name: '구매·발주 처리' })).toBeNull()
  expect(api.calls).toHaveLength(1)
  api.assertNoUnexpectedRequests()
})
