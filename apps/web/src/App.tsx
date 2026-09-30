import { useState } from 'react'
import { authClient } from './auth/auth-client'
import Memberships from './access/Memberships'
import Events from './events/Events'
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

  return (
    <main className={`auth-card${session ? ' workspace-card' : ''}`}>
      <p className="eyebrow">학생회를 위한 공간</p>
      <h1>VADA M1</h1>
      {isPending ? <p role="status">로그인 상태 확인 중…</p> : error ? (
        <>
          <p role="alert">세션을 확인하지 못했어요. 서버 연결을 확인해 주세요.</p>
          <button onClick={() => { void refetch() }}>다시 확인</button>
        </>
      ) : session ? (
        <>
          <h2>로그인 완료</h2>
          <p>{session.user.name}</p>
          <p className="email">{session.user.email}</p>
          <Memberships key={session.user.id} renderOrganization={(organization, handlesFinance) => <Events organizationId={organization.id} handlesFinance={handlesFinance} />} />
          <button disabled={busy} onClick={() => { void logout() }}>{busy ? '로그아웃 중…' : '로그아웃'}</button>
        </>
      ) : (
        <>
          <p>Google 계정으로 로그인해 주세요.</p>
          <button disabled={busy} onClick={() => { void login() }}>{busy ? 'Google로 이동 중…' : 'Google로 로그인'}</button>
        </>
      )}
      {message && <p role="alert">{message}</p>}
    </main>
  )
}
