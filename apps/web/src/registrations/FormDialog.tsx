import { useState } from 'react'
import {
  CreateFormSchema,
  UpdateFormSchema,
  type RegistrationForm,
  type RegistrationFormResponse,
} from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { MissingHint, missingLabels } from '@/components/ui/field'
import { EventDialogShell } from '@/events/EventDialogShell'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { FeeAccountSelect, useFeeAccount } from './FeeAccountSelect'
import { FormFields } from './FormFields'
import { formPath, formsPath } from './registration-api'
import { emptyFormValues, formRequest, hasFee, valuesOfForm } from './registration-form'
import { useStaffPost } from './useStaffPost'

type Props = EventDialogHandlers & {
  councilId: string
  eventId: string
  // 있으면 고치기, 없으면 만들기
  form?: RegistrationForm
  onClose: () => void
  onDone: () => void
}

// 만들기와 고치기가 다른 것: 처음 값, 처음 고른 계좌(undefined면 대표 계좌), 계약, 보낼 곳, 이름.
function modeOf(councilId: string, eventId: string, form?: RegistrationForm) {
  if (form)
    return {
      values: valuesOfForm(form),
      chosen: form.feeAccount?.id ?? (null as string | null | undefined),
      schema: UpdateFormSchema,
      path: formPath(councilId, form.id),
      label: '신청 양식 고치기',
      submit: '저장',
    }
  return {
    values: emptyFormValues,
    chosen: undefined as string | null | undefined,
    schema: CreateFormSchema,
    path: formsPath(councilId, eventId),
    label: '신청 양식 만들기',
    submit: '만들기',
  }
}

// 신청 양식 만들기·고치기. 계좌는 닫지 않은 계좌 가운데 대표 계좌로 채워지고, 참가비가 있을 때만 보인다.
// 버튼은 계약의 safeParse로 켜고, 보내는 동안 모든 칸과 버튼을 막는다.
export function FormDialog({ councilId, eventId, form, onClose, onDone, ...handlers }: Props) {
  const mode = modeOf(councilId, eventId, form)
  const [values, setValues] = useState(mode.values)
  const [chosen, setChosen] = useState(mode.chosen)
  const [saving, setSaving] = useState(false)
  const account = useFeeAccount(councilId, handlers.onForbidden, chosen)
  const post = useStaffPost(handlers, setSaving)
  const request = formRequest(values, account.pick.id)
  const valid = mode.schema.safeParse(request).success
  const label = mode.label

  async function submit() {
    if (!valid || saving) return
    const result = await post.send<RegistrationFormResponse>(mode.path, request)
    if (result.ok) onDone()
  }

  return (
    <EventDialogShell title={label} saving={saving} onClose={onClose}>
      <form
        aria-label={label}
        className="flex flex-col gap-4"
        onSubmit={event => {
          event.preventDefault()
          void submit()
        }}
      >
        <FormFields values={values} disabled={saving} onChange={setValues} />
        {hasFee(values) && (
          <FeeAccountSelect account={account} disabled={saving} onPick={setChosen} />
        )}
        {post.problem && <StateMessage kind="error">{post.problem}</StateMessage>}
        <DialogFooter>
          <MissingHint
            missing={missingLabels([
              ['이름', values.name],
              ['신청 마감', values.closesAt],
            ])}
          />
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
            닫기
          </Button>
          <Button type="submit" disabled={!valid || saving}>
            {mode.submit}
          </Button>
        </DialogFooter>
      </form>
    </EventDialogShell>
  )
}
