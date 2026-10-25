import { useState } from 'react'
import AgreementGate from './auth/AgreementGate'
import { authClient } from './auth/auth-client'
import SignedInView from './auth/SignedInView'
import SignedOutView from './auth/SignedOutView'
import { useAuthActions } from './auth/useAuthActions'
import { useInviteEntry } from './auth/useInviteEntry'
import { useSessionRecheck } from './auth/useSessionRecheck'
import { useWithdrawnNotice } from './auth/withdrawn'
import { isIosHomeScreenApp } from '@/lib/platform'
import { useNotificationInbox } from './workspace/useNotificationOpen'

export default function App() {
  const { data: session, isPending, error, refetch } = authClient.useSession()
  const { invite, opened, enterCode, leaveInvite, joined } = useInviteEntry()
  useNotificationInbox()
  const { busy, message, login, loginInApp, logout } = useAuthActions(invite)
  const [homeScreenApp] = useState(() => isIosHomeScreenApp(navigator as { standalone?: boolean }))
  useSessionRecheck(homeScreenApp, Boolean(session), refetch)
  const withdrawn = useWithdrawnNotice(refetch)

  const onLogout = () => {
    void logout()
  }

  if (!isPending && !error && session)
    return (
      <AgreementGate key={session.user.id} logoutBusy={busy} onLogout={onLogout}>
        <SignedInView
          user={session.user}
          invite={invite}
          opened={opened}
          busy={busy}
          message={message}
          onEnterCode={enterCode}
          onLeaveInvite={leaveInvite}
          onJoined={joined}
          onLogout={onLogout}
        />
      </AgreementGate>
    )
  return (
    <SignedOutView
      isPending={isPending}
      error={error}
      invite={invite}
      homeScreenApp={homeScreenApp}
      busy={busy}
      message={message}
      withdrawn={withdrawn.withdrawn}
      onRecheck={() => {
        void refetch()
      }}
      onLogin={() => {
        withdrawn.clear()
        void login()
      }}
      onLoginInApp={() => {
        withdrawn.clear()
        void loginInApp()
      }}
    />
  )
}
