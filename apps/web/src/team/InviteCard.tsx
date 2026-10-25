import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { InviteLinkField } from '@/components/InviteLinkField'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { INVITE_LOAD_ERRORS } from '@/lib/messages'
import { inviteLink } from '../councils/invite-path'
import { RotateInviteDialog } from './RotateInviteDialog'
import { useInvite } from './useInvite'

// 초대 링크(회장단): 링크 복사와 코드 바꾸기. 바꾸면 옛 코드는 막히고 만료는 없다(바탕 spec G2). 바꾸기 전에 한 번 묻는다.
export default function InviteCard({
  councilId,
  onForbidden,
}: {
  councilId: string
  onForbidden: () => void
}) {
  const invite = useInvite(councilId, onForbidden)
  const [asking, setAsking] = useState(false)
  if (!invite.code)
    return invite.loadError ? (
      <Card className="flex flex-col gap-3 p-4">
        <StateMessage kind="error">{INVITE_LOAD_ERRORS[invite.loadError]}</StateMessage>
        <Button variant="outline" size="sm" className="self-start" onClick={invite.retry}>
          다시 시도
        </Button>
      </Card>
    ) : null
  return (
    <Card className="flex flex-col gap-3 p-4">
      <InviteLinkField
        link={inviteLink(invite.code)}
        description="단톡방에 올리면 누른 사람이 바로 운영진으로 들어와요. 잘못 들어온 사람은 내보내고 코드를 바꿔 주세요."
        notice={invite.notice}
        onCopy={link => {
          void invite.copy(link)
        }}
      >
        <Button variant="outline" size="sm" busy={invite.rotating} onClick={() => setAsking(true)}>
          <RefreshCw />
          {invite.rotating ? '바꾸는 중…' : '코드 바꾸기'}
        </Button>
      </InviteLinkField>
      <RotateInviteDialog
        open={asking}
        busy={invite.rotating}
        onClose={() => setAsking(false)}
        onConfirm={() => {
          void invite.rotate().then(() => setAsking(false))
        }}
      />
    </Card>
  )
}
