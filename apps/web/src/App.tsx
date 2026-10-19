import { useEffect, useState, type ReactNode } from 'react'
import { authClient } from './auth/auth-client'
import LoginPanel from './auth/LoginPanel'
import { AUTH_CHANNEL, AUTH_DONE_PATH, startPopupLogin } from './auth/popup-login'
import PushSettingsButton from './push/PushSettings'
import StateMessage from '@/components/StateMessage'
import { AuthCard } from '@/components/AuthCard'
import { BrandMark } from '@/components/BrandMark'
import { Button } from '@/components/ui/button'
import { isKakaoInAppBrowser } from '@/lib/in-app-browser'
import { isIosHomeScreenApp } from '@/lib/platform'

// 로그인 전후의 가운데 카드 화면. 와이어프레임 SIGN-IN·INV-00과 같은 틀이다.
function AuthPage({ children }: { children: ReactNode }) {
  return <main className="flex min-h-dvh items-center justify-center p-4 sm:py-12">
    <AuthCard>
      <div className="flex flex-wrap items-center gap-2">
        <BrandMark />
        <h1 className="text-base font-semibold text-gray-900">VADA</h1>
        <p className="ml-auto text-xs text-gray-400">학생회를 위한 공간</p>
      </div>
      {children}
    </AuthCard>
  </main>
}

export default function App() {
  const { data: session, isPending, error, refetch } = authClient.useSession()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(() => new URLSearchParams(window.location.search).has('error')
    ? '로그인이 완료되지 않았어요. 다시 시도해 주세요.' : '')
  const [homeScreenApp] = useState(() => isIosHomeScreenApp(navigator as { standalone?: boolean }))
  // iOS 홈 화면 앱: 로그인 창이 알리거나 앱이 다시 보이면 세션을 다시 읽는다.
  useEffect(() => {
    if (!homeScreenApp || session) return
    const recheck = () => { void refetch() }
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(AUTH_CHANNEL)
    if (channel) channel.onmessage = recheck
    const onVisible = () => { if (document.visibilityState === 'visible') recheck() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { channel?.close(); document.removeEventListener('visibilitychange', onVisible) }
  }, [homeScreenApp, session, refetch])

  async function login() {
    setBusy(true)
    setMessage('')
    try {
      const result = await authClient.signIn.social({ provider: 'google', callbackURL: '/', errorCallbackURL: '/' })
      if (result.error) throw new Error('Sign-in failed')
    } catch {
      setMessage('로그인을 시작하지 못했어요. 연결을 확인하고 다시 시도해 주세요.')
      setBusy(false)
    }
  }

  // iOS 홈 화면 앱: 누른 순간 앱 안 창을 열고 그 창에서 Google 로그인을 한다(휴대폰 길 spec 길 B).
  async function loginInApp() {
    setBusy(true)
    setMessage('')
    const result = await startPopupLogin(() => window.open('about:blank', '_blank'),
      () => authClient.signIn.social({ provider: 'google', callbackURL: AUTH_DONE_PATH, errorCallbackURL: `${AUTH_DONE_PATH}?error=1`, disableRedirect: true }))
    setBusy(false)
    if (result === 'blocked') setMessage('로그인 창을 열지 못했어요. 다른 방법으로 로그인해 주세요.')
    if (result === 'failed') setMessage('로그인을 시작하지 못했어요. 연결을 확인하고 다시 시도해 주세요.')
  }

  async function logout() {
    setBusy(true)
    setMessage('')
    try {
      const result = await authClient.signOut()
      if (result.error) throw new Error('Sign-out failed')
    } catch {
      setMessage('로그아웃하지 못했어요. 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  // 바탕을 만드는 동안 로그인한 사람에게는 학생회가 없다는 안내와 휴대폰 알림만 보인다(바탕 spec '옛 기능 지우기').
  if (!isPending && !error && session) return <AuthPage>
    <div className="flex flex-col gap-0.5 rounded-md bg-gray-50 px-3 py-2">
      <h2 className="text-xs font-medium text-gray-500">로그인 완료</h2>
      <p className="text-sm font-medium text-gray-900">{session.user.name}</p>
      <p className="text-xs wrap-anywhere text-gray-500">{session.user.email}</p>
    </div>
    <p className="text-sm text-gray-500">아직 들어간 학생회가 없어요.</p>
    <div className="flex items-center gap-2">
      <PushSettingsButton />
      <Button variant="outline" className="flex-1" disabled={busy} onClick={() => { void logout() }}>{busy ? '로그아웃 중…' : '로그아웃'}</Button>
    </div>
    {message && <StateMessage kind="error">{message}</StateMessage>}
  </AuthPage>

  return <AuthPage>
    {isPending ? <StateMessage kind="loading">로그인 상태 확인 중…</StateMessage> : error ? <div className="flex flex-col gap-3">
      <StateMessage kind="error">세션을 확인하지 못했어요. 서버 연결을 확인해 주세요.</StateMessage>
      <Button onClick={() => { void refetch() }}>다시 확인</Button>
    </div> : <LoginPanel kakao={isKakaoInAppBrowser(navigator.userAgent)} homeScreenApp={homeScreenApp} busy={busy}
      onLogin={() => { void login() }} onLoginInApp={() => { void loginInApp() }} />}
    {message && <StateMessage kind="error">{message}</StateMessage>}
  </AuthPage>
}
