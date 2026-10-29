import { useEffect, useRef, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import type { PublicRegistrationForm } from '@vada/contracts'
import type { FieldErrors } from '@/lib/use-form-check'
import { applyErrors, type ApplyValues } from '../../useApply'
import type { FormProps } from '../form-props'
import { ChoiceField, FieldStack, FilledField, phoneView } from './fields'
import { BigButton, BottomBar, EventHead, Page } from './parts'
import { type } from './tokens'

type Set = (patch: Partial<ApplyValues>, key: string) => void

// 질문들: 짧은 답은 채운 칸, 고르기는 큰 누름 줄. 운영진이 정한 차례 그대로.
function Questions({
  form,
  values,
  errors,
  busy,
  set,
}: {
  form: PublicRegistrationForm
  values: ApplyValues
  errors: FieldErrors
  busy: boolean
  set: Set
}) {
  const answer = (questionId: string, value: string | string[], key: string) =>
    set({ answers: { ...values.answers, [questionId]: value } }, key)
  return form.questions.map((question, at) => {
    const key = `answers.${at}`
    const value = values.answers[question.id]
    const error = errors[key] ?? errors[`${key}.text`]
    if (question.kind === 'short_text')
      return (
        <FilledField
          key={question.id}
          label={question.title}
          required={question.required}
          error={error}
          value={typeof value === 'string' ? value : ''}
          disabled={busy}
          onChange={event => answer(question.id, event.target.value, key)}
        />
      )
    return (
      <ChoiceField
        key={question.id}
        question={question}
        value={value}
        error={error}
        disabled={busy}
        onAnswer={next => answer(question.id, next, key)}
      />
    )
  })
}

// 이름 → 학번(숫자 키패드) → 휴대폰(전화 키패드, 보이기만 하이픈). 받는 칸만 그린다(DEC-67·75).
function BasicFields({
  form,
  values,
  errors,
  busy,
  set,
}: {
  form: PublicRegistrationForm
  values: ApplyValues
  errors: FieldErrors
  busy: boolean
  set: Set
}) {
  return (
    <>
      <FilledField
        label="이름"
        required
        error={errors.name}
        value={values.name}
        disabled={busy}
        autoComplete="name"
        onChange={event => set({ name: event.target.value }, 'name')}
      />
      {form.collectsStudentId && (
        <FilledField
          label="학번"
          required
          error={errors.studentId}
          value={values.studentId}
          disabled={busy}
          inputMode="numeric"
          onChange={event => set({ studentId: event.target.value }, 'studentId')}
        />
      )}
      {form.collectsPhone && (
        <FilledField
          label="휴대폰 번호"
          required
          error={errors.phone}
          value={phoneView(values.phone)}
          disabled={busy}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          onChange={event => set({ phone: phoneView(event.target.value) }, 'phone')}
        />
      )}
    </>
  )
}

// 칸 상태: 처음 오류(견본)로 시작, 고친 칸의 오류는 지우고, 누를 때 다시 확인해 첫 틀린 칸으로 옮긴다.
function useApplyForm(props: FormProps) {
  const form = props.data.form
  const [values, setValues] = useState(props.values)
  const [errors, setErrors] = useState<FieldErrors>(props.errors)
  const [tries, setTries] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (tries) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [tries])
  const set: Set = (patch, key) => {
    setValues(current => ({ ...current, ...patch }))
    setErrors(current => ({ ...current, [key]: undefined, [`${key}.text`]: undefined }))
  }
  const submit = () => {
    const found = applyErrors(form, values)
    const has = Object.values(found).some(Boolean)
    setErrors(found)
    setTries(count => count + 1)
    if (!has) props.onApply(values)
  }
  return { formRef, values, errors, set, submit }
}

export default function ApplyScreen(props: FormProps) {
  const { data, busy, problem } = props
  const { formRef, values, errors, set, submit } = useApplyForm(props)
  return (
    <Page>
      <EventHead text={data.text} />
      <form
        ref={formRef}
        noValidate
        aria-label="참가 신청"
        className="mt-10 flex flex-1 flex-col"
        onSubmit={event => {
          event.preventDefault()
          submit()
        }}
      >
        <FieldStack>
          <BasicFields form={data.form} values={values} errors={errors} busy={busy} set={set} />
          <Questions form={data.form} values={values} errors={errors} busy={busy} set={set} />
        </FieldStack>
        <div className="mt-8" />
        <BottomBar>
          {problem && (
            <p role="alert" className={`flex items-start gap-1.5 ${type.label} font-medium text-danger`}>
              <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {problem}
            </p>
          )}
          <BigButton submit busy={busy} busyLabel="신청하는 중">
            신청하기
          </BigButton>
        </BottomBar>
        {/* ③ 고지: 버튼 아래 작은 회색 글. 문구는 바꾸지 않는다(DEC-62). */}
        <p className={`pt-1 pb-10 ${type.small} text-fg-muted wrap-anywhere`}>{data.text.notice}</p>
      </form>
    </Page>
  )
}
