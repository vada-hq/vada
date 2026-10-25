import JoinCouncil from '../councils/JoinCouncil'
import MyCouncils from '../councils/MyCouncils'
import SignedInCard from './SignedInCard'
import type { Invite } from './useInviteEntry'
import StateMessage from '@/components/StateMessage'

type User = { id: string; name: string; email: string }
type Props = {
  user: User
  invite: Invite | null
  opened: string | undefined
  busy: boolean
  message: string
  onEnterCode: (code: string) => void
  onLeaveInvite: () => void
  onJoined: (councilId: string) => void
  onLogout: () => void
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
        <SignedInCard user={user} compact busy={busy} onLogout={onLogout}>
          <JoinCouncil
            key={invite.code}
            code={invite.code}
            googleName={user.name}
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
        userId={user.id}
        initialCouncilId={opened}
        card={(content, frame) => (
          <SignedInCard
            user={user}
            compact={frame === 'compact'}
            withdraw={frame === 'no-council'}
            busy={busy}
            onLogout={onLogout}
          >
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
