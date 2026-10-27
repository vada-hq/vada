import { useState } from 'react'
import type { ApplicantChange, RegistrationForm, RegistrationFormResponse } from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { STATUS_LABEL, STATUS_TONE } from '@/public/registration-text'
import { ApplicantList } from './ApplicantList'
import { FormLink } from './FormLink'
import { formPath } from './registration-api'
import { countLabel, periodLabel } from './registration-view'
import { useStaffPost } from './useStaffPost'

type Props = EventDialogHandlers & {
  councilId: string
  form: RegistrationForm
  changes: ReadonlyMap<string, ApplicantChange>
  onChange: (change: ApplicantChange) => void
  onLoaded: (registrationIds: string[]) => void
  onEdit: () => void
  // 멈추기·다시 받기·신청 취소로 양식 값이 바뀌었다(목록을 다시 읽는다).
  onChanged: () => void
}

// 신청 양식 카드: 이름, 기간, 신청 수/정원, 상태. 버튼은 서버가 준 actions로만 보이거나 숨는다(DEC-38).
export function FormCard({ councilId, form, changes, onChange, onLoaded, onEdit, ...rest }: Props) {
  const { onChanged, ...handlers } = rest
  const [open, setOpen] = useState(false)
  const post = useStaffPost(handlers, undefined, form.actions)

  async function setPaused(paused: boolean) {
    const path = `${formPath(councilId, form.id)}/${paused ? 'pause' : 'resume'}`
    await post.send<RegistrationFormResponse>(path)
    // 거절(마감이 지남 등)이어도 다시 읽는다. 버튼이 사라지고 거절 문구만 남는다.
    onChanged()
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <FormSummary form={form} />
      <FormActions
        form={form}
        busy={post.busy}
        open={open}
        onEdit={onEdit}
        onPause={() => void setPaused(!form.paused)}
        onToggle={() => setOpen(!open)}
      />
      {post.problem && <StateMessage kind="error">{post.problem}</StateMessage>}
      {open && (
        <div className="flex flex-col gap-4 border-t pt-4">
          <FormLink form={form} />
          <Applicants
            councilId={councilId}
            form={form}
            changes={changes}
            onChange={onChange}
            onLoaded={onLoaded}
            onCancelled={onChanged}
            {...handlers}
          />
        </div>
      )}
    </Card>
  )
}

// 이름(긴 글은 줄바꿈), 상태, 기간, 신청 수/정원.
function FormSummary({ form }: { form: RegistrationForm }) {
  return (
    <>
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 text-sm font-semibold text-gray-900 wrap-anywhere">
          {form.name}
        </h3>
        <Badge tone={STATUS_TONE[form.status]}>{STATUS_LABEL[form.status]}</Badge>
      </div>
      <p className="text-xs text-gray-500">{periodLabel(form)}</p>
      <p className="text-xs text-gray-700">{countLabel(form)}</p>
    </>
  )
}

type ActionsProps = {
  form: RegistrationForm
  busy: boolean
  open: boolean
  onEdit: () => void
  onPause: () => void
  onToggle: () => void
}

// 양식 카드의 버튼 줄. [고치기]와 [멈추기]·[다시 받기]는 그 동작이 actions에 있을 때만 보인다.
function FormActions({ form, busy, open, onEdit, onPause, onToggle }: ActionsProps) {
  const canEdit = form.actions.includes('form.update')
  const canToggle = form.actions.includes(form.paused ? 'form.resume' : 'form.pause')
  return (
    <div className="flex flex-wrap gap-2">
      {canEdit && (
        <Button variant="outline" size="sm" touch onClick={onEdit}>
          고치기
        </Button>
      )}
      {canToggle && (
        <Button variant="outline" size="sm" touch busy={busy} onClick={onPause}>
          {form.paused ? '다시 받기' : '멈추기'}
        </Button>
      )}
      <Button variant="outline" size="sm" touch aria-expanded={open} onClick={onToggle}>
        {open ? '접기' : '링크와 신청자'}
      </Button>
    </div>
  )
}

type ApplicantsProps = EventDialogHandlers &
  Pick<Props, 'councilId' | 'form' | 'changes' | 'onChange' | 'onLoaded'> & {
    onCancelled: () => void
  }

// 신청자 정보(이름, 학번, 휴대폰)는 열람 권한자에게만 보이고, 아니면 신청 수만 보인다. 열람은 기록이 남아 눌러야 읽는다.
function Applicants({ form, ...rest }: ApplicantsProps) {
  const [shown, setShown] = useState(false)
  if (!form.actions.includes('form.view_applicants')) return null
  if (!shown)
    return (
      <div className="flex flex-col items-start gap-2">
        <Button variant="outline" size="sm" touch onClick={() => setShown(true)}>
          신청자 보기
        </Button>
      </div>
    )
  return <ApplicantList formId={form.id} {...rest} />
}
