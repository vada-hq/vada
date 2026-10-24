import { useId } from 'react'
import { Copy, RefreshCw } from 'lucide-react'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { INVITE_LOAD_ERRORS, PERMISSION_CHANGED } from '@/lib/messages'
import { inviteLink } from '../councils/invite-path'
import { useInvite, type Notice } from './useInvite'

const notices: Record<Exclude<Notice, null>, { kind: 'notice' | 'error'; text: string }> = {
  copied: { kind: 'notice', text: '초대 링크를 복사했어요. 단톡방에 붙여 넣어 주세요.' },
  'copy-failed': { kind: 'error', text: '복사하지 못했어요. 링크를 직접 선택해 복사해 주세요.' },
  rotated: { kind: 'notice', text: '코드를 바꿨어요. 옛 링크로는 이제 들어올 수 없어요.' },
  failed: { kind: 'error', text: '코드를 바꾸지 못했어요. 다시 시도해 주세요.' },
  forbidden: { kind: 'error', text: PERMISSION_CHANGED },
}

// 초대 링크(회장단): 링크 복사와 코드 바꾸기. 바꾸면 옛 코드는 막히고 만료는 없다(바탕 spec G2).
export default function InviteCard({
  councilId,
  onForbidden,
}: {
  councilId: string
  onForbidden: () => void
}) {
  const invite = useInvite(councilId, onForbidden)
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
      <InviteLinkSection
        link={inviteLink(invite.code)}
        rotating={invite.rotating}
        notice={invite.notice}
        onCopy={link => {
          void invite.copy(link)
        }}
        onRotate={() => {
          void invite.rotate()
        }}
      />
    </Card>
  )
}

type SectionProps = {
  link: string
  rotating: boolean
  notice: Notice
  onCopy: (link: string) => void
  onRotate: () => void
}

function InviteLinkSection({ link, rotating, notice, onCopy, onRotate }: SectionProps) {
  const linkId = useId()
  return (
    <section aria-label="초대 링크" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor={linkId} className="text-sm font-semibold text-gray-900">
          초대 링크
        </Label>
        <p className="text-xs text-gray-500">
          단톡방에 올리면 누른 사람이 바로 운영진으로 들어와요. 잘못 들어온 사람은 내보내고 코드를
          바꿔 주세요.
        </p>
      </div>
      <Input
        id={linkId}
        readOnly
        value={link}
        className="font-mono text-base text-gray-500 sm:text-xs"
        onFocus={event => event.currentTarget.select()}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => onCopy(link)}>
          <Copy />
          링크 복사
        </Button>
        <Button variant="outline" size="sm" busy={rotating} onClick={onRotate}>
          <RefreshCw />
          {rotating ? '바꾸는 중…' : '코드 바꾸기'}
        </Button>
      </div>
      {notice && <StateMessage kind={notices[notice].kind}>{notices[notice].text}</StateMessage>}
    </section>
  )
}
