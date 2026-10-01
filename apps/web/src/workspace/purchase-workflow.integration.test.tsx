// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Workspace from './Workspace'
import { deferredResponse, json, mockApi } from '../test-support/mock-api'
import { event, eventsPath, membership, message, messagesPath, purchasesPath, request, user } from '../test-support/workflow-fixtures'
import { link } from '../purchases/purchase-test-fixtures'
import '../purchases/LinkDialog.test-support'

let api: ReturnType<typeof mockApi>
const base = purchasesPath()
const workspace = (finance = false) => <Workspace memberships={[membership(finance)]} user={user(finance)}
  logoutBusy={false} onLogout={() => {}} />
beforeEach(() => {
  api = mockApi()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  api.on('GET', eventsPath, () => json({ events: [event(), event('e2')] }))
  for (const id of ['e', 'e2']) {
    api.on('GET', messagesPath(id), () => json({ messages: [], nextCursor: null }))
    api.on('GET', purchasesPath(id), () => json({ requests: [], nextCursor: null }))
  }
})
afterEach(() => {
  cleanup()
  try { api.assertNoUnexpectedRequests() } finally { vi.unstubAllGlobals(); vi.restoreAllMocks() }
})
async function enterEvent() {
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  await screen.findByRole('button', { name: '대화 다시 불러오기' })
}
async function generate() {
  fireEvent.click(screen.getByRole('button', { name: '끼룩이' }))
  await waitFor(() => expect(screen.getByRole('button', { name: '초안 만들기' }).hasAttribute('disabled')).toBe(true))
  fireEvent.change(screen.getByLabelText('쿠팡 상품 링크'), { target: { value: link } })
  await waitFor(() => expect(screen.getByRole('button', { name: '초안 만들기' }).hasAttribute('disabled')).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: '초안 만들기' }))
}

test.each(['approved', 'rejected'] as const)('chat → draft → save → submit → finance %s → requester result', async decision => {
  const saved = request({ purpose: '체육대회 접수용', version: 2 })
  const submitted = request({ ...saved, status: 'submitted', version: 3 })
  const decided = request({ ...submitted, status: decision, version: 4, history: [{ id: 'h', actorId: 'f',
    action: decision, version: 4, changes: {}, reason: decision === 'rejected' ? '수량 재확인' : null,
    createdAt: event().createdAt }] })
  // Script contract responses at each stage; do not reproduce backend authorization or business rules.
  api.on('POST', messagesPath(), () => json({ message: message() }))
  api.on('POST', `${base}/drafts`, () => json({ request: request() }))
  api.on('PATCH', `${base}/r`, () => json({ request: saved }))
  api.on('POST', `${base}/r/submit`, () => json({ request: submitted }))
  const planning = render(workspace())
  await enterEvent()
  await screen.findByText('아직 대화가 없어요.')
  fireEvent.change(screen.getByLabelText('메시지'), { target: { value: message().content } })
  api.on('GET', messagesPath(), () => json({ messages: [message()], nextCursor: null }))
  fireEvent.click(screen.getByRole('button', { name: '전송' }))
  expect(await within(screen.getByRole('region', { name: '대화 기록' })).findByText(message().content)).toBeTruthy()
  expect(api.calls.find(c => c.method === 'POST' && c.path === messagesPath())?.body).toEqual({ content: message().content })
  await generate()
  await screen.findByRole('heading', { name: '구매요청서 · 검토 대기' })
  expect(api.calls.find(c => c.path === `${base}/drafts`)?.body).toEqual({ links: [link], idempotencyKey: expect.any(String) })
  fireEvent.change(screen.getByLabelText('구매 목적'), { target: { value: saved.purpose } })
  fireEvent.click(screen.getByRole('button', { name: '초안 저장' }))
  await screen.findByText('저장했어요.')
  expect(api.calls.find(c => c.method === 'PATCH')?.body).toMatchObject({ purpose: saved.purpose, version: 1 })
  fireEvent.click(screen.getByRole('button', { name: '요청서 제출' }))
  await screen.findByRole('heading', { name: '구매요청서 · 접수' })
  expect(api.calls.find(c => c.path.endsWith('/submit'))?.body).toEqual({ version: 2 })
  expect(screen.getByLabelText('구매 목적').closest('fieldset')?.disabled).toBe(true)
  expect(screen.queryByRole('button', { name: '초안 저장' })).toBeNull()
  planning.unmount()

  api.on('GET', `${base}/finance`, () => json({ requests: [submitted], nextCursor: null }))
  api.on('GET', `${base}/finance/r`, () => json({ request: submitted }))
  api.on('POST', `${base}/finance/r/decision`, () => json({ request: decided }))
  const finance = render(workspace(true))
  await enterEvent()
  fireEvent.click(screen.getByRole('tab', { name: '구매요청' }))
  fireEvent.click(screen.getByRole('button', { name: '재정부 제출 요청 보기' }))
  fireEvent.click(await screen.findByRole('button', { name: /체육대회 접수용/ }))
  await screen.findByRole('heading', { name: '구매요청서 · 접수' })
  if (decision === 'rejected') fireEvent.change(screen.getByLabelText('반려 사유'), { target: { value: '수량 재확인' } })
  fireEvent.click(screen.getByRole('button', { name: decision === 'approved' ? '요청 승인' : '요청 반려' }))
  const label = decision === 'approved' ? '승인' : '반려'
  await screen.findByRole('heading', { name: `구매요청서 · ${label}` })
  expect(api.calls.find(c => c.path.endsWith('/decision'))?.body).toEqual({ version: 3, decision,
    ...(decision === 'rejected' ? { reason: '수량 재확인' } : {}) })
  finance.unmount()

  api.on('GET', base, () => json({ requests: [decided], nextCursor: null }))
  api.on('GET', `${base}/r`, () => json({ request: decided }))
  render(workspace())
  await enterEvent()
  fireEvent.click(screen.getByRole('tab', { name: '구매요청' }))
  fireEvent.click(await screen.findByRole('button', { name: /체육대회 접수용/ }))
  expect(await screen.findByRole('heading', { name: `구매요청서 · ${label}` })).toBeTruthy()
  if (decision === 'rejected') expect(within(screen.getByRole('region', { name: '반려 결과' })).getByText('수량 재확인')).toBeTruthy()
  expect(screen.queryByRole('button', { name: '요청 승인' })).toBeNull()
})

test('a late draft response after changing events cannot open the old request in the new event', async () => {
  const pending = deferredResponse()
  // Deliberately ignore abort in this handler to exercise the component's stale-response guard.
  api.on('POST', `${base}/drafts`, () => pending.promise)
  render(workspace())
  await enterEvent()
  await generate()
  await waitFor(() => expect(api.calls.some(c => c.path.endsWith('/drafts'))).toBe(true))
  fireEvent.click(screen.getByRole('button', { name: '축제' }))
  expect(api.calls.find(c => c.path.endsWith('/drafts'))?.signal?.aborted).toBe(true)
  await act(async () => pending.resolve(json({ request: request() })))
  expect(screen.getByRole('heading', { name: '축제' })).toBeTruthy()
  expect(screen.queryByRole('heading', { name: /구매요청서 ·/ })).toBeNull()
  fireEvent.click(screen.getByRole('tab', { name: '구매요청' }))
  expect(await screen.findByText('아직 내 요청서가 없어요.')).toBeTruthy()
})
