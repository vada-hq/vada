import type { ReactNode } from 'react'
import JoinCouncil from '../councils/JoinCouncil'
import MyCouncils from '../councils/MyCouncils'
import PushSettingsButton from '../push/PushSettings'
import type { ChatLink } from '../workspace/useChatLink'
import AuthPage from './AuthPage'
import type { Invite } from './useInviteEntry'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'

type User = { id: string; name: string; email: string }
type Props = {
  user: User
  invite: Invite | null
  opened: string | undefined
  // 알림을 눌러 열 방. 내 학생회가 아니면 무시한다.
  chatLink: ChatLink | null
  busy: boolean
  message: string
  onEnterCode: (code: string) => void
  onLeaveInvite: () => void
  onJoined: (councilId: string) => void
  onLogout: () => void
}

// 로그인한 사람의 가운데 카드: 이름과 이메일, 안에 들어갈 내용, 휴대폰 알림과 로그아웃.
function SignedInCard({
  user,
  busy,
  onLogout,
  children,
}: Pick<Props, 'busy' | 'onLogout'> & { user: User; children: ReactNode }) {
  return (
    <AuthPage>
      <div className="flex flex-col gap-0.5 rounded-md bg-gray-50 px-3 py-2">
        <h2 className="text-xs font-medium text-gray-500">로그인 완료</h2>
        <p className="text-sm font-medium text-gray-900">{user.name}</p>
        <p className="text-xs wrap-anywhere text-gray-500">{user.email}</p>
      </div>
      {children}
      <div className="flex items-center gap-2">
        <PushSettingsButton />
        <Button
          variant="outline"
          className="flex-1"
          busy={busy}
          onClick={() => {
            onLogout()
          }}
        >
          {busy ? '로그아웃 중…' : '로그아웃'}
        </Button>
      </div>
    </AuthPage>
  )
}

// 로그아웃 실패는 카드 화면과 작업 공간 어디서나 맨 위 한 줄로 알린다.
function ErrorBanner({ message }: { message: string }) {
  if (!message) return null
  return (
    <StateMessage kind="error" className="border-b bg-white px-6 py-3">
      {message}
    </StateMessage>
  )
}

// 로그인한 뒤의 화면: 초대를 확인하는 중이면 초대 카드, 아니면 내 학생회 화면이다.
export default function SignedInView({
  user,
  invite,
  opened,
  chatLink,
  busy,
  message,
  onEnterCode,
  onLeaveInvite,
  onJoined,
  onLogout,
}: Props) {
  if (invite)
    return (
      <>
        <ErrorBanner message={message} />
        <SignedInCard user={user} busy={busy} onLogout={onLogout}>
          <JoinCouncil
            key={invite.code}
            code={invite.code}
            leaveLabel={invite.from === 'link' ? 'VADA로 가기' : '다시 입력'}
            onJoined={onJoined}
            onLeave={onLeaveInvite}
          />
        </SignedInCard>
      </>
    )
  // 작업 공간은 알림 줄을 뺀 남은 높이만 쓰도록 같은 h-dvh 열 안에 둔다.
  return (
    <div className="flex h-dvh flex-col">
      <ErrorBanner message={message} />
      <MyCouncils
        key={`${user.id}:${opened ?? ''}`}
        user={user}
        initialCouncilId={opened}
        chatLink={chatLink}
        card={content => (
          <SignedInCard user={user} busy={busy} onLogout={onLogout}>
            {content}
          </SignedInCard>
        )}
        onEnterCode={onEnterCode}
        logoutBusy={busy}
        onLogout={onLogout}
      />
    </div>
  )
}
