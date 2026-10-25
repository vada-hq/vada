import { InviteLinkField } from '@/components/InviteLinkField'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { INVITE_LOAD_ERRORS, type InviteNotice } from '@/lib/messages'
import { CreateStepHeader } from './CreateStepHeader'

type Props = {
  // 불러오기 전이면 null.
  link: string | null
  loadError: keyof typeof INVITE_LOAD_ERRORS | null
  notice: InviteNotice | null
  onCopy: (link: string) => void
  onRetry: () => void
  onHome: () => void
}

// 학생회 만들기 3/3 초대 링크: 만든 뒤라 [이전]이 없고, 건너뛰어도 된다([홈으로], 기능 020 정한 것 7).
export default function CreateInviteStep({ link, loadError, notice, ...on }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <CreateStepHeader step="초대 링크" />
      {link && <InviteLinkField link={link} notice={notice} onCopy={on.onCopy} />}
      {!link && loadError && (
        <div className="flex flex-col gap-3">
          <StateMessage kind="error">{INVITE_LOAD_ERRORS[loadError]}</StateMessage>
          <Button variant="outline" size="sm" className="self-start" onClick={on.onRetry}>
            다시 시도
          </Button>
        </div>
      )}
      {!link && !loadError && <StateMessage kind="loading">초대 링크 불러오는 중…</StateMessage>}
      <Button onClick={on.onHome}>홈으로</Button>
    </div>
  )
}
