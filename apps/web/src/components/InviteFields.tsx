import { useId, useState, type ReactNode } from 'react'
import { Copy, QrCode as QrIcon } from 'lucide-react'
import QrCode from '@/components/QrCode'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
      >
        <InviteQrButton link={link} />
      </CopyField>
      <CopyField
        label="초대 코드"
        value={code}
        copyLabel="코드 복사"
        mono
        onCopy={() => onCopy(code, 'code')}
      />
      <p className="text-xs text-fg-muted">만든 시각 {dayTimeLabel(createdAt)}</p>
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
  // 복사 버튼 옆에 더 둘 버튼(링크의 QR 보기).
  children?: ReactNode
}

function CopyField({ label, value, copyLabel, mono = false, onCopy, children }: FieldProps) {
  const id = useId()
  return (
    <section aria-label={label} className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-sm font-semibold text-fg">
        {label}
      </Label>
      <Input
        id={id}
        readOnly
        value={value}
        className={
          mono
            ? 'font-mono text-lg font-semibold tracking-widest text-fg'
            : 'font-mono text-base text-fg-muted sm:text-xs'
        }
        onFocus={event => event.currentTarget.select()}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" touch onClick={onCopy}>
          <Copy />
          {copyLabel}
        </Button>
        {children}
      </div>
    </section>
  )
}

// 대면 초대(회의실 빔·휴대폰 화면)에서 찍도록 링크와 같은 값의 QR을 창으로 크게 보인다. 링크 칸 안에 있어 링크가
// 없으면(불러오기 전·실패) 버튼도 없고, 코드를 바꾸면 새 링크를 담는다. 메신저 그룹 초대(카카오톡 오픈채팅·LINE·
// 텔레그램·WhatsApp)처럼 링크와 QR을 같이 준다.
function InviteQrButton({ link }: { link: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" size="sm" touch onClick={() => setOpen(true)}>
        <QrIcon />
        QR 보기
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent aria-describedby={undefined} className="items-center sm:max-w-xl">
          <DialogHeader className="self-stretch">
            <DialogTitle>초대 링크 QR</DialogTitle>
          </DialogHeader>
          <QrCode text={link} label="초대 링크 QR" large />
        </DialogContent>
      </Dialog>
    </>
  )
}
