import { useState, type ReactNode } from 'react'
import { authClient } from './auth/auth-client'
import Memberships from './access/Memberships'
import InviteCodeForm from './access/InviteCodeForm'
import JoinOrganization from './access/JoinOrganization'
import { inviteCodeFromPath, invitePath } from './access/invite-path'
import Workspace from './workspace/Workspace'
import CreateOrganization from './organization/CreateOrganization'
import StateMessage from '@/components/StateMessage'
import { AuthCard } from '@/components/AuthCard'
import { BrandMark } from '@/components/BrandMark'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { isKakaoInAppBrowser } from '@/lib/in-app-browser'

// 초대 링크(/join/코드)로 왔는지, 소속이 없어 코드를 직접 입력했는지에 따라 돌아갈 곳이 다르다.
type Invite = { code: string; from: 'link' | 'form' }
// 참여나 만들기로 방금 연 학생회. 참여하면 내 업무, 만든 학생회는 구성원 화면부터 연다.
type Opened = { organizationId: string; view: 'tasks' | 'members' }

// 로그인 전후의 가운데 카드 화면. 와이어프레임 SIGN-IN·INV-00과 같은 틀이다.
function AuthPage({ children }: { children: ReactNode }) {
  return <main className="flex min-h-dvh items-center justify-center p-4 sm:py-12">
    <AuthCard>
      <div className="flex flex-wrap items-center gap-2">
        <BrandMark />
        <h1 className="text-base font-semibold text-gray-900">VADA M1</h1>
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
  const [invite, setInvite] = useState<Invite | null>(() => {
    const code = inviteCodeFromPath(window.location.pathname)
    return code === null ? null : { code, from: 'link' }
  })
  const [typedCode, setTypedCode] = useState('')
  const [opened, setOpened] = useState<Opened>()
  const [creating, setCreating] = useState(false)

  function leaveInvite() {
    window.history.replaceState(null, '', '/')
    setInvite(null)
  }

  function finishInvite(organizationId: string) {
    leaveInvite()
    setOpened({ organizationId, view: 'tasks' })
  }

  async function login() {
    setBusy(true)
    setMessage('')
    try {
      // 초대 링크로 왔으면 로그인 뒤 같은 초대로 돌아온다.
      const callbackURL = invite?.from === 'link' ? invitePath(invite.code) : '/'
      const result = await authClient.signIn.social({ provider: 'google', callbackURL, errorCallbackURL: callbackURL })
      if (result.error) throw new Error('Sign-in failed')
    } catch {
      setMessage('로그인을 시작하지 못했어요. 연결을 확인하고 다시 시도해 주세요.')
      setBusy(false)
    }
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
    const card = (content: ReactNode) => <AuthPage>
      <div className="flex flex-col gap-0.5 rounded-md bg-gray-50 px-3 py-2">
        <h2 className="text-xs font-medium text-gray-500">로그인 완료</h2>
        <p className="text-sm font-medium text-gray-900">{session.user.name}</p>
        <p className="text-xs wrap-anywhere text-gray-500">{session.user.email}</p>
      </div>
      {content}
      <Button variant="outline" disabled={busy} onClick={() => { void logout() }}>{busy ? '로그아웃 중…' : '로그아웃'}</Button>
    </AuthPage>
    return <>
      {message && <StateMessage kind="error" className="border-b bg-white px-6 py-3">{message}</StateMessage>}
      {invite ? card(<JoinOrganization key={invite.code} code={invite.code}
        leaveLabel={invite.from === 'link' ? 'VADA로 가기' : '다시 입력'} onJoined={finishInvite} onLeave={leaveInvite} />)
        : <Memberships key={`${session.user.id}:${opened?.organizationId ?? ''}`}
          renderMemberships={(memberships, refresh) => <Workspace memberships={memberships} initialOrganizationId={opened?.organizationId}
            initialView={opened?.view} onMembershipsChanged={refresh} user={session.user} logoutBusy={busy} onLogout={() => { void logout() }} />}
          renderEmpty={() => creating
            ? <CreateOrganization onCancel={() => setCreating(false)}
              onCreated={organizationId => { setCreating(false); setOpened({ organizationId, view: 'members' }) }} />
            : <InviteCodeForm initialCode={typedCode} onCreate={() => setCreating(true)}
              onSubmit={code => { setTypedCode(code); setInvite({ code, from: 'form' }) }} />}
          renderFallback={card} />}
    </>
  }

  return <AuthPage>
    {isPending ? <StateMessage kind="loading">로그인 상태 확인 중…</StateMessage> : error ? <div className="flex flex-col gap-3">
      <StateMessage kind="error">세션을 확인하지 못했어요. 서버 연결을 확인해 주세요.</StateMessage>
      <Button onClick={() => { void refetch() }}>다시 확인</Button>
    </div> : <div className="flex flex-col gap-3">
      {invite?.from === 'link' && <Alert tone="info">학생회 초대 링크로 들어왔어요. 로그인하면 참여할 수 있어요.</Alert>}
      {isKakaoInAppBrowser(navigator.userAgent) && <Alert tone="warning">카카오톡 안에서는 Google 로그인이 막혀 있어요. 메뉴에서 '다른 브라우저로 열기'를 눌러 주세요.</Alert>}
      <p className="text-sm text-gray-500">Google 계정으로 로그인해 주세요.</p>
      <Button disabled={busy} onClick={() => { void login() }}>{busy ? 'Google로 이동 중…' : 'Google로 로그인'}</Button>
    </div>}
    {message && <StateMessage kind="error">{message}</StateMessage>}
  </AuthPage>
}
