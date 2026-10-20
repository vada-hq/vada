// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'

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
const push = vi.hoisted(() => ({ forgetThisDevice: vi.fn() }))
vi.mock('./push/push-logout', () => ({ forgetThisDevice: push.forgetThisDevice }))
// 로그인 뒤의 화면은 따로 시험한다(App.integration.test.tsx). 여기서는 App이 무엇을 넘기는지만 본다.
vi.mock('./councils/MyCouncils', () => ({
  default: ({
    card,
    initialCouncilId,
    chatLink,
    onEnterCode,
  }: {
    card: (content: ReactNode) => ReactNode
    initialCouncilId?: string
    chatLink?: { councilId: string; roomId: string; seq: number } | null
    onEnterCode: (code: string) => void
  }) => (
    <>
      {card(
        <>
          <p>학생회 목록 자리{initialCouncilId ? `: ${initialCouncilId}` : ''}</p>
          {chatLink && (
            <p>
              방 열기: {chatLink.councilId}/{chatLink.roomId}/{chatLink.seq}
            </p>
          )}
          <button type="button" onClick={() => onEnterCode('WXYZ6789')}>
            코드 입력
          </button>
        </>,
      )}
    </>
  ),
}))
vi.mock('./councils/JoinCouncil', () => ({
  default: ({
    code,
    onJoined,
    onLeave,
  }: {
    code: string
    onJoined: (id: string) => void
    onLeave: () => void
  }) => (
    <>
      <p>초대 확인 자리: {code}</p>
      <button type="button" onClick={() => onJoined('c9')}>
        들어가기
      </button>
      <button type="button" onClick={onLeave}>
        나가기
      </button>
    </>
  ),
}))
const signedIn = () =>
  auth.useSession.mockReturnValue({
    data: { user: { id: 'u1', name: '테스터', email: 'test@example.test' } },
    isPending: false,
    error: null,
  })
beforeEach(() => {
  vi.resetAllMocks()
  window.history.replaceState(null, '', '/')
  auth.useSession.mockReturnValue({
    data: null,
    isPending: false,
    error: null,
    refetch: auth.refetch,
  })
})
afterEach(cleanup)

test('anonymous user starts Google login with same-origin callbacks', async () => {
  auth.social.mockResolvedValue({ error: null })
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
  await waitFor(() =>
    expect(auth.social).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: '/',
      errorCallbackURL: '/',
    }),
  )
})

test('session loading and failures are not presented as logged out', () => {
  auth.useSession.mockReturnValue({ data: null, isPending: true, error: null })
  const view = render(<App />)
  expect(screen.getByRole('status').textContent).toContain('확인 중')
  expect(screen.queryByRole('button', { name: 'Google로 로그인' })).toBeNull()
  auth.useSession.mockReturnValue({
    data: null,
    isPending: false,
    error: { message: 'private error' },
    refetch: auth.refetch,
  })
  view.rerender(<App />)
  expect(screen.getByRole('alert').textContent).toContain('세션을 확인하지 못했어요')
  fireEvent.click(screen.getByRole('button', { name: '다시 확인' }))
  expect(auth.refetch).toHaveBeenCalled()
})

test('로그인하면 내 학생회 화면을 열고, 카드에 이름·휴대폰 알림·로그아웃이 있다', async () => {
  signedIn()
  auth.signOut.mockResolvedValue({ error: null })
  const view = render(<App />)
  expect(screen.getByText('학생회 목록 자리')).toBeTruthy()
  expect(screen.getByText('test@example.test')).toBeTruthy()
  expect(screen.getByRole('button', { name: '휴대폰 알림' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
  await waitFor(() => expect(auth.signOut).toHaveBeenCalledOnce())
  auth.useSession.mockReturnValue({ data: null, isPending: false, error: null })
  view.rerender(<App />)
  expect(screen.getByRole('button', { name: 'Google로 로그인' })).toBeTruthy()
})

test('로그아웃은 이 기기 줄을 먼저 지운 뒤에 한다', async () => {
  signedIn()
  const order: string[] = []
  push.forgetThisDevice.mockImplementation(async () => {
    order.push('기기 지우기')
  })
  auth.signOut.mockImplementation(async () => {
    order.push('로그아웃')
    return { error: null }
  })
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
  await waitFor(() => expect(auth.signOut).toHaveBeenCalledOnce())
  expect(order).toEqual(['기기 지우기', '로그아웃'])
})

test('알림 주소(/chat/학생회/방)로 열면 그 방을 열라고 넘기고 주소는 맨 앞으로 되돌린다', async () => {
  signedIn()
  window.history.replaceState(null, '', '/chat/c1/r1')
  render(<App />)
  expect(screen.getByText('방 열기: c1/r1/0')).toBeTruthy()
  await waitFor(() => expect(window.location.pathname).toBe('/'))
})

test('열려 있는 동안 서비스 워커가 알리면 그 방으로 다시 연다', async () => {
  signedIn()
  const listeners: ((event: { data: unknown }) => void)[] = []
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      addEventListener: (_type: string, listener: (event: { data: unknown }) => void) =>
        listeners.push(listener),
      removeEventListener: () => undefined,
    },
  })
  render(<App />)
  expect(screen.queryByText(/방 열기/)).toBeNull()
  act(() => listeners[0]!({ data: { type: 'vada:open', url: '/chat/c2/r9' } }))
  expect(screen.getByText('방 열기: c2/r9/1')).toBeTruthy()
  act(() => listeners[0]!({ data: { type: 'vada:open', url: '/chat/c2/r9' } }))
  expect(screen.getByText('방 열기: c2/r9/2')).toBeTruthy()
  act(() => listeners[0]!({ data: { type: 'vada:open', url: 'https://evil.test/chat/c2/r9' } }))
  expect(screen.getByText('방 열기: c2/r9/2')).toBeTruthy()
  Reflect.deleteProperty(navigator, 'serviceWorker')
})

test('login failure allows retry without exposing the raw error', async () => {
  auth.social.mockRejectedValue(new Error('private error'))
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('로그인을 시작하지 못했어요'),
  )
  expect(screen.getByRole('button', { name: 'Google로 로그인' }).hasAttribute('disabled')).toBe(
    false,
  )
})

test('OAuth callback failure is explained without showing its raw value', () => {
  window.history.replaceState(null, '', '/?error=access_denied')
  render(<App />)
  expect(screen.getByRole('alert').textContent).toContain('로그인이 완료되지 않았어요')
})

test('logout failure keeps the signed-in state and enables retry', async () => {
  signedIn()
  auth.signOut.mockResolvedValue({ error: { message: 'private error' } })
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('로그아웃하지 못했어요'),
  )
  expect(screen.getByRole('button', { name: '로그아웃' }).hasAttribute('disabled')).toBe(false)
})

test('초대 링크로 온 사람은 로그인 뒤 같은 초대로 돌아오고, 왜 로그인하는지 안다', async () => {
  window.history.replaceState(null, '', '/join/ABCD2345')
  auth.social.mockResolvedValue({ error: null })
  render(<App />)
  expect(
    screen.getByText('학생회 초대 링크로 들어왔어요. 로그인하면 들어갈 수 있어요.'),
  ).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
  await waitFor(() =>
    expect(auth.social).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: '/join/ABCD2345',
      errorCallbackURL: '/join/ABCD2345',
    }),
  )
})

test('초대 링크의 로그인이 실패해도 초대를 지키고 까닭을 알린다', async () => {
  window.history.replaceState(null, '', '/join/ABCD2345?error=access_denied')
  render(<App />)
  expect(screen.getByRole('alert').textContent).toContain('로그인이 완료되지 않았어요')
  expect(
    screen.getByText('학생회 초대 링크로 들어왔어요. 로그인하면 들어갈 수 있어요.'),
  ).toBeTruthy()
})

test('로그인한 사람이 초대 링크로 오면 초대를 확인하고, 들어가면 주소를 지우고 그 학생회를 연다', () => {
  window.history.replaceState(null, '', '/join/ABCD2345')
  signedIn()
  render(<App />)
  expect(screen.getByText('초대 확인 자리: ABCD2345')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '들어가기' }))
  expect(window.location.pathname).toBe('/')
  expect(screen.getByText('학생회 목록 자리: c9')).toBeTruthy()
})

test('학생회가 없어 코드를 입력하면 초대 확인으로 가고, 나가면 목록으로 돌아온다', () => {
  signedIn()
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: '코드 입력' }))
  expect(screen.getByText('초대 확인 자리: WXYZ6789')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '나가기' }))
  expect(screen.getByText('학생회 목록 자리')).toBeTruthy()
})

test('KakaoTalk in-app browser offers the outside browser instead of Google login', () => {
  const agent = vi
    .spyOn(navigator, 'userAgent', 'get')
    .mockReturnValue('Mozilla/5.0 (Linux; Android 14) KAKAOTALK/10.9.0')
  try {
    render(<App />)
    expect(
      screen.getByText(
        '카카오톡 안에서는 Google 로그인이 막혀 있어요. 바깥 브라우저로 열어 주세요.',
      ),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: '바깥 브라우저로 열기' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Google로 로그인' })).toBeNull()
  } finally {
    agent.mockRestore()
  }
})

test('iOS home-screen app opens an in-app window before asking for the Google URL', async () => {
  Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
  const popup = { location: { href: 'about:blank' }, close: vi.fn() }
  const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
  auth.social.mockResolvedValue({
    data: { url: 'https://accounts.google.com/x', redirect: false },
    error: null,
  })
  try {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
    expect(open).toHaveBeenCalledWith('about:blank', '_blank')
    await waitFor(() => expect(popup.location.href).toBe('https://accounts.google.com/x'))
    expect(auth.social).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: '/auth-done',
      errorCallbackURL: '/auth-done?error=1',
      disableRedirect: true,
    })
    expect(screen.getByRole('button', { name: '다른 방법으로 로그인' })).toBeTruthy()
  } finally {
    open.mockRestore()
    delete (navigator as { standalone?: boolean }).standalone
  }
})

test('iOS home-screen app releases the busy state and says so when opening or driving the login window throws', async () => {
  Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
  const open = vi.spyOn(window, 'open').mockImplementation(() => {
    throw new Error('window.open is not allowed here')
  })
  try {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Google로 로그인' }))
    expect(
      await screen.findByText('로그인을 시작하지 못했어요. 연결을 확인하고 다시 시도해 주세요.'),
    ).toBeTruthy()
    // 다시 누를 수 있다: 두 버튼이 모두 풀려 있다.
    const retry = screen.getByRole('button', { name: 'Google로 로그인' })
    expect(retry).toHaveProperty('disabled', false)
    expect(screen.getByRole('button', { name: '다른 방법으로 로그인' })).toHaveProperty(
      'disabled',
      false,
    )
    // 팝업이 열린 뒤에 닫기가 던져도 같다.
    const popup = {
      location: { href: 'about:blank' },
      close: vi.fn(() => {
        throw new Error('already closed')
      }),
    }
    open.mockReturnValue(popup as unknown as Window)
    auth.social.mockRejectedValue(new Error('offline'))
    fireEvent.click(retry)
    await waitFor(() => expect(popup.close).toHaveBeenCalled())
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Google로 로그인' })).toHaveProperty(
        'disabled',
        false,
      ),
    )
  } finally {
    open.mockRestore()
    delete (navigator as { standalone?: boolean }).standalone
  }
})

test('iOS home-screen app rechecks the session when the login window reports back', () => {
  Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
  const listeners: (() => void)[] = []
  vi.stubGlobal(
    'BroadcastChannel',
    class {
      set onmessage(listener: () => void) {
        listeners.push(listener)
      }
      postMessage() {}
      close() {}
    },
  )
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
  vi.stubGlobal(
    'BroadcastChannel',
    class {
      postMessage() {}
      close() {
        closed()
      }
    },
  )
  try {
    const view = render(<App />)
    changeTo('hidden')
    expect(auth.refetch).not.toHaveBeenCalled()
    changeTo('visible')
    expect(auth.refetch).toHaveBeenCalledTimes(1)
    auth.useSession.mockReturnValue({
      data: { user: { name: '테스터', email: 'test@example.test' } },
      isPending: false,
      error: null,
      refetch: auth.refetch,
    })
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
