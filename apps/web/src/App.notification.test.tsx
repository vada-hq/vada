// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderApp } from './test-support/render-app'
import { messagePage, roomDetail, roomList } from './test-support/chat-fixtures'
import { councilView, myCouncil, teamResponse } from './test-support/council-fixtures'
import { homeResponse } from './test-support/home-fixtures'
import { json, mockApi } from './test-support/mock-api'
import { taskDetail } from './test-support/task-detail-fixtures'
import { purchaseDetail } from './test-support/purchase-fixtures'
import { PURCHASE_LOST, TASK_LOST } from './lib/messages'

const auth = vi.hoisted(() => ({ useSession: vi.fn(), signOut: vi.fn() }))
vi.mock('./auth/auth-client', () => ({
  authClient: { useSession: auth.useSession, signIn: { social: vi.fn() }, signOut: auth.signOut },
}))

let api: ReturnType<typeof mockApi>
const listeners: ((event: { data: unknown }) => void)[] = []
beforeEach(() => {
  listeners.length = 0
  window.history.replaceState(null, '', '/')
  api = mockApi()
  auth.useSession.mockReturnValue({
    data: { user: { id: 'u1', name: '김회장', email: 'kim@example.test' } },
    isPending: false,
    error: null,
    refetch: vi.fn(),
  })
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      addEventListener: (_type: string, listener: (event: { data: unknown }) => void) =>
        listeners.push(listener),
      removeEventListener: () => undefined,
    },
  })
  api.on('GET', '/api/me/councils', () =>
    json({ councils: [myCouncil('c1'), myCouncil('c2', '다른 학생회')] }),
  )
  for (const id of ['c1', 'c2']) {
    api.on('GET', `/api/organizations/${id}`, () => json(councilView(id)))
    api.on('GET', `/api/organizations/${id}/members`, () => json(teamResponse()))
    api.on('GET', `/api/organizations/${id}/rooms`, () => json(roomList()))
    api.on('GET', `/api/organizations/${id}/home`, () => json(homeResponse()))
    api.on('GET', `/api/organizations/${id}/tasks?view=mine&status=open`, () =>
      json({ tasks: [], truncated: false }),
    )
    api.on('GET', `/api/organizations/${id}/rooms/r1`, () => json(roomDetail()))
    api.on('GET', `/api/organizations/${id}/rooms/r1/messages`, () => json(messagePage()))
    api.on(
      'POST',
      `/api/organizations/${id}/rooms/r1/read`,
      () => new Response(null, { status: 204 }),
    )
  }
})
afterEach(() => {
  cleanup()
  Reflect.deleteProperty(navigator, 'serviceWorker')
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('앱이 닫혀 있다가 알림 주소로 열리면 그 학생회의 그 방이 열린다', async () => {
  window.history.replaceState(null, '', '/chat/c2/r1')
  await renderApp()
  expect(await screen.findByText('모레 회의 있어요', {}, { timeout: 5000 })).toBeTruthy()
  expect(api.calls.some(call => call.path === '/api/organizations/c2/rooms/r1')).toBe(true)
  expect(api.calls.some(call => call.path === '/api/organizations/c1/rooms/r1')).toBe(false)
  expect(window.location.pathname).toBe('/')
})

test('내 학생회가 아닌 학생회의 방 주소는 무시하고 첫 학생회의 방 목록을 연다', async () => {
  window.history.replaceState(null, '', '/chat/other/r1')
  await renderApp()
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  expect(screen.queryByText('모레 회의 있어요')).toBeNull()
  expect(api.calls.some(call => call.path.includes('/other/'))).toBe(false)
})

test('열려 있는 동안 알림을 누르면 보던 곳에서 그 방으로 옮겨 간다', async () => {
  await renderApp()
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  act(() => listeners[0]!({ data: { type: 'vada:open', url: '/chat/c1/r1' } }))
  expect(await screen.findByText('모레 회의 있어요', {}, { timeout: 5000 })).toBeTruthy()
})

test('내 학생회가 아닌 방 알림을 눌러도 열려 있는 방과 화면은 그대로다', async () => {
  await renderApp()
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  act(() => listeners[0]!({ data: { type: 'vada:open', url: '/chat/c1/r1' } }))
  expect(await screen.findByText('모레 회의 있어요', {}, { timeout: 5000 })).toBeTruthy()
  const before = api.calls.length
  act(() => listeners[0]!({ data: { type: 'vada:open', url: '/chat/other/r1' } }))
  await new Promise(resolve => setTimeout(resolve, 50))
  expect(screen.getByText('모레 회의 있어요')).toBeTruthy()
  expect(api.calls.length).toBe(before)
})

test('알림으로 연 방은 한 번만 쓴다. 운영진 화면에 갔다 대화로 돌아오면 방 목록이 열린다', async () => {
  window.history.replaceState(null, '', '/chat/c1/r1')
  await renderApp()
  expect(await screen.findByText('모레 회의 있어요', {}, { timeout: 5000 })).toBeTruthy()
  const aside = screen.getByRole('complementary', { name: '학생회 작업 공간' })
  fireEvent.click(within(aside).getByRole('button', { name: '사람' }))
  expect(await screen.findByRole('heading', { level: 1, name: '사람' })).toBeTruthy()
  fireEvent.click(within(aside).getByRole('button', { name: /^대화/ }))
  expect(await screen.findByRole('button', { name: /운영진 전체방/ })).toBeTruthy()
  expect(screen.queryByText('모레 회의 있어요')).toBeNull()
})

const T1 = '3f2b8c1e-6a4d-4e0b-9c57-1a2b3c4d5e6f'
const taskCalls = () => api.calls.filter(call => call.path.includes('/tasks/'))
function taskApi(id = 'c1', taskId = T1) {
  api.on('GET', `/api/organizations/${id}/tasks/${taskId}`, () =>
    json({ task: taskDetail({ title: '현수막 주문' }) }),
  )
}
// 상세가 열리고 업무를 읽어 제목이 보일 때까지 기다린다.
const taskDialog = async () => {
  await waitFor(
    () => expect(within(screen.getByRole('dialog')).getByText('현수막 주문')).toBeTruthy(),
    { timeout: 5000 },
  )
  return '현수막 주문'
}

test('앱이 닫혀 있다가 업무 주소로 열리면 그 학생회의 업무 화면과 그 업무 상세가 열린다', async () => {
  taskApi('c2')
  window.history.replaceState(null, '', `/tasks/c2/${T1}`)
  await renderApp()
  expect(await taskDialog()).toContain('현수막 주문')
  expect(await screen.findByRole('heading', { level: 1, name: '업무', hidden: true })).toBeTruthy()
  expect(api.calls.some(call => call.path === `/api/organizations/c2/tasks/${T1}`)).toBe(true)
  expect(api.calls.some(call => call.path.startsWith('/api/organizations/c1/tasks/'))).toBe(false)
  expect(window.location.pathname).toBe('/')
})

test('열려 있는 동안 서비스 워커가 업무 주소를 알리면 보던 곳에서 그 업무 상세로 옮겨 간다', async () => {
  taskApi()
  await renderApp()
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  act(() => listeners[0]!({ data: { type: 'vada:open', url: `/tasks/c1/${T1}` } }))
  expect(await taskDialog()).toContain('현수막 주문')
  expect(await screen.findByRole('heading', { level: 1, name: '업무', hidden: true })).toBeTruthy()
})

test('같은 업무 알림을 다시 누르면 닫았던 상세가 다시 열린다', async () => {
  taskApi()
  await renderApp()
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  const press = () =>
    act(() => listeners[0]!({ data: { type: 'vada:open', url: `/tasks/c1/${T1}` } }))
  press()
  await taskDialog()
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  press()
  expect(await taskDialog()).toContain('현수막 주문')
})

test.each([
  ['내 학생회가 아닌', `/tasks/other/${T1}`],
  ['다른 사이트의', `https://evil.example/tasks/c1/${T1}`],
  ['번호가 uuid가 아닌', '/tasks/c1/not-a-uuid'],
])('%s 업무 알림을 눌러도 아무것도 바뀌지 않는다', async (_name, url) => {
  await renderApp()
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  const before = api.calls.length
  act(() => listeners[0]!({ data: { type: 'vada:open', url } }))
  await new Promise(resolve => setTimeout(resolve, 50))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  expect(api.calls.length).toBe(before)
  expect(taskCalls()).toEqual([])
})

test.each([
  ['내 학생회가 아닌', `/tasks/other/${T1}`],
  ['번호가 uuid가 아닌', '/tasks/c1/not-a-uuid'],
])('%s 업무 주소로 열면 첫 학생회의 홈이 열리고 업무는 읽지 않는다', async (_name, path) => {
  window.history.replaceState(null, '', path)
  await renderApp()
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(taskCalls()).toEqual([])
})

test('지운 업무의 알림을 누르면 "이 업무를 볼 수 없어요"가 보인다', async () => {
  api.on('GET', `/api/organizations/c1/tasks/${T1}`, () => json({ error: 'NOT_FOUND' }, 404))
  window.history.replaceState(null, '', `/tasks/c1/${T1}`)
  await renderApp()
  expect((await screen.findByRole('alert', {}, { timeout: 5000 })).textContent).toBe(TASK_LOST)
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('알림으로 연 업무는 한 번만 쓴다. 다른 화면에 갔다 업무로 돌아오면 상세가 닫혀 있다', async () => {
  taskApi()
  window.history.replaceState(null, '', `/tasks/c1/${T1}`)
  await renderApp()
  await taskDialog()
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  const aside = screen.getByRole('complementary', { name: '학생회 작업 공간' })
  fireEvent.click(within(aside).getByRole('button', { name: '사람' }))
  expect(await screen.findByRole('heading', { level: 1, name: '사람' })).toBeTruthy()
  fireEvent.click(within(aside).getByRole('button', { name: /^업무/ }))
  expect(await screen.findByRole('heading', { level: 1, name: '업무', hidden: true })).toBeTruthy()
  await new Promise(resolve => setTimeout(resolve, 50))
  expect(screen.queryByRole('dialog')).toBeNull()
})

const R1 = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const requestCalls = () => api.calls.filter(call => call.path.includes('/purchase-requests/'))
function requestApi(id = 'c1', requestId = R1) {
  api.on('GET', `/api/organizations/${id}/purchase-requests?view=mine`, () =>
    json({ requests: [], truncated: false }),
  )
  api.on('GET', `/api/organizations/${id}/purchase-requests/${requestId}`, () =>
    json({ request: purchaseDetail(requestId, { title: '테이프 구매' }) }),
  )
}
const requestDialog = () =>
  waitFor(() => expect(within(screen.getByRole('dialog')).getByText('테이프 구매')).toBeTruthy(), {
    timeout: 5000,
  })
const financeHeading = () => screen.findByRole('heading', { level: 1, name: '재정', hidden: true })

test('앱이 닫혀 있다가 요청 주소로 열리면 그 학생회의 재정 화면과 그 요청 상세가 열린다', async () => {
  requestApi('c2')
  window.history.replaceState(null, '', `/purchases/c2/${R1}`)
  await renderApp()
  await requestDialog()
  expect(await financeHeading()).toBeTruthy()
  expect(
    api.calls.some(call => call.path === `/api/organizations/c2/purchase-requests/${R1}`),
  ).toBe(true)
  expect(requestCalls().some(call => call.path.startsWith('/api/organizations/c1/'))).toBe(false)
  expect(window.location.pathname).toBe('/')
})

test('열려 있는 동안 서비스 워커가 요청 주소를 알리면 보던 곳에서 그 요청 상세로 옮겨 간다', async () => {
  requestApi()
  await renderApp()
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  act(() => listeners[0]!({ data: { type: 'vada:open', url: `/purchases/c1/${R1}` } }))
  await requestDialog()
  expect(await financeHeading()).toBeTruthy()
})

test('같은 요청 알림을 다시 누르면 닫았던 상세가 다시 열린다', async () => {
  requestApi()
  await renderApp()
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  const press = () =>
    act(() => listeners[0]!({ data: { type: 'vada:open', url: `/purchases/c1/${R1}` } }))
  press()
  await requestDialog()
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  press()
  await requestDialog()
})

test.each([
  ['내 학생회가 아닌', `/purchases/other/${R1}`],
  ['다른 사이트의', `https://evil.example/purchases/c1/${R1}`],
  ['번호가 uuid가 아닌', '/purchases/c1/not-a-uuid'],
])('%s 요청 알림을 눌러도 아무것도 바뀌지 않는다', async (_name, url) => {
  await renderApp()
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  const before = api.calls.length
  act(() => listeners[0]!({ data: { type: 'vada:open', url } }))
  await new Promise(resolve => setTimeout(resolve, 50))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  expect(api.calls.length).toBe(before)
})

test.each([
  ['내 학생회가 아닌', `/purchases/other/${R1}`],
  ['번호가 uuid가 아닌', '/purchases/c1/not-a-uuid'],
])('%s 요청 주소로 열면 첫 학생회의 홈이 열리고 요청은 읽지 않는다', async (_name, path) => {
  window.history.replaceState(null, '', path)
  await renderApp()
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(requestCalls()).toEqual([])
})

test('지운 요청의 알림을 누르면 "이 요청을 볼 수 없어요"가 보이고 상세는 닫힌다', async () => {
  api.on('GET', `/api/organizations/c1/purchase-requests?view=mine`, () =>
    json({ requests: [], truncated: false }),
  )
  api.on('GET', `/api/organizations/c1/purchase-requests/${R1}`, () =>
    json({ error: 'NOT_FOUND' }, 404),
  )
  window.history.replaceState(null, '', `/purchases/c1/${R1}`)
  await renderApp()
  expect((await screen.findByRole('alert', {}, { timeout: 5000 })).textContent).toBe(PURCHASE_LOST)
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('알림으로 연 요청은 한 번만 쓴다. 다른 화면에 갔다 재정으로 돌아오면 상세가 닫혀 있다', async () => {
  requestApi()
  window.history.replaceState(null, '', `/purchases/c1/${R1}`)
  await renderApp()
  await requestDialog()
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  const aside = screen.getByRole('complementary', { name: '학생회 작업 공간' })
  fireEvent.click(within(aside).getByRole('button', { name: '사람' }))
  expect(await screen.findByRole('heading', { level: 1, name: '사람' })).toBeTruthy()
  fireEvent.click(within(aside).getByRole('button', { name: /^재정/ }))
  expect(await financeHeading()).toBeTruthy()
  await new Promise(resolve => setTimeout(resolve, 50))
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('로그아웃하는 동안 옆 메뉴의 로그아웃 단추는 막혀 한 번만 보낸다', async () => {
  auth.signOut.mockReturnValue(new Promise(() => undefined))
  await renderApp()
  const aside = await screen.findByRole('complementary', { name: '학생회 작업 공간' })
  const button = within(aside).getByRole('button', { name: '로그아웃' }) as HTMLButtonElement
  fireEvent.click(button)
  await waitFor(() => expect(button.disabled).toBe(true))
  fireEvent.click(button)
  await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1))
})
