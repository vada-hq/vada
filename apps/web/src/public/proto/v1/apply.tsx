import { useRef, useState } from 'react'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { FieldErrors } from '@/lib/use-form-check'
import { applyErrors, type ApplyValues } from '../../useApply'
import type { FormProps } from '../form-props'
import { PaperField, PaperInput, PaperQuestions } from './fields'
import { CLS } from './tokens'

// 신청 화면의 칸 묶음: 종이 안에서 머리 아래 가는 선 다음에 칸이 위에서 아래로 늘어선 서류.
// [신청하기]는 마지막 칸 아래 꽉 찬 폭, 그 아래 같은 종이 안에 작은 회색 고지.

const present = (errors: FieldErrors): FieldErrors =>
  Object.fromEntries(Object.entries(errors).filter(([, message]) => message))

// 칸 이름 → 그 칸을 고치면 지울 오류 이름
const answerKey = (props: FormProps, questionId: string) => {
  const at = props.data.form.questions.findIndex(question => question.id === questionId)
  return [`answers.${at}`, `answers.${at}.text`]
}

function useApplyState(props: FormProps) {
  const [values, setValues] = useState<ApplyValues>(props.values)
  const [errors, setErrors] = useState<FieldErrors>(props.errors)
  const formRef = useRef<HTMLFormElement>(null)
  const change = (patch: Partial<ApplyValues>, keys: string[]) => {
    setValues(now => ({ ...now, ...patch }))
    setErrors(now => Object.fromEntries(Object.entries(now).filter(([key]) => !keys.includes(key))))
  }
  const submit = () => {
    const found = present(applyErrors(props.data.form, values))
    setErrors(found)
    if (Object.keys(found).length === 0) return props.onApply(values)
    requestAnimationFrame(() =>
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
    )
  }
  return { values, errors, formRef, change, submit }
}

export default function ApplySheet(props: FormProps) {
  const { form, text } = props.data
  const { values, errors, formRef, change, submit } = useApplyState(props)
  return (
    <form
      ref={formRef}
      noValidate
      aria-label="참가 신청"
      className={`${CLS.pad} flex flex-col gap-6 pt-6 pb-7 sm:pb-9`}
      onSubmit={event => {
        event.preventDefault()
        submit()
      }}
    >
      <PaperField label="이름" required error={errors.name}>
        {control => (
          <PaperInput
            {...control}
            value={values.name}
            busy={props.busy}
            autoComplete="name"
            onText={name => change({ name }, ['name'])}
          />
        )}
      </PaperField>
      {form.collectsStudentId && (
        <PaperField label="학번" required error={errors.studentId}>
          {control => (
            <PaperInput
              {...control}
              value={values.studentId}
              busy={props.busy}
              inputMode="numeric"
              onText={studentId => change({ studentId }, ['studentId'])}
            />
          )}
        </PaperField>
      )}
      {form.collectsPhone && (
        <PaperField label="휴대폰 번호" required error={errors.phone}>
          {control => (
            <PaperInput
              {...control}
              value={values.phone}
              busy={props.busy}
              inputMode="tel"
              autoComplete="tel"
              onText={phone => change({ phone }, ['phone'])}
            />
          )}
        </PaperField>
      )}
      <PaperQuestions
        questions={form.questions}
        answers={values.answers}
        busy={props.busy}
        errors={errors}
        onAnswer={(questionId, value) =>
          change(
            { answers: { ...values.answers, [questionId]: value } },
            answerKey(props, questionId),
          )
        }
      />
      <div className="flex flex-col gap-3 pt-2">
        <Button type="submit" busy={props.busy} className={CLS.primary}>
          {props.busy ? (
            <>
              <LoaderCircle aria-hidden className="animate-spin" />
              신청하는 중
            </>
          ) : (
            '신청하기'
          )}
        </Button>
        {props.problem && (
          <p role="alert" className="flex items-start gap-1.5 text-sm text-danger">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            {props.problem}
          </p>
        )}
        <p className="text-xs leading-5 break-keep text-fg-muted wrap-anywhere">{text.notice}</p>
      </div>
    </form>
  )
}
