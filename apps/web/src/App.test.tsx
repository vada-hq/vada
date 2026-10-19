// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'

const auth = vi.hoisted(() => ({ useSession: vi.fn(), social: vi.fn(), signOut: vi.fn(), refetch: vi.fn() }))
vi.mock('./auth/auth-client', () => ({ authClient: { useSession: auth.useSession, signIn: { social: auth.social }, signOut: auth.signOut } }))
vi.mock('./access/Memberships', () => ({ default: ({ renderMemberships }: { renderMemberships: (memberships: import('@vada/contracts').MembershipSummary[]) => import('react').ReactNode }) => <>{renderMemberships([{ id: 'm1', organization: { id: 'o1', name: '검증 학생회', inviteCode: 'ABCD2345' }, department: { id: 'd1', name: '기획부', handlesFinance: false, isLeadership: false }, title: null, permissions: { manageOrganization: false, approvePurchases: false, manageEvents: true } }])}</> }))
vi.mock('./workspace/Workspace', () => ({ default: ({ memberships, user, onLogout, logoutBusy }: { memberships: import('@vada/contracts').MembershipSummary[]; user: { email: string }; onLogout: () => void; logoutBusy: boolean }) => <><p>{user.email}</p><p>행사 영역: {memberships[0].organization.id}</p><button disabled={logoutBusy} onClick={onLogout}>로그아웃</button></> }))
beforeEach(() => {
  vi.resetAllMocks()
  window.history.replaceState(null, '', '/')
  auth.useSession.mockReturnValue({ data: null, isPending: false, error: null, refetch: auth.refetch })
})
afterEach(cleanup)

test('anonymous user starts Google login with same-origin callbacks', async () => {
  auth.social.mockResolvedValue({ error: null })
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
  await waitFor(() => expect(auth.social).toHaveBeenCalledWith({ provider: 'google', callbackURL: '/', errorCallbackURL: '/' }))
})

test('session loading and failures are not presented as logged out', () => {
  auth.useSession.mockReturnValue({ data: null, isPending: true, error: null })
  const view = render(<App />)
  expect(screen.getByRole('status').textContent).toContain('확인 중')
  expect(screen.queryByRole('button', { name: 'Google로 로그인' })).toBeNull()
  auth.useSession.mockReturnValue({ data: null, isPending: false, error: { message: 'private error' }, refetch: auth.refetch })
  view.rerender(<App />)
  expect(screen.getByRole('alert').textContent).toContain('세션을 확인하지 못했어요')
  fireEvent.click(screen.getByRole('button', { name: '다시 확인' }))
  expect(auth.refetch).toHaveBeenCalled()
})

test('authenticated user can logout and session changes update the screen', async () => {
  auth.useSession.mockReturnValue({ data: { user: { name: '테스터', email: 'test@example.test' } }, isPending: false, error: null })
  auth.signOut.mockResolvedValue({ error: null })
  const view = render(<App />)
  expect(screen.getByText('test@example.test')).toBeTruthy()
  expect(screen.getByText('행사 영역: o1')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
  await waitFor(() => expect(auth.signOut).toHaveBeenCalledOnce())
  auth.useSession.mockReturnValue({ data: null, isPending: false, error: null })
  view.rerender(<App />)
  expect(screen.getByRole('button', { name: 'Google로 로그인' })).toBeTruthy()
  expect(screen.queryByText('행사 영역: o1')).toBeNull()
})

test('login failure allows retry without exposing the raw error', async () => {
  auth.social.mockRejectedValue(new Error('private error'))
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('로그인을 시작하지 못했어요'))
  expect(screen.getByRole('button', { name: 'Google로 로그인' }).hasAttribute('disabled')).toBe(false)
})

test('OAuth callback failure is explained without showing its raw value', () => {
  window.history.replaceState(null, '', '/?error=access_denied')
  render(<App />)
  expect(screen.getByRole('alert').textContent).toContain('로그인이 완료되지 않았어요')
})

test('logout failure keeps the signed-in state and enables retry', async () => {
  auth.useSession.mockReturnValue({ data: { user: { name: '테스터', email: 'test@example.test' } }, isPending: false, error: null })
  auth.signOut.mockResolvedValue({ error: { message: 'private error' } })
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('로그아웃하지 못했어요'))
  expect(screen.getByRole('button', { name: '로그아웃' }).hasAttribute('disabled')).toBe(false)
})

test('invite link login returns to the same invite and says why', async () => {
  window.history.replaceState(null, '', '/join/ABCD2345')
  auth.social.mockResolvedValue({ error: null })
  render(<App />)
  expect(screen.getByText('학생회 초대 링크로 들어왔어요. 로그인하면 참여할 수 있어요.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
  await waitFor(() => expect(auth.social).toHaveBeenCalledWith({ provider: 'google', callbackURL: '/join/ABCD2345', errorCallbackURL: '/join/ABCD2345' }))
})

test('KakaoTalk in-app browser offers the outside browser instead of Google login', () => {
  const agent = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Linux; Android 14) KAKAOTALK/10.9.0')
  try {
    render(<App />)
    expect(screen.getByText('카카오톡 안에서는 Google 로그인이 막혀 있어요. 바깥 브라우저로 열어 주세요.')).toBeTruthy()
    expect(screen.getByRole('button', { name: '바깥 브라우저로 열기' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Google로 로그인' })).toBeNull()
  } finally {
    agent.mockRestore()
  }
})

test('OAuth failure on an invite link keeps the invite and explains the failure', async () => {
  window.history.replaceState(null, '', '/join/ABCD2345?error=access_denied')
  auth.social.mockResolvedValue({ error: null })
  render(<App />)
  expect(screen.getByRole('alert').textContent).toContain('로그인이 완료되지 않았어요')
  expect(screen.getByText('학생회 초대 링크로 들어왔어요. 로그인하면 참여할 수 있어요.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
  await waitFor(() => expect(auth.social).toHaveBeenCalledWith({ provider: 'google', callbackURL: '/join/ABCD2345', errorCallbackURL: '/join/ABCD2345' }))
})

test('iOS home-screen app opens an in-app window before asking for the Google URL', async () => {
  Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
  const popup = { location: { href: 'about:blank' }, close: vi.fn() }
  const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
  auth.social.mockResolvedValue({ data: { url: 'https://accounts.google.com/x', redirect: false }, error: null })
  try {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
    expect(open).toHaveBeenCalledWith('about:blank', '_blank')
    await waitFor(() => expect(popup.location.href).toBe('https://accounts.google.com/x'))
    expect(auth.social).toHaveBeenCalledWith({ provider: 'google', callbackURL: '/auth-done', errorCallbackURL: '/auth-done?error=1', disableRedirect: true })
    expect(screen.getByRole('button', { name: '다른 방법으로 로그인' })).toBeTruthy()
  } finally {
    open.mockRestore()
    delete (navigator as { standalone?: boolean }).standalone
  }
})

test('iOS home-screen app rechecks the session when the login window reports back', () => {
  Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
  const listeners: (() => void)[] = []
  vi.stubGlobal('BroadcastChannel', class {
    set onmessage(listener: () => void) { listeners.push(listener) }
    postMessage() {}
    close() {}
  })
  try {
    render(<App />)
    expect(listeners).toHaveLength(1)
    listeners[0]!()
    expect(auth.refetch).toHaveBeenCalled()
  } finally {
    vi.unstubAllGlobals()
    delete (navigator as { standalone?: boolean }).standalone
  }
})

test('iOS home-screen app rechecks the session when it becomes visible again, and stops listening once signed in', () => {
  Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
  let visibility: DocumentVisibilityState = 'visible'
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility })
  const changeTo = (next: DocumentVisibilityState) => {
    visibility = next
    document.dispatchEvent(new Event('visibilitychange'))
  }
  const closed = vi.fn()
  vi.stubGlobal('BroadcastChannel', class {
    postMessage() {}
    close() { closed() }
  })
  try {
    const view = render(<App />)
    changeTo('hidden')
    expect(auth.refetch).not.toHaveBeenCalled()
    changeTo('visible')
    expect(auth.refetch).toHaveBeenCalledTimes(1)
    auth.useSession.mockReturnValue({ data: { user: { name: '테스터', email: 'test@example.test' } }, isPending: false, error: null, refetch: auth.refetch })
    view.rerender(<App />)
    expect(closed).toHaveBeenCalled()
    changeTo('visible')
    expect(auth.refetch).toHaveBeenCalledTimes(1)
  } finally {
    vi.unstubAllGlobals()
    delete (document as { visibilityState?: unknown }).visibilityState
    delete (navigator as { standalone?: boolean }).standalone
  }
})
