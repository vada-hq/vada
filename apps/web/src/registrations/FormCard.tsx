import { useState } from 'react'
import type { RegistrationForm, RegistrationFormResponse } from '@vada/contracts'
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
  attendance: ReadonlyMap<string, boolean>
  onAttendance: (registrationId: string, attended: boolean) => void
  onLoaded: (registrationIds: string[]) => void
  onEdit: () => void
  // 멈추기·다시 받기·신청 취소로 양식 값이 바뀌었다(목록을 다시 읽는다).
  onChanged: () => void
}

// 신청 양식 카드: 이름, 기간, 신청 수/정원, 상태. 버튼은 서버가 준 actions로만 보이거나 숨는다(DEC-38).
export function FormCard({
  councilId,
  form,
  attendance,
  onAttendance,
  onLoaded,
  onEdit,
  ...rest
}: Props) {
  const { onChanged, ...handlers } = rest
  const [open, setOpen] = useState(false)
  const post = useStaffPost(handlers)

  async function setPaused(paused: boolean) {
    const path = `${formPath(councilId, form.id)}/${paused ? 'pause' : 'resume'}`
    const result = await post.send<RegistrationFormResponse>(path)
    if (result.ok) onChanged()
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
            attendance={attendance}
            onAttendance={onAttendance}
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

// 양식 카드의 버튼 줄. [고치기]와 [멈추기]·[다시 받기]는 관리 권한자(actions)에게만 보인다.
function FormActions({ form, busy, open, onEdit, onPause, onToggle }: ActionsProps) {
  const manage = form.actions.includes('registration.manage')
  return (
    <div className="flex flex-wrap gap-2">
      {manage && (
        <Button variant="outline" size="sm" onClick={onEdit}>
          고치기
        </Button>
      )}
      {manage && (
        <Button variant="outline" size="sm" disabled={busy} onClick={onPause}>
          {form.paused ? '다시 받기' : '멈추기'}
        </Button>
      )}
      <Button variant="outline" size="sm" aria-expanded={open} onClick={onToggle}>
        {open ? '접기' : '링크와 신청자'}
      </Button>
    </div>
  )
}

type ApplicantsProps = EventDialogHandlers &
  Pick<Props, 'councilId' | 'form' | 'attendance' | 'onAttendance' | 'onLoaded'> & {
    onCancelled: () => void
  }

// 신청자 정보(이름, 학번, 휴대폰)는 열람 권한자에게만 보이고, 아니면 신청 수만 보인다. 열람은 기록이 남아 눌러야 읽는다.
function Applicants({ form, ...rest }: ApplicantsProps) {
  const [shown, setShown] = useState(false)
  if (!form.actions.includes('registration.view_applicants'))
    return (
      <StateMessage kind="notice">
        신청자 정보는 볼 수 있는 운영진에게만 보여요. 신청은 {form.applicantCount}명이에요.
      </StateMessage>
    )
  if (!shown)
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-xs text-gray-500">신청자 정보를 열면 연 기록이 남아요.</p>
        <Button variant="outline" size="sm" onClick={() => setShown(true)}>
          신청자 보기
        </Button>
      </div>
    )
  return (
    <ApplicantList
      formId={form.id}
      canManage={form.actions.includes('registration.manage')}
      {...rest}
    />
  )
}
