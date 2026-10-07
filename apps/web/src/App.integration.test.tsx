// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { deferredResponse, json, mockApi } from './test-support/mock-api'
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
  window.history.replaceState(null, '', '/')
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

const preview = (joined = false) => json({ organization: { id: 'o', name: '테스트 학생회' }, joined })

test('code entry joins a council as unassigned and opens its workspace', async () => {
  api.on('GET', '/api/me/memberships', () => json({ memberships: [] }))
  api.on('GET', '/api/invites/ABCD2345', () => preview())
  api.on('POST', '/api/organizations/join', () => {
    api.on('GET', '/api/me/memberships', () => json({ memberships: [{ ...membership(), department: null }] }))
    return json({ membership: { ...membership(), department: null } })
  })
  render(<App />)
  const input = await screen.findByLabelText('초대 코드')
  expect(screen.getByRole('button', { name: '학생회 확인' }).hasAttribute('disabled')).toBe(true)
  fireEvent.change(input, { target: { value: ' abcd-2345 ' } })
  fireEvent.click(screen.getByRole('button', { name: '학생회 확인' }))
  expect(await screen.findByText('테스트 학생회에 참여할까요?')).toBeTruthy()
  expect(screen.getByText('참여하면 미배정 구성원으로 등록돼요.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '참여하기' }))
  expect(await screen.findByRole('button', { name: '체육대회' })).toBeTruthy()
  expect(screen.getByText('미배정')).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'POST').map(call => call.body)).toEqual([{ code: 'ABCD2345' }])
})

test('a wrong code can be corrected from the form', async () => {
  api.on('GET', '/api/me/memberships', () => json({ memberships: [] }))
  api.on('GET', '/api/invites/ZZZZ9999', () => json({ error: 'NOT_FOUND' }, 404))
  render(<App />)
  fireEvent.change(await screen.findByLabelText('초대 코드'), { target: { value: 'zzzz9999' } })
  fireEvent.click(screen.getByRole('button', { name: '학생회 확인' }))
  expect((await screen.findByRole('alert')).textContent).toContain('초대 코드가 올바르지 않아요')
  fireEvent.click(screen.getByRole('button', { name: '다시 입력' }))
  expect(((await screen.findByLabelText('초대 코드')) as HTMLInputElement).value).toBe('ZZZZ9999')
})

test('an existing member opening an invite link goes straight to the workspace', async () => {
  window.history.replaceState(null, '', '/join/ABCD2345')
  api.on('GET', '/api/invites/ABCD2345', () => preview(true))
  render(<App />)
  expect(await screen.findByRole('button', { name: '체육대회' })).toBeTruthy()
  expect(window.location.pathname).toBe('/')
  expect(api.calls.some(call => call.method === 'POST')).toBe(false)
})

test('a broken invite link explains the problem and returns to VADA', async () => {
  window.history.replaceState(null, '', '/join/%E0%A4%A')
  api.on('GET', '/api/invites/%25E0%25A4%25A', () => json({ error: 'NOT_FOUND' }, 404))
  render(<App />)
  expect((await screen.findByRole('alert')).textContent).toContain('초대 코드가 올바르지 않아요')
  fireEvent.click(screen.getByRole('button', { name: 'VADA로 가기' }))
  expect(await screen.findByRole('button', { name: '체육대회' })).toBeTruthy()
  expect(window.location.pathname).toBe('/')
})

test('declining a link invite returns to the normal screen', async () => {
  window.history.replaceState(null, '', '/join/ABCD2345')
  api.on('GET', '/api/invites/ABCD2345', () => preview())
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '참여하지 않기' }))
  expect(await screen.findByRole('button', { name: '체육대회' })).toBeTruthy()
  expect(window.location.pathname).toBe('/')
})

test('invite lookup failure can be retried', async () => {
  window.history.replaceState(null, '', '/join/ABCD2345')
  api.on('GET', '/api/invites/ABCD2345', () => json({ error: 'UNAVAILABLE' }, 503))
  render(<App />)
  expect((await screen.findByRole('alert')).textContent).toContain('초대를 확인하지 못했어요')
  api.on('GET', '/api/invites/ABCD2345', () => preview())
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(await screen.findByText('테스트 학생회에 참여할까요?')).toBeTruthy()
})

test('join is sent once while in flight and a failure can be retried', async () => {
  window.history.replaceState(null, '', '/join/ABCD2345')
  api.on('GET', '/api/invites/ABCD2345', () => preview())
  api.on('POST', '/api/organizations/join', () => json({ error: 'UNAVAILABLE' }, 503))
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '참여하기' }))
  expect((await screen.findByRole('alert')).textContent).toContain('참여하지 못했어요')
  const pending = deferredResponse()
  api.on('POST', '/api/organizations/join', () => pending.promise)
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
  expect(screen.getByRole('button', { name: '참여하는 중…' }).hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: '참여하는 중…' }))
  pending.resolve(json({ membership: membership() }))
  expect(await screen.findByRole('button', { name: '체육대회' })).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'POST')).toHaveLength(2)
})

test('pasting the whole invite link into the code field opens that invite', async () => {
  api.on('GET', '/api/me/memberships', () => json({ memberships: [] }))
  api.on('GET', '/api/invites/ABCD2345', () => preview())
  render(<App />)
  fireEvent.change(await screen.findByLabelText('초대 코드'), { target: { value: 'https://vada-m1.onrender.com/join/ABCD2345' } })
  fireEvent.click(screen.getByRole('button', { name: '학생회 확인' }))
  expect(await screen.findByText('테스트 학생회에 참여할까요?')).toBeTruthy()
})
