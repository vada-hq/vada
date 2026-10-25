import type { InvitePreviewResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'

// 초대 링크 화면의 세 모습: 없는 코드, 확인 실패, 들어갈까요?

export function InvalidInvite({
  leaveLabel,
  onLeave,
}: {
  leaveLabel: string
  onLeave: () => void
}) {
  return (
    <section aria-label="학생회 들어가기" className="flex flex-col gap-3">
      <StateMessage kind="error">
        초대 코드가 올바르지 않아요. 바뀌었을 수 있으니 학생회에 다시 받아 주세요.
      </StateMessage>
      <Button variant="outline" onClick={onLeave}>
        {leaveLabel}
      </Button>
    </section>
  )
}

type FailedProps = { leaveLabel: string; onRetry: () => void; onLeave: () => void }
export function FailedInvite({ leaveLabel, onRetry, onLeave }: FailedProps) {
  return (
    <section aria-label="학생회 들어가기" className="flex flex-col gap-3">
      <StateMessage kind="error">
        초대를 확인하지 못했어요. 연결을 확인하고 다시 시도해 주세요.
      </StateMessage>
      <Button onClick={onRetry}>다시 시도</Button>
      <Button variant="ghost" size="sm" onClick={onLeave}>
        {leaveLabel}
      </Button>
    </section>
  )
}

type AskProps = {
  council: InvitePreviewResponse['council']
  joining: boolean
  error: string
  onJoin: () => void
  onLeave: () => void
}
export function AskToJoin({ council, joining, error, onJoin, onLeave }: AskProps) {
  return (
    <section aria-label="학생회 들어가기" className="flex flex-col gap-4">
      <div className="rounded-lg border p-6">
        <h2 className="text-base font-semibold wrap-anywhere">{council.name}에 들어갈까요?</h2>
      </div>
      {/* 이름과 이메일이 학생회 데이터가 된다는 고지라 설명 글을 줄이는 규칙의 예외다(DEC-72 '운영진 명단'). */}
      <p className="text-xs text-muted-foreground">
        들어가면 부서와 직급 없이 운영진이 되고, 이름과 이메일이 이 학생회의 운영진 명단에 들어가요.
        부서는 회장단이 정해요.
      </p>
      {error && <StateMessage kind="error">{error}</StateMessage>}
      <div className="flex flex-col gap-2">
        <Button busy={joining} onClick={onJoin}>
          {joining ? '들어가는 중…' : '들어가기'}
        </Button>
        <Button variant="ghost" size="sm" busy={joining} onClick={onLeave}>
          들어가지 않기
        </Button>
      </div>
    </section>
  )
}
