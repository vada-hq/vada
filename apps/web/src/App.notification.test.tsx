// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { messagePage, roomDetail, roomList } from './test-support/chat-fixtures'
import { councilView, myCouncil, teamResponse } from './test-support/council-fixtures'
import { json, mockApi } from './test-support/mock-api'

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
  render(<App />)
  expect(await screen.findByText('모레 회의 있어요', {}, { timeout: 5000 })).toBeTruthy()
  expect(api.calls.some(call => call.path === '/api/organizations/c2/rooms/r1')).toBe(true)
  expect(api.calls.some(call => call.path === '/api/organizations/c1/rooms/r1')).toBe(false)
  expect(window.location.pathname).toBe('/')
})

test('내 학생회가 아닌 학생회의 방 주소는 무시하고 첫 학생회의 방 목록을 연다', async () => {
  window.history.replaceState(null, '', '/chat/other/r1')
  render(<App />)
  expect(await screen.findByRole('button', { name: /운영진 전체방/ })).toBeTruthy()
  expect(screen.queryByText('모레 회의 있어요')).toBeNull()
  expect(api.calls.some(call => call.path.includes('/other/'))).toBe(false)
})

test('열려 있는 동안 알림을 누르면 보던 곳에서 그 방으로 옮겨 간다', async () => {
  render(<App />)
  expect(await screen.findByRole('button', { name: /운영진 전체방/ })).toBeTruthy()
  act(() => listeners[0]!({ data: { type: 'vada:open', url: '/chat/c1/r1' } }))
  expect(await screen.findByText('모레 회의 있어요', {}, { timeout: 5000 })).toBeTruthy()
})

test('내 학생회가 아닌 방 알림을 눌러도 열려 있는 방과 화면은 그대로다', async () => {
  render(<App />)
  expect(await screen.findByRole('button', { name: /운영진 전체방/ })).toBeTruthy()
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
  render(<App />)
  expect(await screen.findByText('모레 회의 있어요', {}, { timeout: 5000 })).toBeTruthy()
  const aside = screen.getByRole('complementary', { name: '학생회 작업 공간' })
  fireEvent.click(within(aside).getByRole('button', { name: '사람' }))
  expect(await screen.findByRole('heading', { level: 1, name: '사람' })).toBeTruthy()
  fireEvent.click(within(aside).getByRole('button', { name: /^대화/ }))
  expect(await screen.findByRole('button', { name: /운영진 전체방/ })).toBeTruthy()
  expect(screen.queryByText('모레 회의 있어요')).toBeNull()
})

test('로그아웃하는 동안 옆 메뉴의 로그아웃 단추는 막혀 한 번만 보낸다', async () => {
  auth.signOut.mockReturnValue(new Promise(() => undefined))
  render(<App />)
  const aside = await screen.findByRole('complementary', { name: '학생회 작업 공간' })
  const button = within(aside).getByRole('button', { name: '로그아웃' }) as HTMLButtonElement
  fireEvent.click(button)
  await waitFor(() => expect(button.disabled).toBe(true))
  fireEvent.click(button)
  await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1))
})
