import AuthPage from './AuthPage'
import LoginPanel from './LoginPanel'
import type { Invite } from './useInviteEntry'
import StateMessage from '@/components/StateMessage'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { isKakaoInAppBrowser } from '@/lib/in-app-browser'

type Props = {
  isPending: boolean
  error: unknown
  invite: Invite | null
  homeScreenApp: boolean
  busy: boolean
  message: string
  // 방금 탈퇴해 로그인 전 화면으로 왔다.
  withdrawn: boolean
  onRecheck: () => void
  onLogin: () => void
  onLoginInApp: () => void
}

function SessionFailed({ onRecheck }: { onRecheck: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <StateMessage kind="error">세션을 확인하지 못했어요. 서버 연결을 확인해 주세요.</StateMessage>
      <Button onClick={onRecheck}>다시 확인</Button>
    </div>
  )
}

// 로그인 전 카드의 내용: 세션을 읽는 중, 읽지 못함, 로그인 안내.
export default function SignedOutView({
  isPending,
  error,
  invite,
  homeScreenApp,
  busy,
  message,
  withdrawn,
  onRecheck,
  onLogin,
  onLoginInApp,
}: Props) {
  return (
    <AuthPage>
      {/* 방금 탈퇴했으면 세션 읽기의 진행·실패 대신 탈퇴 완료와 로그인을 보인다(쿠키는 이미 지워졌다). */}
      {isPending && !withdrawn ? (
        <StateMessage kind="loading">로그인 상태 확인 중…</StateMessage>
      ) : error && !withdrawn ? (
        <SessionFailed onRecheck={onRecheck} />
      ) : (
        <div className="flex flex-col gap-3">
          {withdrawn && <StateMessage kind="notice">탈퇴 완료</StateMessage>}
          {invite?.from === 'link' && (
            <Alert tone="info">학생회 초대 링크로 들어왔어요. 로그인하면 들어갈 수 있어요.</Alert>
          )}
          <LoginPanel
            kakao={isKakaoInAppBrowser(navigator.userAgent)}
            homeScreenApp={homeScreenApp}
            busy={busy}
            onLogin={onLogin}
            onLoginInApp={onLoginInApp}
          />
        </div>
      )}
      {message && <StateMessage kind="error">{message}</StateMessage>}
    </AuthPage>
  )
}
