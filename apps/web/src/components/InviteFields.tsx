import { useId, type ReactNode } from 'react'
import { Copy } from 'lucide-react'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { dayTimeLabel } from '@/lib/korean-date-text'
import { INVITE_NOTICES, type InviteNotice } from '@/lib/messages'

export type InviteCopy = 'link' | 'code'

type Props = {
  link: string
  code: string
  // 코드를 만든(마지막으로 바꾼) 시각(ISO).
  createdAt: string
  notice: InviteNotice | null
  onCopy: (text: string, what: InviteCopy) => void
  // 맨 아래에 더 둘 버튼(코드 바꾸기).
  children?: ReactNode
}

// 초대 링크와 짧은 코드를 따로 보이고 따로 복사한다(와이어프레임 ORG-03C, DEC-91). 링크와 코드는 같은 값이라
// 바꾸기는 하나다(DEC-87). 조직 화면의 구성원 초대 창과 학생회 만들기의 초대 링크 단계가 같은 부품을 써서 이름과 복사 문구가 같다.
export function InviteFields({ link, code, createdAt, notice, onCopy, children }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <CopyField
        label="초대 링크"
        value={link}
        copyLabel="링크 복사"
        onCopy={() => onCopy(link, 'link')}
      />
      <CopyField
        label="초대 코드"
        value={code}
        copyLabel="코드 복사"
        mono
        onCopy={() => onCopy(code, 'code')}
      />
      <p className="text-xs text-gray-500">만든 시각 {dayTimeLabel(createdAt)}</p>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
      {notice && (
        <StateMessage kind={INVITE_NOTICES[notice].kind}>
          {INVITE_NOTICES[notice].text}
        </StateMessage>
      )}
    </div>
  )
}

type FieldProps = {
  label: string
  value: string
  copyLabel: string
  // 짧은 코드는 사람이 읽고 옮겨 적으므로 크게, 글자 사이를 띄운다.
  mono?: boolean
  onCopy: () => void
}

function CopyField({ label, value, copyLabel, mono = false, onCopy }: FieldProps) {
  const id = useId()
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-sm font-semibold text-gray-900">
        {label}
      </Label>
      <Input
        id={id}
        readOnly
        value={value}
        className={
          mono
            ? 'font-mono text-lg font-semibold tracking-widest text-gray-900'
            : 'font-mono text-base text-gray-500 sm:text-xs'
        }
        onFocus={event => event.currentTarget.select()}
      />
      <Button variant="outline" size="sm" touch className="self-start" onClick={onCopy}>
        <Copy />
        {copyLabel}
      </Button>
    </section>
  )
}
