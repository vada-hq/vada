// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { json, mockApi } from './test-support/mock-api'
import { event, eventsPath, membership, messagesPath, purchasesPath, user } from './test-support/workflow-fixtures'
import './purchases/LinkDialog.test-support'

const auth = vi.hoisted(() => ({ useSession: vi.fn(), social: vi.fn(), signOut: vi.fn() }))
vi.mock('./auth/auth-client', () => ({ authClient: { useSession: auth.useSession,
  signIn: { social: auth.social }, signOut: auth.signOut } }))
let api: ReturnType<typeof mockApi>
function session(finance = false) {
  auth.useSession.mockReturnValue({ data: { user: user(finance) }, isPending: false, error: null })
  api.on('GET', '/api/me/memberships', () => json({ memberships: [membership(finance)] }))
}
beforeEach(() => {
  vi.resetAllMocks()
  api = mockApi()
  session()
  api.on('GET', eventsPath, () => json({ events: [event()] }))
  api.on('GET', messagesPath(), () => json({ messages: [], nextCursor: null }))
  api.on('GET', purchasesPath(), () => json({ requests: [], nextCursor: null }))
})
afterEach(() => {
  cleanup()
  try { api.assertNoUnexpectedRequests() } finally { vi.unstubAllGlobals(); vi.restoreAllMocks() }
})

test.each([false, true])('session and membership connect the real workspace; finance=%s', async finance => {
  session(finance)
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  await screen.findByText('아직 대화가 없어요.')
  fireEvent.click(screen.getByRole('tab', { name: '구매요청' }))
  await screen.findByText('아직 내 요청서가 없어요.')
  expect(Boolean(screen.queryByRole('button', { name: '재정부 제출 요청 보기' }))).toBe(finance)
})

test('membership failure can be retried without restarting authentication', async () => {
  api.on('GET', '/api/me/memberships', () => json({ error: 'UNAVAILABLE' }, 503))
  render(<App />)
  await screen.findByRole('alert')
  session()
  fireEvent.click(screen.getByRole('button', { name: '소속 다시 확인' }))
  expect(await screen.findByRole('button', { name: '체육대회' })).toBeTruthy()
  expect(auth.social).not.toHaveBeenCalled()
})

test.each(['switch', 'logout'])('%s clears the previous account workspace and unsent message', async action => {
  const view = render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  await screen.findByText('아직 대화가 없어요.')
  fireEvent.change(screen.getByLabelText('메시지'), { target: { value: '이전 계정의 입력' } })
  if (action === 'logout') {
    auth.signOut.mockResolvedValue({})
    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledOnce())
    auth.useSession.mockReturnValue({ data: null, isPending: false, error: null })
    view.rerender(<App />)
    expect(screen.getByRole('button', { name: 'Google로 로그인' })).toBeTruthy()
    expect(screen.queryByLabelText('메시지')).toBeNull()
  }
  session(true)
  view.rerender(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '체육대회' }))
  await screen.findByText('아직 대화가 없어요.')
  expect((screen.getByLabelText('메시지') as HTMLTextAreaElement).value).toBe('')
  expect(screen.queryByText('기획 테스터')).toBeNull()
})
