import StateMessage from '@/components/StateMessage'
import { AskToJoin, FailedInvite, InvalidInvite } from './JoinCouncilViews'
import { useJoinCouncil } from './useJoinCouncil'

type Props = {
  code: string
  // 처음 이어지는 사람의 '내 이름' 칸에 미리 채우는 로그인 계정 이름.
  googleName: string
  leaveLabel: string
  onJoined: (councilId: string) => void
  onLeave: () => void
}

// 초대 링크(/join/코드): "OOO에 들어갈까요?" [들어가기]. 이미 들어왔으면 묻지 않고 그 학생회를 연다(바탕 spec '화면').
export default function JoinCouncil({ code, googleName, leaveLabel, onJoined, onLeave }: Props) {
  const { view, joining, error, join, retry } = useJoinCouncil(code, onJoined)
  if (view.kind === 'loading') return <StateMessage kind="loading">초대 확인 중…</StateMessage>
  if (view.kind === 'invalid') return <InvalidInvite leaveLabel={leaveLabel} onLeave={onLeave} />
  if (view.kind === 'failed')
    return <FailedInvite leaveLabel={leaveLabel} onRetry={retry} onLeave={onLeave} />
  return (
    <AskToJoin
      council={view.council}
      myName={view.myName}
      googleName={googleName}
      joining={joining}
      error={error}
      onJoin={memberName => {
        void join(memberName)
      }}
      onLeave={onLeave}
    />
  )
}
