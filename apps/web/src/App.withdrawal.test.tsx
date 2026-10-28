// @vitest-environment jsdom
import { useSyncExternalStore } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { menuPath, type MyCouncil } from '@vada/contracts'
import { renderApp } from './test-support/render-app'
import { councilView, myCouncil, teamResponse } from './test-support/council-fixtures'
import { homeResponse, onHomeExtras } from './test-support/home-fixtures'
import { deferredResponse, json, mockApi } from './test-support/mock-api'
import { asElement } from '@/test-support/elements'
import { settle } from '@/test-support/settle'

const auth = vi.hoisted(() => ({
  useSession: vi.fn(),
  social: vi.fn(),
  signOut: vi.fn(),
  refetch: vi.fn(),
}))
vi.mock('./auth/auth-client', () => ({
  authClient: {
    useSession: auth.useSession,
    signIn: { social: auth.social },
    signOut: auth.signOut,
  },
}))

const COUNCIL = '0199d1a0-0000-7000-8000-0000000000c1'
const DESCRIPTION = "학생회 기록의 내 이름은 '떠난 운영진'으로 바뀌어요. 되돌릴 수 없어요."

let api: ReturnType<typeof mockApi>
// 세션은 바깥 저장소처럼 둔다. 다시 읽으면(refetch) 서버가 지운 쿠키대로 로그인 전이 된다.
let session: { user: { id: string; name: string; email: string } } | null
// 세션을 다시 읽다 연결이 끊긴 때.
let sessionError: { message: string } | null
const userA = { id: 'u1', name: '김회장', email: 'kim@example.test' }
const userB = { id: 'u2', name: '박다른', email: 'park@example.test' }
const listeners = new Set<() => void>()
beforeEach(() => {
  window.history.replaceState(null, '', '/')
  vi.resetAllMocks()
  api = mockApi()
  session = { user: userA }
  sessionError = null
  auth.refetch.mockImplementation(async () => {
    listeners.forEach(listener => listener())
  })
  auth.useSession.mockImplementation(() => ({
    data: useSyncExternalStore(
      listener => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
      () => session,
    ),
    isPending: false,
    error: sessionError,
    refetch: auth.refetch,
  }))
})
afterEach(() => {
  cleanup()
  listeners.clear()
  try {
    api.assertNoUnexpectedRequests()
  } finally {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  }
})

function councils(list: MyCouncil[]) {
  api.on('GET', '/api/me/councils', () => json({ councils: list }))
}
function openCouncil() {
  councils([myCouncil(COUNCIL)])
  api.on('GET', `/api/organizations/${COUNCIL}`, () => json(councilView(COUNCIL)))
  api.on('GET', `/api/organizations/${COUNCIL}/members`, () => json(teamResponse()))
  api.on('GET', `/api/organizations/${COUNCIL}/invite`, () => json({ code: 'ABCD2345' }))
  api.on('GET', `/api/organizations/${COUNCIL}/home`, () => json(homeResponse()))
  onHomeExtras(api, {}, COUNCIL)
  api.on('GET', `/api/organizations/${COUNCIL}/rooms`, () =>
    json({ rooms: [], notices: [], unreadTotal: 0, mentionTotal: 0 }),
  )
  for (const taskScope of ['mine', 'all'])
    api.on(
      'GET',
      `/api/organizations/${COUNCIL}/tasks?view=${taskScope}&status=open${taskScope === 'all' ? '&event=none' : ''}`,
      () => json({ tasks: [], truncated: false }),
    )
  api.on('GET', `/api/organizations/${COUNCIL}/purchase-requests?view=pending`, () =>
    json({ requests: [], truncated: false }),
  )
  api.on('GET', `/api/organizations/${COUNCIL}/events/open`, () =>
    json({ events: [], more: false }),
  )
}
// 서버가 탈퇴를 받으면 세션 줄을 지운다. 그 뒤의 세션 읽기는 로그인 전이다.
function withdrawalAnswers(response: () => Response | Promise<Response>) {
  api.on('POST', '/api/me/withdrawal', async () => {
    const answer = await response()
    if (answer.ok) session = null
    return answer
  })
}

// 옆 메뉴 아래 사용자 줄 → '내 이름' 창 → 탈퇴.
async function openFromSidebar() {
  const aside = await screen.findByRole('complementary', { name: '학생회 작업 공간' })
  fireEvent.click(await within(aside).findByRole('button', { name: /^내 이름: / }))
  const named = await screen.findByRole('dialog', { name: '내 이름' })
  fireEvent.click(within(named).getByRole('button', { name: '탈퇴' }))
  return screen.findByRole('dialog', { name: '탈퇴' })
}

const withdrawButton = (dialog: HTMLElement) =>
  asElement(within(dialog).getByRole('button', { name: '탈퇴' }), HTMLButtonElement)

test('사용자 줄의 내 이름 창에서 탈퇴를 누르면 확인 창이 두 문장과 [탈퇴]·[닫기]를 보이고, 탈퇴하면 로그인 전 화면에 탈퇴 완료가 보인다', async () => {
  openCouncil()
  withdrawalAnswers(() => json({ withdrawn: true }))
  await renderApp()
  const dialog = await openFromSidebar()
  expect(screen.queryByRole('dialog', { name: '내 이름' })).toBeNull()
  expect(within(dialog).getByText(DESCRIPTION)).toBeTruthy()
  expect(withdrawButton(dialog).className).toContain('bg-destructive')
  expect(within(dialog).getAllByRole('button', { name: '닫기' }).length).toBeGreaterThan(0)
  fireEvent.click(withdrawButton(dialog))
  expect(await screen.findByText('탈퇴 완료')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Google로 로그인' })).toBeTruthy()
  expect(api.calls.filter(call => call.path === '/api/me/withdrawal')).toEqual([
    expect.objectContaining({ method: 'POST', body: {} }),
  ])
  expect(auth.refetch).toHaveBeenCalled()
})

test('닫기는 보내지 않고 창을 닫는다', async () => {
  openCouncil()
  await renderApp()
  const dialog = await openFromSidebar()
  fireEvent.click(within(dialog).getAllByRole('button', { name: '닫기' })[0]!)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  await settle()
  expect(api.calls.some(call => call.path === '/api/me/withdrawal')).toBe(false)
  // 내 이름 창을 거쳐 열었어도 포커스는 사용자 줄로 돌아간다.
  const aside = screen.getByRole('complementary', { name: '학생회 작업 공간' })
  expect(document.activeElement).toBe(within(aside).getByRole('button', { name: /^내 이름: / }))
})

test('보내는 동안 [탈퇴]는 막혀 두 번 눌러도 한 번만 보낸다', async () => {
  openCouncil()
  const pending = deferredResponse()
  withdrawalAnswers(() => pending.promise)
  await renderApp()
  const dialog = await openFromSidebar()
  fireEvent.click(withdrawButton(dialog))
  await waitFor(() => expect(withdrawButton(dialog).disabled).toBe(true))
  expect(withdrawButton(dialog).getAttribute('aria-busy')).toBe('true')
  fireEvent.click(withdrawButton(dialog))
  pending.resolve(json({ withdrawn: true }))
  expect(await screen.findByText('탈퇴 완료')).toBeTruthy()
  expect(api.calls.filter(call => call.path === '/api/me/withdrawal')).toHaveLength(1)
})

test('지금 기수의 회장이면 버튼 옆에 회장 직급을 넘긴 뒤 탈퇴할 수 있다고 알리고 창은 그대로다', async () => {
  openCouncil()
  withdrawalAnswers(() => json({ error: 'PRESIDENT_CANNOT_WITHDRAW' }, 409))
  await renderApp()
  const dialog = await openFromSidebar()
  fireEvent.click(withdrawButton(dialog))
  expect((await within(dialog).findByRole('alert')).textContent).toBe(
    '회장 직급을 넘긴 뒤 탈퇴할 수 있어요.',
  )
  expect(withdrawButton(dialog).disabled).toBe(false)
  expect(screen.queryByText('탈퇴 완료')).toBeNull()
})

test('탈퇴하지 못하면 창 안에 알리고 다시 누를 수 있다', async () => {
  openCouncil()
  withdrawalAnswers(() => json({ error: 'x' }, 500))
  await renderApp()
  const dialog = await openFromSidebar()
  fireEvent.click(withdrawButton(dialog))
  expect((await within(dialog).findByRole('alert')).textContent).toBe(
    '탈퇴하지 못했어요. 다시 시도해 주세요.',
  )
  expect(withdrawButton(dialog).disabled).toBe(false)
})

test('로그인한 지 오래면 다시 로그인하게 하고, Google에서 돌아오면 확인 창이 다시 열린다', async () => {
  openCouncil()
  withdrawalAnswers(() => json({ error: 'REAUTH_REQUIRED' }, 403))
  auth.social.mockResolvedValue({ error: null })
  await renderApp()
  const dialog = await openFromSidebar()
  // 지금 보던 학생회 안 주소로 돌아온다.
  const path = window.location.pathname + window.location.search
  expect(path).toBe(menuPath('home', COUNCIL))
  fireEvent.click(withdrawButton(dialog))
  expect((await within(dialog).findByRole('alert')).textContent).toBe(
    '다시 로그인한 뒤 탈퇴할 수 있어요.',
  )
  expect(within(dialog).queryByRole('button', { name: '탈퇴' })).toBeNull()
  fireEvent.click(within(dialog).getByRole('button', { name: '다시 로그인' }))
  await waitFor(() =>
    expect(auth.social).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: path,
      errorCallbackURL: path,
    }),
  )
  // Google에서 같은 주소로 돌아와 앱을 처음부터 그린다. 새 세션이라 이번에는 탈퇴가 된다.
  cleanup()
  withdrawalAnswers(() => json({ withdrawn: true }))
  await renderApp()
  const reopened = await screen.findByRole('dialog', { name: '탈퇴' })
  expect(within(reopened).queryByRole('alert')).toBeNull()
  fireEvent.click(withdrawButton(reopened))
  expect(await screen.findByText('탈퇴 완료')).toBeTruthy()
})

test('돌아오지 않은 다시 로그인은 다음에 앱을 열 때 확인 창을 열지 않는다', async () => {
  openCouncil()
  withdrawalAnswers(() => json({ error: 'REAUTH_REQUIRED' }, 403))
  auth.social.mockResolvedValue({ error: null })
  const now = Date.now()
  const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
  await renderApp()
  const dialog = await openFromSidebar()
  fireEvent.click(withdrawButton(dialog))
  fireEvent.click(await within(dialog).findByRole('button', { name: '다시 로그인' }))
  await waitFor(() => expect(auth.social).toHaveBeenCalled())
  cleanup()
  clock.mockReturnValue(now + 60 * 60 * 1000)
  await renderApp()
  await screen.findByRole('complementary', { name: '학생회 작업 공간' })
  await settle()
  expect(screen.queryByRole('dialog', { name: '탈퇴' })).toBeNull()
})

test('홈 화면 앱은 로그인 창에서 다시 로그인하고, 그 창이 알리면 확인 창이 처음 모습으로 돌아온다', async () => {
  Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
  const channels: { onmessage: (() => void) | null }[] = []
  vi.stubGlobal(
    'BroadcastChannel',
    class {
      onmessage: (() => void) | null = null
      constructor() {
        channels.push(this)
      }
      postMessage() {}
      close() {}
    },
  )
  const popup = { location: { href: 'about:blank' }, close: vi.fn() }
  const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
  auth.social.mockResolvedValue({ data: { url: 'https://accounts.google.com/x' }, error: null })
  openCouncil()
  withdrawalAnswers(() => json({ error: 'REAUTH_REQUIRED' }, 403))
  // 로그인 창에서 같은 Google 계정을 골랐다.
  api.on('GET', '/api/auth/get-session', () => json({ session: { id: 's2' }, user: userA }))
  try {
    await renderApp()
    const dialog = await openFromSidebar()
    fireEvent.click(withdrawButton(dialog))
    fireEvent.click(await within(dialog).findByRole('button', { name: '다시 로그인' }))
    await waitFor(() => expect(popup.location.href).toBe('https://accounts.google.com/x'))
    expect(auth.social).toHaveBeenCalledWith(expect.objectContaining({ callbackURL: '/auth-done' }))
    const button = within(dialog).getByRole('button', { name: '다시 로그인' })
    expect(asElement(button, HTMLButtonElement).disabled).toBe(false)
    channels.forEach(channel => channel.onmessage?.())
    await waitFor(() => expect(within(dialog).queryByRole('alert')).toBeNull())
    expect(withdrawButton(dialog)).toBeTruthy()
  } finally {
    open.mockRestore()
    delete (navigator as { standalone?: boolean }).standalone
  }
})

test('학생회가 없으면 가운데 카드에 탈퇴가 있고, 탈퇴하면 탈퇴 완료가 보인다', async () => {
  councils([])
  withdrawalAnswers(() => json({ withdrawn: true }))
  await renderApp()
  await screen.findByRole('heading', { name: '아직 들어간 학생회가 없어요' })
  fireEvent.click(screen.getByRole('button', { name: '탈퇴' }))
  const dialog = await screen.findByRole('dialog', { name: '탈퇴' })
  expect(within(dialog).getByText(DESCRIPTION)).toBeTruthy()
  fireEvent.click(withdrawButton(dialog))
  expect(await screen.findByText('탈퇴 완료')).toBeTruthy()
})

test('탈퇴하지 않은 로그인 전 화면에는 탈퇴 완료가 없다', async () => {
  session = null
  await renderApp()
  expect(screen.getByRole('button', { name: 'Google로 로그인' })).toBeTruthy()
  expect(screen.queryByText('탈퇴 완료')).toBeNull()
})

// 다시 로그인에서 다른 Google 계정(B)을 고르면 쿠키는 B다. 화면은 A인 채로 [탈퇴]를 보이면 B가 탈퇴된다.
test('홈 화면 앱의 다시 로그인에서 다른 계정을 고르면 확인 창을 닫고 그 계정의 화면으로 바꾼다', async () => {
  Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
  const channels: { onmessage: (() => void) | null }[] = []
  vi.stubGlobal(
    'BroadcastChannel',
    class {
      onmessage: (() => void) | null = null
      constructor() {
        channels.push(this)
      }
      postMessage() {}
      close() {}
    },
  )
  const popup = { location: { href: 'about:blank' }, close: vi.fn() }
  const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
  auth.social.mockResolvedValue({ data: { url: 'https://accounts.google.com/x' }, error: null })
  openCouncil()
  withdrawalAnswers(() => json({ error: 'REAUTH_REQUIRED' }, 403))
  api.on('GET', '/api/auth/get-session', () => {
    session = { user: userB }
    return json({ session: { id: 's2' }, user: userB })
  })
  try {
    await renderApp()
    const dialog = await openFromSidebar()
    fireEvent.click(withdrawButton(dialog))
    fireEvent.click(await within(dialog).findByRole('button', { name: '다시 로그인' }))
    await waitFor(() => expect(popup.location.href).toBe('https://accounts.google.com/x'))
    channels.forEach(channel => channel.onmessage?.())
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '탈퇴' })).toBeNull())
    await waitFor(() => expect(auth.refetch).toHaveBeenCalled())
    await settle()
    expect(screen.queryByRole('dialog', { name: '탈퇴' })).toBeNull()
    expect(api.calls.filter(call => call.path === '/api/me/withdrawal')).toHaveLength(1)
  } finally {
    open.mockRestore()
    delete (navigator as { standalone?: boolean }).standalone
  }
})

test('넘어가는 다시 로그인에서 다른 계정으로 돌아오면 확인 창을 열지 않는다', async () => {
  openCouncil()
  withdrawalAnswers(() => json({ error: 'REAUTH_REQUIRED' }, 403))
  auth.social.mockResolvedValue({ error: null })
  await renderApp()
  const dialog = await openFromSidebar()
  fireEvent.click(withdrawButton(dialog))
  fireEvent.click(await within(dialog).findByRole('button', { name: '다시 로그인' }))
  await waitFor(() => expect(auth.social).toHaveBeenCalled())
  cleanup()
  session = { user: userB }
  await renderApp()
  await screen.findByRole('complementary', { name: '학생회 작업 공간' })
  await settle()
  expect(screen.queryByRole('dialog', { name: '탈퇴' })).toBeNull()
  // 표시는 지워져, 10분 안에 A로 다시 와도 묻지 않은 창이 뜨지 않는다.
  cleanup()
  session = { user: userA }
  await renderApp()
  await screen.findByRole('complementary', { name: '학생회 작업 공간' })
  await settle()
  expect(screen.queryByRole('dialog', { name: '탈퇴' })).toBeNull()
})

test('다시 로그인을 마치지 못한 채 로그인 전 화면에서 보통 로그인을 하면, 10분 안이어도 확인 창을 열지 않는다', async () => {
  openCouncil()
  withdrawalAnswers(() => json({ error: 'REAUTH_REQUIRED' }, 403))
  auth.social.mockResolvedValue({ error: null })
  await renderApp()
  const dialog = await openFromSidebar()
  fireEvent.click(withdrawButton(dialog))
  fireEvent.click(await within(dialog).findByRole('button', { name: '다시 로그인' }))
  await waitFor(() => expect(auth.social).toHaveBeenCalled())
  // Google에서 돌아오지 않고 나중에 앱을 열었더니 로그아웃 상태였다.
  cleanup()
  session = null
  await renderApp()
  fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
  await waitFor(() => expect(auth.social).toHaveBeenCalledTimes(2))
  cleanup()
  session = { user: userA }
  await renderApp()
  await screen.findByRole('complementary', { name: '학생회 작업 공간' })
  await settle()
  expect(screen.queryByRole('dialog', { name: '탈퇴' })).toBeNull()
})

test('탈퇴하면 이 기기가 그 사람의 마지막 주소로 기억한 것을 지운다', async () => {
  openCouncil()
  withdrawalAnswers(() => json({ withdrawn: true }))
  await renderApp()
  const dialog = await openFromSidebar()
  await waitFor(() => expect(window.localStorage.getItem('vada.last.address.u1')).not.toBeNull())
  fireEvent.click(withdrawButton(dialog))
  expect(await screen.findByText('탈퇴 완료')).toBeTruthy()
  expect(window.localStorage.getItem('vada.last.address.u1')).toBeNull()
})

test('탈퇴 뒤 세션을 다시 읽지 못해도 로그인 전 화면에 탈퇴 완료가 보인다', async () => {
  openCouncil()
  api.on('POST', '/api/me/withdrawal', () => {
    sessionError = { message: 'network' }
    return json({ withdrawn: true })
  })
  await renderApp()
  const dialog = await openFromSidebar()
  fireEvent.click(withdrawButton(dialog))
  expect(await screen.findByText('탈퇴 완료')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Google로 로그인' })).toBeTruthy()
  expect(screen.queryByText(/세션을 확인하지 못했어요/)).toBeNull()
})
