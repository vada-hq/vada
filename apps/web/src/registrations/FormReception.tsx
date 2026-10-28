import { useState } from 'react'
import {
  registrationStatusLabel,
  type ActivateFormRequest,
  type ActivateFormResponse,
  type EventDetail,
  type FormActivationCondition,
  type RegistrationForm,
  type RegistrationFormResponse,
} from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { EventFieldFocus } from '@/events/EventFields'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { REGISTRATION_STAFF_ERRORS } from '@/lib/registration-messages'
import { FormActivation } from './FormActivation'
import { FormEventFacts } from './FormEventFacts'
import { FormLink } from './FormLink'
import { FormPreview } from './FormPreview'
import { FormSection } from './FormSection'
import { formPath } from './registration-api'
import { previewOf, valuesOfForm } from './registration-form'
import { countLabel, periodLabel } from './registration-view'
import { useStaffPost } from './useStaffPost'

type Props = EventDialogHandlers & {
  councilId: string
  councilName: string
  event: EventDetail | null
  form: RegistrationForm
  onEdit: (focus?: 'closesAt' | 'account') => void
  onEditEvent: (focus: EventFieldFocus) => void
  onChanged: () => void
}

function Recruitment({ form, onEdit }: Pick<Props, 'form' | 'onEdit'>) {
  const fee =
    form.payerFee === null
      ? '없음'
      : form.payerFee === form.nonPayerFee
        ? `${form.payerFee.toLocaleString()}원`
        : `납부자 ${form.payerFee.toLocaleString()}원 · 미납자 ${form.nonPayerFee?.toLocaleString()}원`
  return (
    <FormSection
      title="모집 설정"
      action={
        form.actions.includes('form.update') && (
          <Button variant="outline" size="sm" touch onClick={() => onEdit()}>
            고치기
          </Button>
        )
      }
    >
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {[
          ['신청 기간', periodLabel(form)],
          ['모집 방식', '선착순'],
          ['정원', form.capacity === null ? '제한 없음' : `${form.capacity.toLocaleString()}명`],
          ['참가비', fee],
          ['참가비 받을 계좌', form.feeAccount?.name ?? '계좌 없음'],
        ].map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col gap-1">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="break-keep wrap-anywhere tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {form.notice && <p className="text-sm whitespace-pre-wrap wrap-anywhere">{form.notice}</p>}
    </FormSection>
  )
}

function Collected({ form }: Pick<Props, 'form'>) {
  const fields = [
    '이름',
    ...(form.collectsStudentId ? ['학번'] : []),
    ...(form.collectsPhone ? ['휴대폰 번호'] : []),
  ]
  return (
    <FormSection title="받는 항목">
      <ol className="flex flex-col divide-y">
        {fields.map((label, index) => (
          <li key={label} className="flex min-h-11 items-center gap-3 py-3 text-sm">
            <span className="text-muted-foreground tabular-nums">{index + 1}</span>
            <span>{label}</span>
            <span className="ml-auto text-xs text-muted-foreground">필수</span>
          </li>
        ))}
      </ol>
    </FormSection>
  )
}

function useReception(props: Props) {
  const { form, event, onEdit, onEditEvent, onChanged } = props
  const [preview, setPreview] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [serverMissing, setServerMissing] = useState<{
    formKey: string
    missing: FormActivationCondition[]
  } | null>(null)
  const post = useStaffPost(props, undefined, form.actions)
  const formKey = JSON.stringify(form)
  if (serverMissing && serverMissing.formKey !== formKey) setServerMissing(null)
  const missing =
    serverMissing?.formKey === formKey ? serverMissing.missing : form.missingConditions
  const moves = {
    ...(event?.actions.includes('event.update') && {
      event_starts_at: () => onEditEvent('startsAt'),
    }),
    ...(form.actions.includes('form.update') && {
      closes_at: () => onEdit('closesAt'),
      registration_period: () => onEdit('closesAt'),
      fee_account: () => onEdit('account'),
    }),
  }
  async function activate() {
    setAttempted(true)
    if (missing.length) return
    const input: ActivateFormRequest = {}
    const result = await post.send<ActivateFormResponse>(
      `${formPath(props.councilId, form.id)}/activate`,
      input,
    )
    if (!result.ok && result.missingConditions)
      setServerMissing({ formKey, missing: result.missingConditions })
    onChanged()
  }
  async function pause() {
    await post.send<RegistrationFormResponse>(`${formPath(props.councilId, form.id)}/pause`)
    onChanged()
  }
  return { preview, setPreview, attempted, post, missing, moves, activate, pause }
}

type Reception = ReturnType<typeof useReception>

function ReceptionHeader({
  form,
  event,
  editor,
}: Pick<Props, 'form' | 'event'> & { editor: Reception }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={form.status === 'open' ? 'success' : 'neutral'}>
        {registrationStatusLabel(form.status, form.applicantCount)}
      </Badge>
      <h3 className="min-w-0 flex-1 text-base font-semibold wrap-anywhere">{form.name}</h3>
      {event && (
        <Button variant="outline" touch onClick={() => editor.setPreview(true)}>
          미리보기
        </Button>
      )}
      {(form.actions.includes('form.activate') || form.actions.includes('form.resume')) && (
        <Button touch busy={editor.post.busy} onClick={() => void editor.activate()}>
          설문 링크 활성화
        </Button>
      )}
      {form.actions.includes('form.pause') && (
        <Button variant="outline" touch busy={editor.post.busy} onClick={() => void editor.pause()}>
          멈추기
        </Button>
      )}
    </div>
  )
}

function ReceptionProblems({ editor }: { editor: Reception }) {
  if (editor.post.problem) return <StateMessage kind="error">{editor.post.problem}</StateMessage>
  return editor.attempted && editor.missing.length > 0 ? (
    <StateMessage kind="error">{REGISTRATION_STAFF_ERRORS.FORM_NOT_READY}</StateMessage>
  ) : null
}

function ReceptionPreview({ props, editor }: { props: Props; editor: Reception }) {
  if (!props.event) return null
  return (
    <Dialog open={editor.preview} onOpenChange={editor.setPreview}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>미리보기</DialogTitle>
        </DialogHeader>
        <FormPreview
          showTitle={false}
          data={previewOf(valuesOfForm(props.form), props.event, props.councilName)}
        />
      </DialogContent>
    </Dialog>
  )
}

export function FormReception(props: Props) {
  const { form, event, onEdit, onEditEvent } = props
  const editor = useReception(props)
  return (
    <section aria-label="신청 받기" className="flex min-w-0 flex-col gap-4 break-keep">
      <ReceptionHeader form={form} event={event} editor={editor} />
      <p className="text-sm text-muted-foreground tabular-nums">{countLabel(form)}</p>
      {(!form.paused || form.applicantCount > 0) && <FormLink form={form} />}
      <ReceptionProblems editor={editor} />
      {event && <FormEventFacts event={event} onEdit={onEditEvent} />}
      <Recruitment form={form} onEdit={onEdit} />
      <FormActivation missing={editor.missing} onMove={editor.moves} />
      <Collected form={form} />
      <ReceptionPreview props={props} editor={editor} />
    </section>
  )
}
