import { useId, type ReactNode } from 'react'
import { Copy } from 'lucide-react'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { INVITE_NOTICES, type InviteNotice } from '@/lib/messages'

type Props = {
  link: string
  // 칸 아래 짧은 안내. 없으면 두지 않는다.
  description?: string
  notice: InviteNotice | null
  onCopy: (link: string) => void
  // [링크 복사] 옆에 더 둘 버튼(코드 바꾸기).
  children?: ReactNode
}

// 초대 링크 칸과 [링크 복사]. 운영진 > 사람의 초대 링크 카드와 학생회 만들기의 초대 링크 단계가 같은 부품을 써서 이름과 복사 문구가 같다.
export function InviteLinkField({ link, description, notice, onCopy, children }: Props) {
  const linkId = useId()
  return (
    <section aria-label="초대 링크" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor={linkId} className="text-sm font-semibold text-gray-900">
          초대 링크
        </Label>
        {description && <p className="text-xs text-gray-500">{description}</p>}
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
        {children}
      </div>
      {notice && (
        <StateMessage kind={INVITE_NOTICES[notice].kind}>
          {INVITE_NOTICES[notice].text}
        </StateMessage>
      )}
    </section>
  )
}
