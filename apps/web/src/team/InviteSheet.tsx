import { useState, type ReactNode } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { InviteFields } from '@/components/InviteFields'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { INVITE_LOAD_ERRORS, INVITE_NOTICES } from '@/lib/messages'
import { inviteLink } from '../councils/invite-path'
import { RotateInviteDialog } from './RotateInviteDialog'
import { useInvite } from './useInvite'

// 회장단에게만 회장단 카드 아래의 [구성원 초대]와 그 창(DEC-47, DEC-91, 와이어프레임 ORG-03A). 권한을 잃으면 둘 다 사라진다.
export function InviteButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="self-start text-primary-strong" onClick={onClick}>
      <Plus aria-hidden />
      구성원 초대
    </Button>
  )
}

type FrameProps = { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }

// 구성원 초대 창(와이어프레임 ORG-03C): 휴대폰은 아래, 넓은 화면은 오른쪽 시트다. 닫혀 있으면 안을 그리지 않으므로
// 창을 열기 전에는 초대 코드를 읽지 않는다.
export function InviteSheet({ open, onOpenChange, children }: FrameProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="adaptive" title="구성원 초대" closeLabel="닫기">
        <div className="overflow-y-auto px-6 pt-3 pb-6">{children}</div>
      </SheetContent>
    </Sheet>
  )
}

// 창 안: 링크와 코드, 만든 시각, [코드 바꾸기](확인 창). 바꾸면 옛 코드는 막히고 만료는 없다(DEC-47).
export function InviteSheetBody({
  councilId,
  onForbidden,
}: {
  councilId: string
  onForbidden: () => void
}) {
  const invite = useInvite(councilId, onForbidden)
  const [asking, setAsking] = useState(false)
  if (!invite.invite) return <LoadState error={invite.loadError} onRetry={invite.retry} />
  const failed = invite.notice === 'failed' || invite.notice === 'forbidden'
  return (
    <InviteFields
      link={inviteLink(invite.invite.code)}
      code={invite.invite.code}
      createdAt={invite.invite.createdAt}
      notice={asking && failed ? null : invite.notice}
      onCopy={(text, what) => {
        void invite.copy(text, what)
      }}
    >
      <Button
        variant="outline"
        size="sm"
        touch
        busy={invite.rotating}
        onClick={() => setAsking(true)}
      >
        <RefreshCw />
        {invite.rotating ? '바꾸는 중…' : '코드 바꾸기'}
      </Button>
      <RotateInviteDialog
        open={asking}
        busy={invite.rotating}
        error={failed && invite.notice ? INVITE_NOTICES[invite.notice].text : null}
        onClose={() => setAsking(false)}
        onConfirm={() => {
          void invite.rotate().then(done => done && setAsking(false))
        }}
      />
    </InviteFields>
  )
}

function LoadState({
  error,
  onRetry,
}: {
  error: keyof typeof INVITE_LOAD_ERRORS | null
  onRetry: () => void
}) {
  if (!error) return <StateMessage kind="loading">초대 링크 불러오는 중…</StateMessage>
  return (
    <div className="flex flex-col gap-3">
      <StateMessage kind="error">{INVITE_LOAD_ERRORS[error]}</StateMessage>
      <Button variant="outline" size="sm" touch className="self-start" onClick={onRetry}>
        다시 시도
      </Button>
    </div>
  )
}
