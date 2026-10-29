import { useState } from 'react'
import type {
  ActivateFormRequest,
  ActivateFormResponse,
  EventDetail,
  FormActivationCondition,
  RegistrationForm,
  RegistrationFormResponse,
} from '@vada/contracts'
import type { EventFieldFocus } from '@/events/EventFields'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { formPath } from './registration-api'
import { useStaffPost } from './useStaffPost'

export type EditorFocus = 'closesAt' | 'account'

type Props = EventDialogHandlers & {
  councilId: string
  form: RegistrationForm
  event: EventDetail | null
  onEdit: (focus?: EditorFocus) => void
  onEditEvent: (focus: EventFieldFocus) => void
  // 활성화·다시 받기·멈추기 뒤 목록을 다시 읽는다(거절이어도 버튼이 사라지고 문구만 남게).
  onChanged: () => void
}

// 양식 카드의 쓰기(활성화, 다시 받기, 멈추기)와 [채우기]가 가는 곳.
// 부족 조건은 서버가 준 것만 쓴다. 활성화가 409로 다른 조건을 돌려주면 그 양식 값이 바뀔 때까지 그것을 보인다.
export function useFormCardActions(props: Props) {
  const { form, event, onEdit, onEditEvent, onChanged } = props
  const post = useStaffPost(props, undefined, form.actions)
  const formKey = JSON.stringify(form)
  const [rejected, setRejected] = useState<{
    formKey: string
    missing: FormActivationCondition[]
  } | null>(null)
  if (rejected && rejected.formKey !== formKey) setRejected(null)
  const missing = rejected?.formKey === formKey ? rejected.missing : form.missingConditions
  // [채우기]는 그 기록의 수정 동작이 있을 때만(행사 일시는 행사의 event.update, 나머지는 양식의 form.update).
  const fills: Partial<Record<FormActivationCondition, () => void>> = {
    ...(event?.actions.includes('event.update') && {
      event_starts_at: () => onEditEvent('startsAt'),
    }),
    ...(form.actions.includes('form.update') && {
      closes_at: () => onEdit('closesAt'),
      registration_period: () => onEdit('closesAt'),
      fee_account: () => onEdit('account'),
    }),
  }
  const path = (step: string) => `${formPath(props.councilId, form.id)}/${step}`
  // 활성화와 다시 받기는 서버에서 같은 확인을 거친다(조건이 빠지면 409와 부족 조건).
  async function open(step: 'activate' | 'resume') {
    const input: ActivateFormRequest = {}
    const result = await post.send<ActivateFormResponse>(path(step), input)
    if (!result.ok && result.missingConditions)
      setRejected({ formKey, missing: result.missingConditions })
    onChanged()
  }
  async function pause() {
    await post.send<RegistrationFormResponse>(path('pause'))
    onChanged()
  }
  return {
    post,
    missing,
    fills,
    activate: () => void open('activate'),
    resume: () => void open('resume'),
    pause: () => void pause(),
  }
}

export type FormCardActions = ReturnType<typeof useFormCardActions>
