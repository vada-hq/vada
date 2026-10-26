import type { InviteCodeResponse } from '@vada/contracts'
import { InviteFields, type InviteCopy } from '@/components/InviteFields'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { INVITE_LOAD_ERRORS, type InviteNotice } from '@/lib/messages'
import { CreateStepHeader } from './CreateStepHeader'
import { inviteLink } from './invite-path'

type Props = {
  // 불러오기 전이면 null.
  invite: InviteCodeResponse | null
  loadError: keyof typeof INVITE_LOAD_ERRORS | null
  notice: InviteNotice | null
  onCopy: (text: string, what: InviteCopy) => void
  onRetry: () => void
  onHome: () => void
}

// 학생회 만들기 3/3 초대 링크: 만든 뒤라 [이전]이 없고, 건너뛰어도 된다([홈으로], 기능 020 정한 것 7).
// 링크와 코드 칸은 조직 화면의 구성원 초대 창과 같은 부품이다.
export default function CreateInviteStep({ invite, loadError, notice, ...on }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <CreateStepHeader step="초대 링크" />
      {invite && (
        <InviteFields
          link={inviteLink(invite.code)}
          code={invite.code}
          createdAt={invite.createdAt}
          notice={notice}
          onCopy={on.onCopy}
        />
      )}
      {!invite && loadError && (
        <div className="flex flex-col gap-3">
          <StateMessage kind="error">{INVITE_LOAD_ERRORS[loadError]}</StateMessage>
          <Button variant="outline" size="sm" touch className="self-start" onClick={on.onRetry}>
            다시 시도
          </Button>
        </div>
      )}
      {!invite && !loadError && <StateMessage kind="loading">초대 링크 불러오는 중…</StateMessage>}
      <Button touch onClick={on.onHome}>
        홈으로
      </Button>
    </div>
  )
}
