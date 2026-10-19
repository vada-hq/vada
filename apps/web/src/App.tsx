import { useEffect, useState, type ReactNode } from 'react'
import { authClient } from './auth/auth-client'
import LoginPanel from './auth/LoginPanel'
import { AUTH_CHANNEL, AUTH_DONE_PATH, startPopupLogin } from './auth/popup-login'
import { inviteCodeFromPath, invitePath } from './councils/invite-path'
import JoinCouncil from './councils/JoinCouncil'
import MyCouncils from './councils/MyCouncils'
import PushSettingsButton from './push/PushSettings'
import StateMessage from '@/components/StateMessage'
import { AuthCard } from '@/components/AuthCard'
import { BrandMark } from '@/components/BrandMark'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { isKakaoInAppBrowser } from '@/lib/in-app-browser'
import { setUnauthorizedHandler } from '@/lib/api'
import { isIosHomeScreenApp } from '@/lib/platform'

// 초대 링크(/join/코드)로 왔는지, 학생회가 없어 코드를 직접 입력했는지에 따라 돌아갈 곳이 다르다.
type Invite = { code: string; from: 'link' | 'form' }

// 로그인 전후의 가운데 카드 화면. 와이어프레임 SIGN-IN·INV-00과 같은 틀이다.
function AuthPage({ children }: { children: ReactNode }) {
  // 작업 공간의 h-dvh 열 안에서 카드가 화면보다 길어도 줄어들지 않고 페이지가 스크롤되게 shrink-0을 둔다.
  return (
    <main className="flex min-h-dvh shrink-0 items-center justify-center p-4 sm:py-12">
      <AuthCard>
        <div className="flex flex-wrap items-center gap-2">
          <BrandMark />
          <h1 className="text-base font-semibold text-gray-900">VADA</h1>
          <p className="ml-auto text-xs text-gray-400">학생회를 위한 공간</p>
        </div>
        {children}
      </AuthCard>
    </main>
  )
}

export default function App() {
  const { data: session, isPending, error, refetch } = authClient.useSession()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(() =>
    new URLSearchParams(window.location.search).has('error')
      ? '로그인이 완료되지 않았어요. 다시 시도해 주세요.'
      : '',
  )
  const [invite, setInvite] = useState<Invite | null>(() => {
    const code = inviteCodeFromPath(window.location.pathname)
    return code === null ? null : { code, from: 'link' }
  })
  // 초대로 방금 들어온 학생회. 작업 공간이 그 학생회를 먼저 연다.
  const [opened, setOpened] = useState<string>()
  const [homeScreenApp] = useState(() => isIosHomeScreenApp(navigator as { standalone?: boolean }))
  // iOS 홈 화면 앱: 로그인 창이 알리거나 앱이 다시 보이면 세션을 다시 읽는다.
  useEffect(() => {
    if (!homeScreenApp || session) return
    const recheck = () => {
      void refetch()
    }
    const channel =
      typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(AUTH_CHANNEL)
    if (channel) channel.onmessage = recheck
    const onVisible = () => {
      if (document.visibilityState === 'visible') recheck()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      channel?.close()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [homeScreenApp, session, refetch])

  // 로그인이 풀려 API가 401을 주면 세션을 다시 읽는다. 세션이 없으면 아래에서 로그인 화면으로 돌아간다.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void refetch()
    })
    return () => setUnauthorizedHandler(null)
  }, [refetch])

  function leaveInvite() {
    window.history.replaceState(null, '', '/')
    setInvite(null)
  }

  async function login() {
    setBusy(true)
    setMessage('')
    try {
      // 초대 링크로 왔으면 로그인 뒤 같은 초대로 돌아온다.
      const callbackURL = invite?.from === 'link' ? invitePath(invite.code) : '/'
      const result = await authClient.signIn.social({
        provider: 'google',
        callbackURL,
        errorCallbackURL: callbackURL,
      })
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
    const result = await startPopupLogin(
      () => window.open('about:blank', '_blank'),
      () =>
        authClient.signIn.social({
          provider: 'google',
          callbackURL: AUTH_DONE_PATH,
          errorCallbackURL: `${AUTH_DONE_PATH}?error=1`,
          disableRedirect: true,
        }),
    )
    setBusy(false)
    if (result === 'blocked')
      setMessage('로그인 창을 열지 못했어요. 다른 방법으로 로그인해 주세요.')
    if (result === 'failed')
      setMessage('로그인을 시작하지 못했어요. 연결을 확인하고 다시 시도해 주세요.')
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

  if (!isPending && !error && session) {
    const card = (content: ReactNode) => (
      <AuthPage>
        <div className="flex flex-col gap-0.5 rounded-md bg-gray-50 px-3 py-2">
          <h2 className="text-xs font-medium text-gray-500">로그인 완료</h2>
          <p className="text-sm font-medium text-gray-900">{session.user.name}</p>
          <p className="text-xs wrap-anywhere text-gray-500">{session.user.email}</p>
        </div>
        {content}
        <div className="flex items-center gap-2">
          <PushSettingsButton />
          <Button
            variant="outline"
            className="flex-1"
            disabled={busy}
            onClick={() => {
              void logout()
            }}
          >
            {busy ? '로그아웃 중…' : '로그아웃'}
          </Button>
        </div>
      </AuthPage>
    )
    // 로그아웃 실패는 카드 화면과 작업 공간 어디서나 맨 위 한 줄로 알린다. 작업 공간은 알림 줄을 뺀 남은 높이만 쓰도록 같은 h-dvh 열 안에 둔다.
    const banner = message && (
      <StateMessage kind="error" className="border-b bg-white px-6 py-3">
        {message}
      </StateMessage>
    )
    if (invite)
      return (
        <>
          {banner}
          {card(
            <JoinCouncil
              key={invite.code}
              code={invite.code}
              leaveLabel={invite.from === 'link' ? 'VADA로 가기' : '다시 입력'}
              onJoined={councilId => {
                leaveInvite()
                setOpened(councilId)
              }}
              onLeave={leaveInvite}
            />,
          )}
        </>
      )
    return (
      <div className="flex h-dvh flex-col">
        {banner}
        <MyCouncils
          key={`${session.user.id}:${opened ?? ''}`}
          user={session.user}
          initialCouncilId={opened}
          card={card}
          onEnterCode={code => setInvite({ code, from: 'form' })}
          logoutBusy={busy}
          onLogout={() => {
            void logout()
          }}
        />
      </div>
    )
  }

  return (
    <AuthPage>
      {isPending ? (
        <StateMessage kind="loading">로그인 상태 확인 중…</StateMessage>
      ) : error ? (
        <div className="flex flex-col gap-3">
          <StateMessage kind="error">
            세션을 확인하지 못했어요. 서버 연결을 확인해 주세요.
          </StateMessage>
          <Button
            onClick={() => {
              void refetch()
            }}
          >
            다시 확인
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {invite?.from === 'link' && (
            <Alert tone="info">학생회 초대 링크로 들어왔어요. 로그인하면 들어갈 수 있어요.</Alert>
          )}
          <LoginPanel
            kakao={isKakaoInAppBrowser(navigator.userAgent)}
            homeScreenApp={homeScreenApp}
            busy={busy}
            onLogin={() => {
              void login()
            }}
            onLoginInApp={() => {
              void loginInApp()
            }}
          />
        </div>
      )}
      {message && <StateMessage kind="error">{message}</StateMessage>}
    </AuthPage>
  )
}
