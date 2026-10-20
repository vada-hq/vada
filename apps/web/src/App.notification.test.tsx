// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { messagePage, roomDetail, roomList } from './test-support/chat-fixtures'
import { councilView, myCouncil, teamResponse } from './test-support/council-fixtures'
import { json, mockApi } from './test-support/mock-api'

const auth = vi.hoisted(() => ({ useSession: vi.fn() }))
vi.mock('./auth/auth-client', () => ({
  authClient: { useSession: auth.useSession, signIn: { social: vi.fn() }, signOut: vi.fn() },
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
