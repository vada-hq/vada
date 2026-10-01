import { useState } from 'react'
import { authClient } from './auth/auth-client'
import Memberships from './access/Memberships'
import Workspace from './workspace/Workspace'
import StateMessage from './shared/ui/StateMessage'
import './styles/tokens.css'
import './styles/base.css'
import './App.css'

export default function App() {
  const { data: session, isPending, error, refetch } = authClient.useSession()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(() => new URLSearchParams(window.location.search).has('error')
    ? '로그인이 완료되지 않았어요. 다시 시도해 주세요.' : '')

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

  if (!isPending && !error && session) return <>
    {message && <StateMessage kind="error" className="app-notice">{message}</StateMessage>}
    <Memberships key={session.user.id}
      renderMemberships={memberships => <Workspace memberships={memberships} user={session.user} logoutBusy={busy} onLogout={() => { void logout() }} />}
      renderFallback={content => <main className="auth-card"><p className="eyebrow">학생회를 위한 공간</p><h1>VADA M1</h1><h2>로그인 완료</h2>
        <p>{session.user.name}</p><p className="email">{session.user.email}</p>{content}
        <button disabled={busy} onClick={() => { void logout() }}>{busy ? '로그아웃 중…' : '로그아웃'}</button>
      </main>} />
  </>

  return (
    <main className="auth-card">
      <p className="eyebrow">학생회를 위한 공간</p>
      <h1>VADA M1</h1>
      {isPending ? <StateMessage kind="loading">로그인 상태 확인 중…</StateMessage> : error ? (
        <>
          <StateMessage kind="error">세션을 확인하지 못했어요. 서버 연결을 확인해 주세요.</StateMessage>
          <button onClick={() => { void refetch() }}>다시 확인</button>
        </>
      ) : (
        <>
          <p>Google 계정으로 로그인해 주세요.</p>
          <button disabled={busy} onClick={() => { void login() }}>{busy ? 'Google로 이동 중…' : 'Google로 로그인'}</button>
        </>
      )}
      {message && <StateMessage kind="error">{message}</StateMessage>}
    </main>
  )
}
