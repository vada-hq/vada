// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderApp } from './test-support/render-app'
import { resetWindowHistory, windowHistoryIdle } from './lib/use-window-history'
import { roomList } from './test-support/chat-fixtures'
import { councilView, myCouncil, teamResponse } from './test-support/council-fixtures'
import { homeResponse, onHomeExtras } from './test-support/home-fixtures'
import { json, mockApi } from './test-support/mock-api'
import { taskDetail } from './test-support/task-detail-fixtures'

const auth = vi.hoisted(() => ({ useSession: vi.fn(), signOut: vi.fn() }))
vi.mock('./auth/auth-client', () => ({
  authClient: { useSession: auth.useSession, signIn: { social: vi.fn() }, signOut: auth.signOut },
}))

const C1 = '0199d1a0-0000-7000-8000-0000000000c1'
const C2 = '0199d1a0-0000-7000-8000-0000000000c2'
const T1 = '3f2b8c1e-6a4d-4e0b-9c57-1a2b3c4d5e6f'
let api: ReturnType<typeof mockApi>
const listeners: ((event: { data: unknown }) => void)[] = []

beforeEach(() => {
  listeners.length = 0
  window.localStorage.clear()
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
    json({ councils: [myCouncil(C1), myCouncil(C2, '다른 학생회')] }),
  )
  for (const id of [C1, C2]) {
    api.on('GET', `/api/organizations/${id}`, () => json(councilView(id)))
    api.on('GET', `/api/organizations/${id}/members`, () => json(teamResponse()))
    api.on('GET', `/api/organizations/${id}/rooms`, () => json(roomList()))
    api.on('GET', `/api/organizations/${id}/home`, () => json(homeResponse()))
    onHomeExtras(api, {}, id)
    api.on('GET', `/api/organizations/${id}/tasks?view=mine&status=open`, () =>
      json({ tasks: [], truncated: false }),
    )
    api.on('GET', `/api/organizations/${id}/tasks/${T1}`, () =>
      json({ task: taskDetail({ title: '현수막 주문' }) }),
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

const aside = () => screen.getByRole('complementary', { name: '학생회 작업 공간', hidden: true })
const menu = (name: string | RegExp) => within(aside()).getByRole('button', { name, hidden: true })
const heading = (name: string) => screen.findByRole('heading', { level: 1, name, hidden: true })
const council = (id: string) => api.calls.filter(call => call.path === `/api/organizations/${id}`)
const pathNow = () => window.location.pathname + window.location.search
// 기록 칸 수는 history.length로 못 센다(뒤로 간 뒤 쌓으면 앞 칸이 지워진다). 쌓은 횟수를 센다.
const pushes = () => vi.spyOn(window.history, 'pushState')
const taskOpen = () =>
  waitFor(() => expect(within(screen.getByRole('dialog')).getByText('현수막 주문')).toBeTruthy())

test('주소가 없는 시작은 첫 학생회 홈 주소가 된다', async () => {
  await renderApp()
  expect(await heading('홈')).toBeTruthy()
  expect(pathNow()).toBe(`/home/${C1}`)
})

const LAST = 'vada.last.address.u1'

test('/로 열면 이 기기가 마지막에 본 학생회 안 주소로 바꿔 쓴다', async () => {
  window.localStorage.setItem(LAST, `/tasks/${C2}?view=all`)
  const push = pushes()
  await renderApp()
  expect(await heading('업무')).toBeTruthy()
  expect(pathNow()).toBe(`/tasks/${C2}?view=all`)
  expect(push).not.toHaveBeenCalled()
  expect(council(C1)).toEqual([])
})

test('마지막 주소의 학생회를 잃었거나 기억이 없으면 첫 학생회 홈이 열린다', async () => {
  window.localStorage.setItem(LAST, '/tasks/0199d1a0-0000-7000-8000-0000000000c9?view=all')
  await renderApp()
  expect(await heading('홈')).toBeTruthy()
  expect(pathNow()).toBe(`/home/${C1}`)
})

test('/가 아닌 주소로 열면 마지막 주소를 쓰지 않는다', async () => {
  window.localStorage.setItem(LAST, `/tasks/${C2}`)
  window.history.replaceState(null, '', `/people/${C1}`)
  await renderApp()
  expect(await heading('사람')).toBeTruthy()
  expect(pathNow()).toBe(`/people/${C1}`)
})

test('보는 곳이 바뀔 때마다 마지막 주소를 기억한다', async () => {
  await renderApp()
  expect(await heading('홈')).toBeTruthy()
  expect(window.localStorage.getItem(LAST)).toBe(`/home/${C1}`)
  fireEvent.click(menu('사람'))
  expect(await heading('사람')).toBeTruthy()
  expect(window.localStorage.getItem(LAST)).toBe(`/people/${C1}`)
})

test('찾을 수 없는 주소와 다른 사람의 학생회 주소는 기억하지 않는다', async () => {
  window.localStorage.setItem(LAST, `/home/${C1}`)
  window.history.replaceState(null, '', '/tasks/0199d1a0-0000-7000-8000-0000000000c9')
  await renderApp()
  expect(await screen.findByText('찾을 수 없음')).toBeTruthy()
  expect(window.localStorage.getItem(LAST)).toBe(`/home/${C1}`)
})

test('메뉴를 누르면 주소가 바뀌고 브라우저 뒤로가 앞 메뉴로 간다', async () => {
  await renderApp()
  expect(await heading('홈')).toBeTruthy()
  fireEvent.click(menu('사람'))
  expect(await heading('사람')).toBeTruthy()
  expect(pathNow()).toBe(`/people/${C1}`)
  act(() => window.history.back())
  expect(await heading('홈')).toBeTruthy()
  expect(pathNow()).toBe(`/home/${C1}`)
})

test('새로 고침하면 주소의 학생회와 메뉴가 열린다', async () => {
  window.history.replaceState(null, '', `/departments/${C2}`)
  await renderApp()
  expect(await heading('부서')).toBeTruthy()
  expect(screen.getByRole('button', { name: '학생회 메뉴: 다른 학생회' })).toBeTruthy()
  expect(council(C1)).toEqual([])
})

test('열린 메뉴를 다시 누르면 칸이 늘지 않고, 다른 메뉴를 누르면 늘어난다', async () => {
  await renderApp()
  expect(await heading('홈')).toBeTruthy()
  const push = pushes()
  fireEvent.click(menu('홈'))
  fireEvent.click(menu('홈'))
  expect(push).toHaveBeenCalledTimes(0)
  fireEvent.click(menu('사람'))
  expect(await heading('사람')).toBeTruthy()
  expect(push).toHaveBeenCalledTimes(1)
  fireEvent.click(menu('사람'))
  expect(push).toHaveBeenCalledTimes(1)
})

test('첫 화면이 아닌 메뉴 주소에서 그 메뉴를 다시 누르면 첫 화면으로 한 칸 쌓는다', async () => {
  window.history.replaceState(null, '', `/tasks/${C1}?view=all`)
  await renderApp()
  expect(await heading('업무')).toBeTruthy()
  const push = pushes()
  fireEvent.click(menu(/^업무/))
  expect(push).toHaveBeenCalledTimes(1)
  expect(pathNow()).toBe(`/tasks/${C1}`)
})

test('학생회를 바꾸면 그 학생회 홈 주소로 한 칸 쌓인다', async () => {
  window.history.replaceState(null, '', `/people/${C1}`)
  await renderApp()
  expect(await heading('사람')).toBeTruthy()
  const push = pushes()
  fireEvent.keyDown(screen.getByRole('button', { name: '학생회 메뉴: 컴퓨터학부 학생회' }), {
    key: 'Enter',
  })
  fireEvent.click(await screen.findByRole('menuitem', { name: '다른 학생회' }))
  expect(await heading('홈')).toBeTruthy()
  expect(pathNow()).toBe(`/home/${C2}`)
  expect(push).toHaveBeenCalledTimes(1)
})

test('열린 창에서 알림을 누르면 그 주소로 한 칸 쌓이고 학생회를 다시 읽지 않는다', async () => {
  await renderApp()
  expect(await heading('홈')).toBeTruthy()
  const reads = council(C1).length
  const push = pushes()
  act(() => listeners[0]!({ data: { type: 'vada:open', url: `/tasks/${C1}/${T1}?x=1#y` } }))
  await taskOpen()
  expect(pathNow()).toBe(`/tasks/${C1}/${T1}`)
  expect(push).toHaveBeenCalledTimes(1)
  expect(council(C1).length).toBe(reads)
})

test('모르는 주소는 찾을 수 없음이고 상위 목록으로 가는 버튼이 있다', async () => {
  window.history.replaceState(null, '', `/tasks/${C1}/not-a-uuid`)
  await renderApp()
  expect(await screen.findByText('찾을 수 없음')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '홈으로' }))
  expect(await heading('홈')).toBeTruthy()
  expect(pathNow()).toBe(`/home/${C1}`)
})

test('찾을 수 없음에서 홈으로 간 칸은 옆 메뉴를 열었다 닫아도 홈에 남는다', async () => {
  window.history.replaceState(null, '', `/tasks/0199d1a0-0000-7000-8000-0000000000ee/${T1}`)
  await renderApp()
  fireEvent.click(await screen.findByRole('button', { name: '홈으로' }))
  expect(await heading('홈')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '메뉴 열기' }))
  const sheet = await screen.findByRole('dialog', { name: '학생회 작업 공간' })
  fireEvent.keyDown(sheet, { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await windowHistoryIdle()
  expect(pathNow()).toBe(`/home/${C1}`)
})

test('기록 주소로 바로 들어오면 상위 목록 칸이 깔려 뒤로가 목록으로 간다', async () => {
  window.history.replaceState(null, '', `/tasks/${C1}/${T1}`)
  const push = pushes()
  await renderApp()
  await taskOpen()
  // 목록 칸으로 바꿔 쓰고 그 위에 기록 칸을 한 칸 쌓는다. 상세 창은 그 칸을 자기 칸으로 써서 더 쌓지 않는다.
  expect(push).toHaveBeenCalledTimes(1)
  expect(pathNow()).toBe(`/tasks/${C1}/${T1}`)
  act(() => window.history.back())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(pathNow()).toBe(`/tasks/${C1}`)
  expect(await heading('업무')).toBeTruthy()
})

test('새로 고침으로 되살린 창은 칸을 더 쌓지 않는다', async () => {
  window.history.replaceState(null, '', `/tasks/${C1}/${T1}`)
  await renderApp()
  await taskOpen()
  // 새로 고침: 문서가 새로 열려도 기록 칸과 그 상태는 그대로다. 이 칸은 이미 주소 층이 쌓은 칸이다.
  // 화면을 내리면 창이 자기 칸을 거두므로, 그 칸으로 다시 가서 새 문서처럼 연다.
  cleanup()
  await windowHistoryIdle()
  act(() => window.history.forward())
  await waitFor(() => expect(pathNow()).toBe(`/tasks/${C1}/${T1}`))
  const state: unknown = window.history.state
  const push = pushes()
  await renderApp()
  await taskOpen()
  expect(push).toHaveBeenCalledTimes(0)
  expect(window.history.state).toEqual(state)
})

test('창을 연 채 메뉴로 가도 뒤로가 두 번 걸리지 않는다', async () => {
  await renderApp()
  expect(await heading('홈')).toBeTruthy()
  act(() => listeners[0]!({ data: { type: 'vada:open', url: `/tasks/${C1}/${T1}` } }))
  await taskOpen()
  fireEvent.click(menu('사람'))
  expect(await heading('사람')).toBeTruthy()
  await windowHistoryIdle()
  expect(pathNow()).toBe(`/people/${C1}`)
  act(() => window.history.back())
  expect(await heading('홈')).toBeTruthy()
  expect(pathNow()).toBe(`/home/${C1}`)
})
