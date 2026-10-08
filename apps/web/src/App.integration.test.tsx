// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from './App'
import { deferredResponse, json, mockApi } from './test-support/mock-api'
import { event, eventsPath, membership, messagesPath, purchaseItemsPath, reviewPath, user } from './test-support/workflow-fixtures'
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
  api.on('GET', purchaseItemsPath(), () => json({ items: [], truncated: false }))
  api.on('GET', reviewPath, () => json({ pending: [], approved: [], truncated: false }))
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
  fireEvent.click(screen.getByRole('tab', { name: '구매' }))
  await screen.findByText('아직 담은 품목이 없어요')
  // 구매 승인 권한이 있으면 옆 메뉴에 구매 검토가 생긴다.
  expect(Boolean(within(screen.getByRole('navigation', { name: '학생회 메뉴' })).queryByRole('button', { name: /구매 검토/ }))).toBe(finance)
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

test('소속이 없으면 학생회를 만들고, 구성원 화면에서 초대를 시작한다', async () => {
  const leader = { ...membership(), department: { id: 'lead', name: '회장단', handlesFinance: false, isLeadership: true },
    permissions: { manageOrganization: true, approvePurchases: true } }
  api.on('GET', '/api/me/memberships', () => json({ memberships: [] }))
  api.on('POST', '/api/organizations/create', () => {
    api.on('GET', '/api/me/memberships', () => json({ memberships: [leader] }))
    return json({ membership: leader }, 201)
  })
  api.on('GET', '/api/organizations/o/members', () => json({ viewer: leader,
    departments: [leader.department, { id: 'fin', name: '총무부', isLeadership: false, handlesFinance: true }],
    members: [{ id: 'mp', name: '기획 테스터', title: null, departmentId: 'lead' }] }))
  render(<App />)
  await screen.findByLabelText('초대 코드')
  expect(screen.getByText('학생회를 처음 시작하나요?')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '새 학생회 만들기' }))
  fireEvent.change(screen.getByLabelText('학생회 이름'), { target: { value: '테스트 학생회' } })
  fireEvent.click(screen.getByRole('button', { name: '학생회 만들기' }))
  expect(await screen.findByRole('heading', { name: '구성원 1명' })).toBeTruthy()
  expect(screen.getByText('아직 혼자예요')).toBeTruthy()
  expect(api.calls.filter(call => call.method === 'POST').map(call => call.body)).toEqual([{ name: '테스트 학생회', departments: [
    { name: '총무부', handlesFinance: true }, { name: '기획부', handlesFinance: false }, { name: '홍보부', handlesFinance: false },
    { name: '복지부', handlesFinance: false }] }])
})

test('만들기를 취소하면 코드 입력으로 돌아간다', async () => {
  api.on('GET', '/api/me/memberships', () => json({ memberships: [] }))
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '새 학생회 만들기' }))
  fireEvent.click(screen.getByRole('button', { name: '취소' }))
  expect(await screen.findByLabelText('초대 코드')).toBeTruthy()
})

// 본인 소속이 바뀌는 흐름. 응답이 늦게 와도 소속을 한 번만 다시 불러와야 한다(리뷰에서 찾은 무한 요청).
function leaderSetup(secondMemberships: () => Response | Promise<Response>) {
  const leader = { ...membership(), department: { id: 'lead', name: '회장단', handlesFinance: false, isLeadership: true },
    permissions: { manageOrganization: true, approvePurchases: true } }
  const titled = { ...leader, title: '회장' }
  const list = (viewer: typeof leader) => json({ viewer, departments: [leader.department],
    members: [{ id: 'mp', name: '기획 테스터', title: viewer.title, departmentId: 'lead' }] })
  let count = 0
  api.on('GET', '/api/me/memberships', () => ++count === 1 ? json({ memberships: [leader] }) : secondMemberships())
  api.on('GET', '/api/organizations/o/members', () => list(leader))
  api.on('POST', '/api/organizations/o/members/mp/title', () => list(titled))
  return { leader, titled, count: () => count }
}
async function saveOwnTitle() {
  render(<App />)
  fireEvent.click(within(await screen.findByRole('navigation', { name: '학생회 메뉴' })).getByRole('button', { name: /구성원/ }))
  fireEvent.click(await screen.findByRole('button', { name: '기획 테스터 직책' }))
  fireEvent.change(within(await screen.findByRole('dialog')).getByLabelText('직책'), { target: { value: '회장' } })
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '저장' }))
}

test('본인 직책을 바꾸면 소속을 한 번만 다시 불러오고, 응답이 오면 사이드바가 바뀐다', async () => {
  const second = deferredResponse()
  const setup = leaderSetup(() => second.promise)
  await saveOwnTitle()
  await waitFor(() => expect(setup.count()).toBe(2))
  await new Promise(resolve => setTimeout(resolve, 50))
  expect(setup.count()).toBe(2)
  // 첫 요청은 이미 응답을 받았으므로 정리할 때 abort돼도 해가 없다. 다시 불러오는 요청은 끊기면 안 된다.
  expect(api.calls.filter(call => call.path === '/api/me/memberships').slice(1).some(call => call.signal?.aborted)).toBe(false)
  second.resolve(json({ memberships: [setup.titled] }))
  expect(await screen.findByText('회장단 · 회장')).toBeTruthy()
  expect(setup.count()).toBe(2)
})

test('다시 불러온 소속이 여전히 달라도 되풀이해서 불러오지 않는다', async () => {
  let stale: unknown
  const setup = leaderSetup(() => json({ memberships: [stale] }))
  stale = setup.leader
  await saveOwnTitle()
  await waitFor(() => expect(setup.count()).toBe(2))
  await new Promise(resolve => setTimeout(resolve, 100))
  expect(setup.count()).toBe(2)
})
