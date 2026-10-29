import { useEffect, useId, useState } from 'react'
import {
  CreateFormSchema,
  UpdateFormSchema,
  type EventDetail,
  type RegistrationForm,
  type RegistrationFormResponse,
} from '@vada/contracts'
import StateMessage from '@/components/StateMessage'
import type { EventFieldFocus } from '@/events/EventFields'
import type { EventDialogHandlers } from '@/events/useEventSubmit'
import { askLeave, useUnsavedInput } from '@/lib/leave-guard'
import { sameJson } from '@/lib/same-json'
import { useFormCheck, withContract } from '@/lib/use-form-check'
import { EditorHeader, EditorTitle } from './EditorHeader'
import { CollectSection } from './FormItems'
import { PhonePreview, PreviewDialog } from './FormPreview'
import { SettingRows, type FieldIds } from './FormSettings'
import { formPath, formsPath } from './registration-api'
import {
  formErrors,
  formRequest,
  hasFee,
  missingRequired,
  newFormValues,
  previewOf,
  valuesOfForm,
  type FormValues,
} from './registration-form'
import { questionErrors } from './question-draft'
import { useFeeAccount } from './useFeeAccount'
import type { EditorFocus } from './useFormCardActions'
import { useStaffPost } from './useStaffPost'

type Props = EventDialogHandlers & {
  councilId: string
  councilName: string
  // 행사를 읽기 전에도 이 행사의 양식으로 보내려고 따로 받는다.
  eventId: string
  // 행사를 아직 읽지 못했으면 null이다. 행사 줄과 미리보기만 빠진다.
  event: EventDetail | null
  // 있으면 고치기, 없으면 만들기
  form?: RegistrationForm
  // 업무 상세에서 만들면 그 업무(기능 015). 만든 양식이 업무에 이어진다. 고치기에는 보내지 않는다.
  taskId?: string
  // 맨 위 되돌아가기 버튼의 글. 기본은 양식 목록이다.
  backLabel?: string
  onEditEvent: (focus: EventFieldFocus) => void
  onClose: () => void
  onDone: (form: RegistrationForm) => void
  focus?: EditorFocus
}

// 만들기와 고치기가 다른 것: 처음 값, 처음 고른 계좌(undefined면 대표 계좌·하나뿐인 계좌), 계약, 보낼 곳, 이름.
function modeOf(props: Props) {
  const { councilId, eventId, form, event } = props
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
    values: newFormValues(event),
    chosen: undefined as string | null | undefined,
    schema: CreateFormSchema,
    path: formsPath(councilId, eventId),
    label: '신청 양식 만들기',
    submit: '만들기',
  }
}

// 계약이 막은 시각(행사 기간 밖 등)은 길이 문제가 아니므로 글을 따로 준다.
const FORM_CONTRACT_MESSAGES = {
  opensAt: '시각을 확인해 주세요',
  closesAt: '시각을 확인해 주세요',
}

// 참가비가 있으면 받을 계좌가 있어야 한다(서버 규칙). 초안은 계좌 없이 저장된다(활성화 때 묻는다).
function accountError(
  form: RegistrationForm | undefined,
  values: FormValues,
  accountId: string | null,
) {
  if (form?.paused !== false) return undefined
  return hasFee(values) && accountId === null ? '참가비 받을 계좌를 골라 주세요' : undefined
}

const isDraft = (form: RegistrationForm | undefined) =>
  !form || (form.paused && form.applicantCount === 0)

// 처음 값. 만들기 화면을 연 뒤에 행사를 읽었으면, 아직 손대지 않은 값에 행사 시작 마감을 채운다(떠날 때 묻지 않게 기준도 함께).
function useStartValues(props: Props) {
  const mode = modeOf(props)
  const [base, setBase] = useState(mode.values)
  const [values, setValues] = useState(mode.values)
  if (
    !props.form &&
    base.closesAt === '' &&
    mode.values.closesAt !== '' &&
    sameJson(values, base)
  ) {
    setBase(mode.values)
    setValues(mode.values)
  }
  return { mode, base, values, setValues }
}

function useFormEditor(props: Props) {
  const { form, taskId, onDone, onForbidden, onLost } = props
  const { mode, base, values, setValues } = useStartValues(props)
  const [chosen, setChosen] = useState(mode.chosen)
  const [saving, setSaving] = useState(false)
  const account = useFeeAccount(props.councilId, onForbidden, chosen)
  const post = useStaffPost({ onForbidden, onLost }, setSaving)
  useUnsavedInput(!sameJson(values, base) || chosen !== mode.chosen)
  const request = {
    ...formRequest(values, account.pick.id),
    ...(!form && taskId ? { taskId } : {}),
  }
  // 초안(새 양식, 신청이 없는 멈춘 양식)은 마감 없이 저장된다. 서버가 같은 조건으로 마감 비우기를 막는다(CLOSES_AT_REQUIRED).
  const draft = isDraft(form)
  const parsed = mode.schema.safeParse(request)
  const { formRef, errors, attempt } = useFormCheck(() =>
    withContract(
      {
        ...formErrors(values, draft),
        ...questionErrors(values.questions),
        account: accountError(form, values, account.pick.id),
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
  return {
    mode,
    draft,
    values,
    change: (patch: Partial<FormValues>) => setValues(current => ({ ...current, ...patch })),
    setChosen,
    saving,
    account,
    post,
    formRef,
    errors,
    submit,
    // 목록으로 돌아가는 닫기도 앱 안의 이동이라 남은 입력이 있으면 먼저 묻는다.
    close: () => askLeave(props.onClose),
  }
}

function useFieldIds(): FieldIds {
  const base = useId()
  const names = [
    'name',
    'closesAt',
    'opensAt',
    'capacity',
    'fee',
    'payerFee',
    'nonPayerFee',
    'account',
    'notice',
  ] as const
  return Object.fromEntries(names.map(name => [name, `${base}-${name}`])) as FieldIds
}

// 카드의 [채우기]로 열면 그 칸에 초점을 둔다(계좌는 목록을 읽은 뒤에 칸이 생긴다).
function useStartFocus(focus: EditorFocus | undefined, ids: FieldIds, ready: boolean) {
  useEffect(() => {
    if (!focus) return
    document.getElementById(focus === 'account' ? ids.account : ids.closesAt)?.focus()
  }, [focus, ids.account, ids.closesAt, ready])
}

// 신청 양식 만들기·고치기 화면(대표 확정 시안 '문서 한 장 모양' refined). 탭 안의 흰 종이 한 장이고 맨 위 붙는 머리줄에
// [만들기]/[저장]과 '필수 N칸 남음'이 있다. 넓으면 오른쪽에 학생 화면(확정한 신청자 화면 부품)을 늘 두고, 좁으면 [미리보기] 창이다.
// 버튼은 늘 켜 두고 누를 때 확인한다: 문제가 있으면 칸 아래에 보이고 첫 칸으로 옮긴다(GOV.UK). 보내는 동안만 막는다.
// 미리보기는 편집기 form 바깥에 둔다(학생 화면이 제 form을 가진다). 머리줄 버튼은 form 속성으로 이 form을 보낸다.
export function FormEditor(props: Props) {
  const editor = useFormEditor(props)
  const ids = useFieldIds()
  const formId = useId()
  const [previewing, setPreviewing] = useState(false)
  const { mode, draft, values, errors, account, formRef, change, setChosen, saving, post } = editor
  useStartFocus(props.focus, ids, account.accounts !== null)
  const preview = props.event && previewOf(values, props.event, props.councilName)
  return (
    <div className="@container -mx-4 flex flex-col bg-white px-4 break-keep sm:mx-0 sm:rounded-group sm:px-8 sm:ring-1 sm:ring-border-default">
      <EditorHeader
        title={mode.label}
        submit={mode.submit}
        formId={formId}
        backLabel={props.backLabel ?? '신청 양식 목록'}
        busy={saving}
        missing={missingRequired(values, account.pick.id, draft).map(field => ids[field])}
        onBack={editor.close}
        onPreview={preview ? () => setPreviewing(true) : null}
      />
      <div className="flex flex-col items-start gap-8 pt-6 sm:pt-8 @4xl:flex-row">
        <form
          id={formId}
          ref={formRef}
          noValidate
          aria-label={mode.label}
          className="flex w-full max-w-160 min-w-0 flex-1 flex-col gap-6 pb-16"
          onSubmit={event => {
            event.preventDefault()
            void editor.submit()
          }}
        >
          {/* 보내는 동안 칸을 잠근다. 보낸 뒤 고친 값은 저장되지 않고 성공하면 편집기가 닫혀 사라진다. */}
          <fieldset disabled={saving} className="contents">
            <EditorTitle
              id={ids.name}
              value={values.name}
              error={errors.name}
              onChange={name => change({ name })}
            />
            <SettingRows
              ids={ids}
              values={values}
              errors={errors}
              closesRequired={!draft}
              account={account}
              event={props.event}
              onChange={change}
              onPick={setChosen}
              onEditEvent={props.onEditEvent}
            />
            {post.problem && <StateMessage kind="error">{post.problem}</StateMessage>}
            <div className="pt-4">
              <CollectSection
                values={values}
                locked={(props.form?.applicantCount ?? 0) > 0}
                errors={errors}
                onChange={change}
              />
            </div>
          </fieldset>
        </form>
        {preview && (
          <div className="sticky top-20 hidden shrink-0 @4xl:block">
            <PhonePreview data={preview} />
          </div>
        )}
      </div>
      {preview && <PreviewDialog data={preview} open={previewing} onOpenChange={setPreviewing} />}
    </div>
  )
}
