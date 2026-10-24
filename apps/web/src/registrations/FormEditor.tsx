import { useState } from 'react'
import {
  CreateFormSchema,
  UpdateFormSchema,
  type EventDetail,
  type RegistrationForm,
  type RegistrationFormResponse,
} from '@vada/contracts'
import { ChevronLeft } from 'lucide-react'
import StateMessage from '@/components/StateMessage'
import { Button } from '@/components/ui/button'
import type { EventFieldFocus } from '@/events/EventFields'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { useFormCheck } from '@/lib/use-form-check'
import { FeeAccountSelect, useFeeAccount } from './FeeAccountSelect'
import { FormEventFacts } from './FormEventFacts'
import { BasicFields, CollectFields, FeeFields } from './FormFields'
import { FormPreview } from './FormPreview'
import { FormSection } from './FormSection'
import { formPath, formsPath } from './registration-api'
import {
  emptyFormValues,
  formErrors,
  formRequest,
  hasFee,
  previewOf,
  valuesOfForm,
} from './registration-form'
import { useStaffPost } from './useStaffPost'

type Props = EventDialogHandlers & {
  councilId: string
  councilName: string
  // 행사를 아직 읽지 못했으면 null이다. 행사 정보와 미리보기만 빠진다.
  event: EventDetail | null
  // 있으면 고치기, 없으면 만들기
  form?: RegistrationForm
  onEditEvent: (focus: EventFieldFocus) => void
  onClose: () => void
  // 만들었거나 고친 양식. 만들었으면 부모가 링크와 QR을 바로 보인다.
  onDone: (form: RegistrationForm) => void
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

// 신청 양식 만들기·고치기 화면. 대화상자가 아니라 탭 안의 한 화면이다: 칸이 열 개 가까이 되고 학생 화면 미리보기를 옆에 두어야 한다.
// 왼쪽은 운영진이 정하는 순서의 묶음, 오른쪽(휴대폰은 아래)은 학생에게 보이는 화면이다.
// 버튼은 늘 켜 두고 누를 때 확인한다: 문제가 있으면 칸 아래에 보이고 첫 칸으로 옮긴다(GOV.UK는 버튼을 끄지 않는다).
// 보내는 동안 모든 칸과 버튼을 막는다.
export function FormEditor(props: Props) {
  const { councilId, councilName, event, form, onEditEvent, onClose, onDone, ...handlers } = props
  const mode = modeOf(councilId, form?.eventId ?? event?.id ?? '', form)
  const [values, setValues] = useState(mode.values)
  const [chosen, setChosen] = useState(mode.chosen)
  const [saving, setSaving] = useState(false)
  const account = useFeeAccount(councilId, handlers.onForbidden, chosen)
  const post = useStaffPost(handlers, setSaving)
  const request = formRequest(values, account.pick.id)
  // 참가비가 있으면 받을 계좌가 있어야 한다(서버 규칙).
  const check = useFormCheck(() => ({
    ...formErrors(values),
    account:
      hasFee(values) && account.pick.id === null ? '참가비 받을 계좌를 골라 주세요' : undefined,
  }))
  const fields = { values, disabled: saving, onChange: setValues, errors: check.errors }

  async function submit() {
    if (saving || !check.attempt()) return
    if (!mode.schema.safeParse(request).success) return
    const result = await post.send<RegistrationFormResponse>(mode.path, request)
    if (result.ok) onDone(result.data.form)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start gap-1">
        <Button variant="ghost" size="sm" className="-ml-2" disabled={saving} onClick={onClose}>
          <ChevronLeft aria-hidden />
          신청 양식 목록
        </Button>
        <h2 className="text-lg font-semibold text-gray-900">{mode.label}</h2>
      </div>
      <form
        ref={check.formRef}
        noValidate
        aria-label={mode.label}
        className="grid items-start gap-6 lg:grid-cols-5"
        onSubmit={submitEvent => {
          submitEvent.preventDefault()
          void submit()
        }}
      >
        <div className="flex flex-col gap-4 lg:col-span-3">
          {event && <FormEventFacts event={event} onEdit={onEditEvent} />}
          <FormSection title="신청 받기">
            <BasicFields {...fields} />
          </FormSection>
          <FormSection title="참가비">
            <FeeFields {...fields}>
              {hasFee(values) && (
                <FeeAccountSelect
                  account={account}
                  disabled={saving}
                  error={check.errors.account}
                  onPick={setChosen}
                />
              )}
            </FeeFields>
          </FormSection>
          <FormSection title="받는 항목">
            <CollectFields {...fields} />
          </FormSection>
          {post.problem && <StateMessage kind="error">{post.problem}</StateMessage>}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
              닫기
            </Button>
            <Button type="submit" disabled={saving}>
              {mode.submit}
            </Button>
          </div>
        </div>
        {event && (
          <div className="lg:sticky lg:top-4 lg:col-span-2">
            <FormPreview data={previewOf(values, event, councilName)} />
          </div>
        )}
      </form>
    </div>
  )
}
