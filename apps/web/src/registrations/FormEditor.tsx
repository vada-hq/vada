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
import { askLeave, useUnsavedInput } from '@/lib/leave-guard'
import { sameJson } from '@/lib/same-json'
import { useFormCheck, withContract } from '@/lib/use-form-check'
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
  // 행사를 읽기 전에도 이 행사의 양식으로 보내려고 따로 받는다.
  eventId: string
  // 행사를 아직 읽지 못했으면 null이다. 행사 정보와 미리보기만 빠진다.
  event: EventDetail | null
  // 있으면 고치기, 없으면 만들기
  form?: RegistrationForm
  // 업무 상세에서 만들면 그 업무(기능 015). 만든 양식이 업무에 이어진다. 고치기에는 보내지 않는다.
  taskId?: string
  // 맨 위 되돌아가기 버튼의 글. 기본은 양식 목록이다.
  backLabel?: string
  onEditEvent: (focus: EventFieldFocus) => void
  onClose: () => void
  // 만들었거나 고친 양식. 만들었으면 부모가 링크와 QR을 바로 보인다.
  onDone: (form: RegistrationForm) => void
}

// 만들기와 고치기가 다른 것: 처음 값, 처음 고른 계좌(undefined면 대표 계좌), 계약, 보낼 곳, 이름.
// 계좌 없이 저장된 양식(참가비 없음)을 고치다 참가비를 넣으면 만들기처럼 대표 계좌로 시작한다. 하나뿐인 계좌를 또 고르게 하지 않는다.
function modeOf(councilId: string, eventId: string, form?: RegistrationForm) {
  if (form)
    return {
      values: valuesOfForm(form),
      chosen: form.feeAccount?.id as string | null | undefined,
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

// 화면의 상태와 보내기: 값, 계좌, 보내는 중, 누를 때 확인(참가비가 있으면 받을 계좌가 있어야 한다, 서버 규칙).
// 계약이 막은 시각(행사 기간 밖 등)은 길이 문제가 아니므로 글을 따로 준다.
const FORM_CONTRACT_MESSAGES = {
  opensAt: '시각을 확인해 주세요',
  closesAt: '시각을 확인해 주세요',
}

function useFormEditor(props: Props) {
  const { councilId, eventId, form, taskId, onDone, ...rest } = props
  const handlers = { onForbidden: rest.onForbidden, onLost: rest.onLost }
  const mode = modeOf(councilId, eventId, form)
  const [values, setValues] = useState(mode.values)
  const [chosen, setChosen] = useState(mode.chosen)
  const [saving, setSaving] = useState(false)
  const account = useFeeAccount(councilId, handlers.onForbidden, chosen)
  const post = useStaffPost(handlers, setSaving)
  // 고치던 것이 남았으면 탭·메뉴·뒤로·새로고침으로 떠날 때 묻는다(떠날 때 확인). 만들기 직후나 저장 뒤에는 화면이 사라져 풀린다.
  useUnsavedInput(!sameJson(values, mode.values) || chosen !== mode.chosen)
  const request = {
    ...formRequest(values, account.pick.id),
    ...(!form && taskId ? { taskId } : {}),
  }
  const parsed = mode.schema.safeParse(request)
  const { formRef, errors, attempt } = useFormCheck(() =>
    withContract(
      {
        ...formErrors(values),
        account:
          hasFee(values) && account.pick.id === null ? '참가비 받을 계좌를 골라 주세요' : undefined,
      },
      parsed,
      FORM_CONTRACT_MESSAGES,
    ),
  )
  async function submit() {
    if (saving || !attempt() || !parsed.success) return
    const result = await post.send<RegistrationFormResponse>(mode.path, request)
    if (result.ok) onDone(result.data.form)
  }
  // 목록으로 돌아가는 닫기도 앱 안의 이동이라 남은 입력이 있으면 먼저 묻는다.
  const close = () => askLeave(props.onClose)
  return {
    mode,
    values,
    setValues,
    setChosen,
    saving,
    account,
    post,
    formRef,
    errors,
    submit,
    close,
  }
}

type Editor = ReturnType<typeof useFormEditor>

// 왼쪽 칸 묶음: 행사 정보 → 신청 받기 → 참가비 → 받는 항목, 그리고 버튼.
function EditorFields({ editor, props }: { editor: Editor; props: Props }) {
  const { values, setValues, saving, account, post, errors, mode } = editor
  const fields = { values, disabled: saving, onChange: setValues, errors }
  return (
    <div className="flex flex-col gap-4 lg:col-span-3">
      {props.event && <FormEventFacts event={props.event} onEdit={props.onEditEvent} />}
      <FormSection title="신청 받기">
        <BasicFields {...fields} />
      </FormSection>
      <FormSection title="참가비">
        <FeeFields {...fields}>
          {hasFee(values) && (
            <FeeAccountSelect
              account={account}
              disabled={saving}
              error={errors.account}
              onPick={editor.setChosen}
            />
          )}
        </FeeFields>
      </FormSection>
      <FormSection title="받는 항목">
        <CollectFields {...fields} />
      </FormSection>
      {post.problem && <StateMessage kind="error">{post.problem}</StateMessage>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" busy={saving} onClick={editor.close}>
          닫기
        </Button>
        <Button type="submit" busy={saving}>
          {mode.submit}
        </Button>
      </div>
    </div>
  )
}

// 신청 양식 만들기·고치기 화면. 대화상자가 아니라 탭 안의 한 화면이다: 칸이 열 개 가까이 되고 학생 화면 미리보기를 옆에 두어야 한다.
// 왼쪽은 운영진이 정하는 순서의 묶음, 오른쪽(휴대폰은 아래)은 학생에게 보이는 화면이다.
// 버튼은 늘 켜 두고 누를 때 확인한다: 문제가 있으면 칸 아래에 보이고 첫 칸으로 옮긴다(GOV.UK는 버튼을 끄지 않는다).
// 보내는 동안 모든 칸과 버튼을 막는다.
export function FormEditor(props: Props) {
  const editor = useFormEditor(props)
  const { mode, saving, formRef } = editor
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start gap-1">
        <Button variant="ghost" size="sm" className="-ml-2" busy={saving} onClick={editor.close}>
          <ChevronLeft aria-hidden />
          {props.backLabel ?? '신청 양식 목록'}
        </Button>
        <h2 className="text-lg font-semibold text-gray-900">{mode.label}</h2>
      </div>
      <form
        ref={formRef}
        noValidate
        aria-label={mode.label}
        className="grid items-start gap-6 lg:grid-cols-5"
        onSubmit={submitEvent => {
          submitEvent.preventDefault()
          void editor.submit()
        }}
      >
        <EditorFields editor={editor} props={props} />
        {props.event && (
          <div className="lg:sticky lg:top-4 lg:col-span-2">
            <FormPreview data={previewOf(editor.values, props.event, props.councilName)} />
          </div>
        )}
      </form>
    </div>
  )
}
