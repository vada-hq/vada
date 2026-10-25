// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { renderApp } from './test-support/render-app'
import { resetWindowHistory, windowHistoryIdle } from './lib/use-window-history'
import { messagePage, room, roomDetail, roomList } from './test-support/chat-fixtures'
import { councilView, myCouncil, teamResponse } from './test-support/council-fixtures'
import { homeResponse, onHomeExtras } from './test-support/home-fixtures'
import { deferredResponse, json, mockApi } from './test-support/mock-api'
import { taskDetail } from './test-support/task-detail-fixtures'
import { purchaseDetail } from './test-support/purchase-fixtures'
import { budgetWithoutPeriod } from './test-support/budget-fixtures'
import { ADDRESS_LOST, ADDRESS_LOST_BACK, PURCHASE_LOST, TASK_LOST } from './lib/messages'

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
    json({
      councils: [
        myCouncil('0199d1a0-0000-7000-8000-0000000000c1'),
        myCouncil('0199d1a0-0000-7000-8000-0000000000c2', '다른 학생회'),
      ],
    }),
  )
  for (const id of [
    '0199d1a0-0000-7000-8000-0000000000c1',
    '0199d1a0-0000-7000-8000-0000000000c2',
  ]) {
    api.on('GET', `/api/organizations/${id}`, () => json(councilView(id)))
    api.on('GET', `/api/organizations/${id}/members`, () => json(teamResponse()))
    // 알림이 가리키는 방은 내 방 목록에 있다(없는 방 주소는 '찾을 수 없음').
    api.on('GET', `/api/organizations/${id}/rooms`, () =>
      json(
        roomList({
          rooms: [room('0199d1a0-0000-7000-8000-0000000000a1'), ...roomList().rooms.slice(1)],
        }),
      ),
    )
    api.on('GET', `/api/organizations/${id}/home`, () => json(homeResponse()))
    onHomeExtras(api, {}, id)
    api.on('GET', `/api/organizations/${id}/tasks?view=mine&status=open`, () =>
      json({ tasks: [], truncated: false }),
    )
    api.on('GET', `/api/organizations/${id}/rooms/0199d1a0-0000-7000-8000-0000000000a1`, () =>
      json(roomDetail()),
    )
    api.on(
      'GET',
      `/api/organizations/${id}/rooms/0199d1a0-0000-7000-8000-0000000000a1/messages`,
      () => json(messagePage()),
    )
    api.on(
      'POST',
      `/api/organizations/${id}/rooms/0199d1a0-0000-7000-8000-0000000000a1/read`,
      () => new Response(null, { status: 204 }),
    )
  }
})
afterEach(async () => {
  cleanup()
  // 닫힌 창이 거두는 기록 이동(history.go)이 끝난 뒤에 다음 시험이 시작되게 한다.
  await windowHistoryIdle()
  resetWindowHistory()
  Reflect.deleteProperty(navigator, 'serviceWorker')
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

test('앱이 닫혀 있다가 알림 주소로 열리면 그 학생회의 그 방이 열린다', async () => {
  window.history.replaceState(
    null,
    '',
    '/chat/0199d1a0-0000-7000-8000-0000000000c2/0199d1a0-0000-7000-8000-0000000000a1',
  )
  await renderApp()
  expect(await screen.findByText('모레 회의 있어요', {}, { timeout: 5000 })).toBeTruthy()
  expect(
    api.calls.some(
      call =>
        call.path ===
        '/api/organizations/0199d1a0-0000-7000-8000-0000000000c2/rooms/0199d1a0-0000-7000-8000-0000000000a1',
    ),
  ).toBe(true)
  expect(
    api.calls.some(
      call =>
        call.path ===
        '/api/organizations/0199d1a0-0000-7000-8000-0000000000c1/rooms/0199d1a0-0000-7000-8000-0000000000a1',
    ),
  ).toBe(false)
  expect(window.location.pathname).toBe(
    '/chat/0199d1a0-0000-7000-8000-0000000000c2/0199d1a0-0000-7000-8000-0000000000a1',
  )
})

test('내 학생회가 아닌 학생회의 방 주소는 찾을 수 없음이고 홈으로 가는 버튼이 있다', async () => {
  window.history.replaceState(
    null,
    '',
    '/chat/0199d1a0-0000-7000-8000-0000000000ee/0199d1a0-0000-7000-8000-0000000000a1',
  )
  await renderApp()
  expect(await screen.findByText(ADDRESS_LOST)).toBeTruthy()
  expect(screen.queryByText('모레 회의 있어요')).toBeNull()
  expect(api.calls.some(call => call.path.includes('/0199d1a0-0000-7000-8000-0000000000ee/'))).toBe(
    false,
  )
  fireEvent.click(screen.getByRole('button', { name: ADDRESS_LOST_BACK }))
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  expect(window.location.pathname).toBe('/home/0199d1a0-0000-7000-8000-0000000000c1')
})

test('열려 있는 동안 알림을 누르면 보던 곳에서 그 방으로 옮겨 간다', async () => {
  await renderApp()
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  act(() =>
    listeners[0]!({
      data: {
        type: 'vada:open',
        url: '/chat/0199d1a0-0000-7000-8000-0000000000c1/0199d1a0-0000-7000-8000-0000000000a1',
      },
    }),
  )
  expect(await screen.findByText('모레 회의 있어요', {}, { timeout: 5000 })).toBeTruthy()
})

test('내 학생회가 아닌 방 알림을 눌러도 열려 있는 방과 화면은 그대로다', async () => {
  await renderApp()
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  act(() =>
    listeners[0]!({
      data: {
        type: 'vada:open',
        url: '/chat/0199d1a0-0000-7000-8000-0000000000c1/0199d1a0-0000-7000-8000-0000000000a1',
      },
    }),
  )
  expect(await screen.findByText('모레 회의 있어요', {}, { timeout: 5000 })).toBeTruthy()
  const before = api.calls.length
  act(() =>
    listeners[0]!({
      data: {
        type: 'vada:open',
        url: '/chat/0199d1a0-0000-7000-8000-0000000000ee/0199d1a0-0000-7000-8000-0000000000a1',
      },
    }),
  )
  await new Promise(resolve => setTimeout(resolve, 50))
  expect(screen.getByText('모레 회의 있어요')).toBeTruthy()
  expect(api.calls.length).toBe(before)
})

test('알림으로 연 방은 한 번만 쓴다. 운영진 화면에 갔다 대화로 돌아오면 방 목록이 열린다', async () => {
  window.history.replaceState(
    null,
    '',
    '/chat/0199d1a0-0000-7000-8000-0000000000c1/0199d1a0-0000-7000-8000-0000000000a1',
  )
  await renderApp()
  expect(await screen.findByText('모레 회의 있어요', {}, { timeout: 5000 })).toBeTruthy()
  const aside = screen.getByRole('complementary', { name: '학생회 작업 공간' })
  fireEvent.click(within(aside).getByRole('button', { name: '사람' }))
  expect(await screen.findByRole('heading', { level: 1, name: '사람' })).toBeTruthy()
  fireEvent.click(within(aside).getByRole('button', { name: /^대화/ }))
  expect(await screen.findByRole('button', { name: /공지방/ })).toBeTruthy()
  expect(screen.queryByText('모레 회의 있어요')).toBeNull()
})

const C1 = '0199d1a0-0000-7000-8000-0000000000c1'
// 끝난 일을 기다린다: 이유를 남기려고 칸을 상위 목록 주소로 바꿔 썼고, 창이 거두는 기록 이동이 모두 끝났다.
const lostSettled = async (path: string) => {
  await waitFor(() => expect(window.location.pathname + window.location.search).toBe(path))
  await windowHistoryIdle()
}
const C2 = '0199d1a0-0000-7000-8000-0000000000c2'
const T1 = '3f2b8c1e-6a4d-4e0b-9c57-1a2b3c4d5e6f'
const taskCalls = () => api.calls.filter(call => call.path.includes('/tasks/'))
function taskApi(id = '0199d1a0-0000-7000-8000-0000000000c1', taskId = T1) {
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
  taskApi('0199d1a0-0000-7000-8000-0000000000c2')
  window.history.replaceState(null, '', `/tasks/0199d1a0-0000-7000-8000-0000000000c2/${T1}`)
  await renderApp()
  expect(await taskDialog()).toContain('현수막 주문')
  expect(await screen.findByRole('heading', { level: 1, name: '업무', hidden: true })).toBeTruthy()
  expect(
    api.calls.some(
      call => call.path === `/api/organizations/0199d1a0-0000-7000-8000-0000000000c2/tasks/${T1}`,
    ),
  ).toBe(true)
  expect(
    api.calls.some(call =>
      call.path.startsWith('/api/organizations/0199d1a0-0000-7000-8000-0000000000c1/tasks/'),
    ),
  ).toBe(false)
  expect(window.location.pathname).toBe(`/tasks/0199d1a0-0000-7000-8000-0000000000c2/${T1}`)
})

test('열려 있는 동안 서비스 워커가 업무 주소를 알리면 보던 곳에서 그 업무 상세로 옮겨 간다', async () => {
  taskApi()
  await renderApp()
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  act(() =>
    listeners[0]!({
      data: { type: 'vada:open', url: `/tasks/0199d1a0-0000-7000-8000-0000000000c1/${T1}` },
    }),
  )
  expect(await taskDialog()).toContain('현수막 주문')
  expect(await screen.findByRole('heading', { level: 1, name: '업무', hidden: true })).toBeTruthy()
})

test('같은 업무 알림을 다시 누르면 닫았던 상세가 다시 열린다', async () => {
  taskApi()
  await renderApp()
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  const press = () =>
    act(() =>
      listeners[0]!({
        data: { type: 'vada:open', url: `/tasks/0199d1a0-0000-7000-8000-0000000000c1/${T1}` },
      }),
    )
  press()
  await taskDialog()
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  press()
  expect(await taskDialog()).toContain('현수막 주문')
})

test.each([
  ['내 학생회가 아닌', `/tasks/0199d1a0-0000-7000-8000-0000000000ee/${T1}`],
  ['다른 사이트의', `https://evil.example/tasks/0199d1a0-0000-7000-8000-0000000000c1/${T1}`],
  ['번호가 uuid가 아닌', '/tasks/0199d1a0-0000-7000-8000-0000000000c1/not-a-uuid'],
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
  ['내 학생회가 아닌', `/tasks/0199d1a0-0000-7000-8000-0000000000ee/${T1}`],
  ['번호가 uuid가 아닌', '/tasks/0199d1a0-0000-7000-8000-0000000000c1/not-a-uuid'],
])('%s 업무 주소로 열면 찾을 수 없음이고 업무는 읽지 않는다', async (_name, path) => {
  window.history.replaceState(null, '', path)
  await renderApp()
  expect(await screen.findByText(ADDRESS_LOST)).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(taskCalls()).toEqual([])
})

test('지운 업무의 알림을 누르면 "이 업무를 볼 수 없어요"가 보인다', async () => {
  api.on('GET', `/api/organizations/0199d1a0-0000-7000-8000-0000000000c1/tasks/${T1}`, () =>
    json({ error: 'NOT_FOUND' }, 404),
  )
  window.history.replaceState(null, '', `/tasks/0199d1a0-0000-7000-8000-0000000000c1/${T1}`)
  await renderApp()
  expect((await screen.findByRole('alert', {}, { timeout: 5000 })).textContent).toBe(TASK_LOST)
  await lostSettled(`/tasks/${C1}`)
  expect(screen.getByRole('alert').textContent).toBe(TASK_LOST)
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('홈에서 지운 업무의 알림을 누르면 업무 목록에서 이유가 남고 홈으로 돌아가지 않는다', async () => {
  api.on('GET', `/api/organizations/${C1}/tasks/${T1}`, () => json({ error: 'NOT_FOUND' }, 404))
  await renderApp()
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  act(() => listeners[0]!({ data: { type: 'vada:open', url: `/tasks/${C1}/${T1}` } }))
  expect((await screen.findByRole('alert', {}, { timeout: 5000 })).textContent).toBe(TASK_LOST)
  await lostSettled(`/tasks/${C1}`)
  expect(screen.getByRole('alert').textContent).toBe(TASK_LOST)
  expect(screen.getByRole('heading', { level: 1, name: '업무', hidden: true })).toBeTruthy()
})

test('알림으로 연 업무는 한 번만 쓴다. 다른 화면에 갔다 업무로 돌아오면 상세가 닫혀 있다', async () => {
  taskApi()
  window.history.replaceState(null, '', `/tasks/0199d1a0-0000-7000-8000-0000000000c1/${T1}`)
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
function requestApi(id = '0199d1a0-0000-7000-8000-0000000000c1', requestId = R1) {
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
  requestApi('0199d1a0-0000-7000-8000-0000000000c2')
  window.history.replaceState(null, '', `/purchases/0199d1a0-0000-7000-8000-0000000000c2/${R1}`)
  await renderApp()
  await requestDialog()
  expect(await financeHeading()).toBeTruthy()
  expect(
    api.calls.some(
      call =>
        call.path ===
        `/api/organizations/0199d1a0-0000-7000-8000-0000000000c2/purchase-requests/${R1}`,
    ),
  ).toBe(true)
  expect(
    requestCalls().some(call =>
      call.path.startsWith('/api/organizations/0199d1a0-0000-7000-8000-0000000000c1/'),
    ),
  ).toBe(false)
  expect(window.location.pathname).toBe(`/purchases/0199d1a0-0000-7000-8000-0000000000c2/${R1}`)
})

test('열려 있는 동안 서비스 워커가 요청 주소를 알리면 보던 곳에서 그 요청 상세로 옮겨 간다', async () => {
  requestApi()
  await renderApp()
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  act(() =>
    listeners[0]!({
      data: { type: 'vada:open', url: `/purchases/0199d1a0-0000-7000-8000-0000000000c1/${R1}` },
    }),
  )
  await requestDialog()
  expect(await financeHeading()).toBeTruthy()
})

test('같은 요청 알림을 다시 누르면 닫았던 상세가 다시 열린다', async () => {
  requestApi()
  await renderApp()
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  const press = () =>
    act(() =>
      listeners[0]!({
        data: { type: 'vada:open', url: `/purchases/0199d1a0-0000-7000-8000-0000000000c1/${R1}` },
      }),
    )
  press()
  await requestDialog()
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  press()
  await requestDialog()
})

test.each([
  ['내 학생회가 아닌', `/purchases/0199d1a0-0000-7000-8000-0000000000ee/${R1}`],
  ['다른 사이트의', `https://evil.example/purchases/0199d1a0-0000-7000-8000-0000000000c1/${R1}`],
  ['번호가 uuid가 아닌', '/purchases/0199d1a0-0000-7000-8000-0000000000c1/not-a-uuid'],
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
  ['내 학생회가 아닌', `/purchases/0199d1a0-0000-7000-8000-0000000000ee/${R1}`],
  ['번호가 uuid가 아닌', '/purchases/0199d1a0-0000-7000-8000-0000000000c1/not-a-uuid'],
])('%s 요청 주소로 열면 찾을 수 없음이고 요청은 읽지 않는다', async (_name, path) => {
  window.history.replaceState(null, '', path)
  await renderApp()
  expect(await screen.findByText(ADDRESS_LOST)).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(requestCalls()).toEqual([])
})

test('지운 요청의 알림을 누르면 "이 요청을 볼 수 없어요"가 보이고 상세는 닫힌다', async () => {
  api.on(
    'GET',
    `/api/organizations/0199d1a0-0000-7000-8000-0000000000c1/purchase-requests?view=mine`,
    () => json({ requests: [], truncated: false }),
  )
  api.on(
    'GET',
    `/api/organizations/0199d1a0-0000-7000-8000-0000000000c1/purchase-requests/${R1}`,
    () => json({ error: 'NOT_FOUND' }, 404),
  )
  window.history.replaceState(null, '', `/purchases/0199d1a0-0000-7000-8000-0000000000c1/${R1}`)
  await renderApp()
  expect((await screen.findByRole('alert', {}, { timeout: 5000 })).textContent).toBe(PURCHASE_LOST)
  await lostSettled(`/finance/${C1}?tab=requests`)
  expect(screen.getByRole('alert').textContent).toBe(PURCHASE_LOST)
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('홈에서 지운 요청의 알림을 눌러도 재정 목록에서 이유가 남는다', async () => {
  requestApi()
  api.on('GET', `/api/organizations/${C1}/purchase-requests/${R1}`, () =>
    json({ error: 'NOT_FOUND' }, 404),
  )
  await renderApp()
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  act(() => listeners[0]!({ data: { type: 'vada:open', url: `/purchases/${C1}/${R1}` } }))
  expect((await screen.findByRole('alert', {}, { timeout: 5000 })).textContent).toBe(PURCHASE_LOST)
  await lostSettled(`/finance/${C1}?tab=requests`)
  expect(screen.getByRole('alert').textContent).toBe(PURCHASE_LOST)
})

test('홈에서 연 요청의 예산 탭으로 가기는 재정의 예산 탭을 연다', async () => {
  requestApi()
  const detail = purchaseDetail(R1, { title: '테이프 구매', actions: ['purchase_request.decide'] })
  api.on('GET', `/api/organizations/${C1}/purchase-requests/${R1}`, () => json({ request: detail }))
  api.on('GET', `/api/organizations/${C1}/budget`, () => json(budgetWithoutPeriod()))
  await renderApp()
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  act(() => listeners[0]!({ data: { type: 'vada:open', url: `/purchases/${C1}/${R1}` } }))
  await requestDialog()
  fireEvent.click(await screen.findByRole('button', { name: '예산 탭으로 가기' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(screen.getByRole('tab', { name: '예산' }).getAttribute('aria-selected')).toBe('true')
  // 예산 탭 주소로 한 칸 쌓이고, 뒤로 가면 홈이다(요청 상세는 닫고 갔다).
  await waitFor(() =>
    expect(window.location.pathname + window.location.search).toBe(`/finance/${C1}?tab=budget`),
  )
  expect(screen.getByRole('tab', { name: '예산' }).getAttribute('aria-selected')).toBe('true')
  act(() => window.history.back())
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
})

test('알림으로 연 요청은 한 번만 쓴다. 다른 화면에 갔다 재정으로 돌아오면 상세가 닫혀 있다', async () => {
  requestApi()
  window.history.replaceState(null, '', `/purchases/0199d1a0-0000-7000-8000-0000000000c1/${R1}`)
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

const ROOM = '0199d1a0-0000-7000-8000-0000000000a1'
const openRoomFromHome = async () => {
  await renderApp()
  expect(await screen.findByRole('heading', { level: 1, name: '홈' })).toBeTruthy()
  act(() => listeners[0]!({ data: { type: 'vada:open', url: `/chat/${C1}/${ROOM}` } }))
  expect(await screen.findByText('모레 회의 있어요', {}, { timeout: 5000 })).toBeTruthy()
}
const roomPath = `/chat/${C1}/${ROOM}`

test('방 알림으로 연 방에서 휴대폰 옆 메뉴를 열었다 닫아도 방에 남는다', async () => {
  await openRoomFromHome()
  fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }))
  const sheet = await screen.findByRole('dialog', { name: '학생회 작업 공간' })
  fireEvent.keyDown(sheet, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await windowHistoryIdle()
  expect(window.location.pathname).toBe(roomPath)
  expect(screen.getByText('모레 회의 있어요')).toBeTruthy()
})

test('방에서 옆 메뉴를 연 채 기기 뒤로를 누르면 옆 메뉴만 닫히고 방에 남는다', async () => {
  await openRoomFromHome()
  fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }))
  await screen.findByRole('dialog', { name: '학생회 작업 공간' })
  act(() => window.history.back())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await windowHistoryIdle()
  expect(window.location.pathname).toBe(roomPath)
})

test('목록을 읽는 동안 받은 알림은 버리지 않고 준비되면 연다', async () => {
  taskApi()
  const councils = deferredResponse()
  api.on('GET', '/api/me/councils', () => councils.promise)
  await renderApp()
  expect(screen.getByText('학생회 확인 중…')).toBeTruthy()
  act(() => listeners[0]!({ data: { type: 'vada:open', url: `/tasks/${C1}/${T1}` } }))
  await act(async () => {
    councils.resolve(json({ councils: [myCouncil(C1), myCouncil(C2, '다른 학생회')] }))
  })
  expect(await taskDialog()).toContain('현수막 주문')
})

test('로그아웃 상태에서 받은 알림은 로그인해 준비되면 연다', async () => {
  taskApi()
  const session = {
    data: { user: { id: 'u1', name: '김회장', email: 'kim@example.test' } },
    isPending: false,
    error: null,
    refetch: vi.fn(),
  }
  auth.useSession.mockReturnValue({ data: null, isPending: false, error: null, refetch: vi.fn() })
  const view = await renderApp()
  act(() => listeners[0]!({ data: { type: 'vada:open', url: `/tasks/${C1}/${T1}` } }))
  auth.useSession.mockReturnValue(session)
  view.rerender(<App />)
  expect(await taskDialog()).toContain('현수막 주문')
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
