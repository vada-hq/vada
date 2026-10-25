// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { renderApp } from './test-support/render-app'
import { resetWindowHistory, windowHistoryIdle } from './lib/use-window-history'
import { roomList } from './test-support/chat-fixtures'
import { councilView, myCouncil, teamResponse } from './test-support/council-fixtures'
import { homeResponse, onHomeExtras } from './test-support/home-fixtures'
import { json, mockApi } from './test-support/mock-api'

const auth = vi.hoisted(() => ({ useSession: vi.fn(), signOut: vi.fn() }))
vi.mock('./auth/auth-client', () => ({
  authClient: { useSession: auth.useSession, signIn: { social: vi.fn() }, signOut: auth.signOut },
}))

const C1 = '0199d1a0-0000-7000-8000-0000000000c1'

beforeEach(() => {
  window.history.replaceState(null, '', `/home/${C1}`)
  const api = mockApi()
  auth.useSession.mockReturnValue({
    data: { user: { id: 'u1', name: '김회장', email: 'kim@example.test' } },
    isPending: false,
    error: null,
    refetch: vi.fn(),
  })
  api.on('GET', '/api/me/councils', () => json({ councils: [myCouncil(C1)] }))
  api.on('GET', `/api/organizations/${C1}`, () => json(councilView(C1)))
  api.on('GET', `/api/organizations/${C1}/members`, () => json(teamResponse()))
  api.on('GET', `/api/organizations/${C1}/rooms`, () => json(roomList()))
  api.on('GET', `/api/organizations/${C1}/home`, () => json(homeResponse()))
  onHomeExtras(api, {}, C1)
})
afterEach(async () => {
  cleanup()
  await windowHistoryIdle()
  resetWindowHistory()
  vi.restoreAllMocks()
})

const aside = () => screen.getByRole('complementary', { name: '학생회 작업 공간', hidden: true })
const menu = (name: string | RegExp) => within(aside()).getByRole('button', { name, hidden: true })
const heading = (name: string) => screen.findByRole('heading', { level: 1, name, hidden: true })
const main = () => screen.getByRole('main', { hidden: true })

// jsdom은 배치를 계산하지 않아 본문의 스크롤 위치와 높이를 흉내 낸다.
function fakeScroll(element: HTMLElement) {
  let top = 0
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => top,
    set: (value: number) => {
      top = Math.max(0, Math.min(value, 900))
    },
  })
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: 1000 })
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: 100 })
}
const scrollTo = (top: number) => {
  main().scrollTop = top
  fireEvent.scroll(main())
}

test('새 칸은 맨 위에서 열리고, 뒤로 돌아오면 있던 자리로 간다', async () => {
  await renderApp()
  expect(await heading('홈')).toBeTruthy()
  fakeScroll(main())
  scrollTo(400)
  fireEvent.click(menu('사람'))
  expect(await heading('사람')).toBeTruthy()
  expect(main().scrollTop).toBe(0)
  scrollTo(120)
  act(() => window.history.back())
  expect(await heading('홈')).toBeTruthy()
  await waitFor(() => expect(main().scrollTop).toBe(400))
  expect(window.history.scrollRestoration).toBe('manual')
})
