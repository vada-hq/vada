import { useState } from 'react'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import type { FormQuestion, PublicRegistrationForm } from '@vada/contracts'
import type { FieldErrors } from '@/lib/use-form-check'
import { cn } from '@/lib/utils'
import { applyErrors, type ApplyValues } from '../../useApply'
import type { FormProps } from '../form-props'
import { EventBand, Page, Sheet } from './band'
import { CheckRows, ChoiceRows, FieldRow, TextBox } from './fields'
import { color, radius, size, space, type } from './tokens'

const PHONE_HEAD = 3
const PHONE_MID_SHORT = 6
const PHONE_FULL_SHORT = 10
const PHONE_MAX = 11
const PHONE_MID_LONG = 7

// 휴대폰 칸은 치는 대로 하이픈을 넣어 보인다(보이기만, 서버는 숫자만 본다). 010-1234-5678 / 011-123-4567
function phoneText(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, PHONE_MAX)
  if (digits.length <= PHONE_HEAD) return digits
  const mid = digits.length <= PHONE_FULL_SHORT ? PHONE_MID_SHORT : PHONE_MID_LONG
  if (digits.length <= mid) return `${digits.slice(0, PHONE_HEAD)}-${digits.slice(PHONE_HEAD)}`
  return `${digits.slice(0, PHONE_HEAD)}-${digits.slice(PHONE_HEAD, mid)}-${digits.slice(mid)}`
}

const present = (errors: FieldErrors) =>
  Object.fromEntries(Object.entries(errors).filter(([, message]) => message))

type Set = (patch: Partial<ApplyValues>) => void

function Question(props: {
  question: FormQuestion
  at: number
  values: ApplyValues
  errors: FieldErrors
  busy: boolean
  set: Set
}) {
  const { question, at, values, busy } = props
  const value = values.answers[question.id]
  const answer = (next: string | string[]) =>
    props.set({ answers: { ...values.answers, [question.id]: next } })
  const error = props.errors[`answers.${at}`] ?? props.errors[`answers.${at}.text`]
  return (
    <FieldRow
      label={question.title}
      required={question.required}
      error={error}
      group={question.kind !== 'short_text'}
    >
      {wire =>
        question.kind === 'short_text' ? (
          <TextBox
            wire={wire}
            value={typeof value === 'string' ? value : ''}
            busy={busy}
            required={question.required}
            onChange={answer}
          />
        ) : question.kind === 'single_choice' ? (
          <ChoiceRows
            wire={wire}
            question={question}
            value={typeof value === 'string' ? value : ''}
            busy={busy}
            onChange={answer}
          />
        ) : (
          <CheckRows
            wire={wire}
            question={question}
            value={Array.isArray(value) ? value : []}
            busy={busy}
            onChange={answer}
          />
        )
      }
    </FieldRow>
  )
}

function BaseFields(props: {
  form: PublicRegistrationForm
  values: ApplyValues
  errors: FieldErrors
  busy: boolean
  set: Set
}) {
  const { form, values, errors, busy, set } = props
  return (
    <>
      <FieldRow label="이름" required error={errors.name}>
        {wire => (
          <TextBox
            wire={wire}
            value={values.name}
            busy={busy}
            required
            autoComplete="name"
            onChange={name => set({ name })}
          />
        )}
      </FieldRow>
      {form.collectsStudentId && (
        <FieldRow label="학번" required error={errors.studentId}>
          {wire => (
            <TextBox
              wire={wire}
              value={values.studentId}
              busy={busy}
              required
              inputMode="numeric"
              onChange={studentId => set({ studentId })}
            />
          )}
        </FieldRow>
      )}
      {form.collectsPhone && (
        <FieldRow label="휴대폰 번호" required error={errors.phone}>
          {wire => (
            <TextBox
              wire={wire}
              type="tel"
              value={values.phone}
              busy={busy}
              required
              inputMode="tel"
              autoComplete="tel"
              onChange={phone => set({ phone: phoneText(phone) })}
            />
          )}
        </FieldRow>
      )}
    </>
  )
}

function SubmitButton({ busy }: { busy: boolean }) {
  return (
    <button
      type="submit"
      disabled={busy}
      aria-busy={busy || undefined}
      className={cn(
        'mt-3 flex w-full cursor-pointer items-center justify-center gap-2 font-bold outline-none',
        'hover:bg-category-7-strong/90 focus-visible:ring-4 focus-visible:ring-category-7-strong/30 disabled:cursor-wait',
        color.event,
        color.onEvent,
        radius.control,
        size.button,
        type.body,
      )}
    >
      {busy && <LoaderCircle aria-hidden className="size-5 animate-spin" />}
      {busy ? '신청하는 중' : '신청하기'}
    </button>
  )
}

// 신청 화면: 머리 띠 → 겹친 흰 시트(운영진 안내 → 칸) → [신청하기](띠와 같은 색, 꽉 찬 폭) → 거절 글 → 고지.
export default function Apply(props: FormProps) {
  const { form, text } = props.data
  const [values, setValues] = useState(props.values)
  // 오류 견본은 누른 뒤 모습으로 연다. 한 번 누른 뒤에는 고치는 대로 다시 센다.
  const [tried, setTried] = useState(Object.keys(props.errors).length > 0)
  const errors = tried ? present(applyErrors(form, values)) : {}
  const set: Set = patch => setValues(current => ({ ...current, ...patch }))
  return (
    <Page>
      <EventBand text={text} />
      <Sheet>
        <form
          noValidate
          aria-label="참가 신청"
          className={cn('flex flex-col', space.fields)}
          onSubmit={event => {
            event.preventDefault()
            setTried(true)
            const form_ = event.currentTarget
            if (Object.keys(present(applyErrors(form, values))).length === 0) {
              props.onApply(values)
              return
            }
            requestAnimationFrame(() =>
              form_.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
            )
          }}
        >
          {form.form.notice && (
            <p
              className={cn(
                type.label,
                'rounded-xl bg-surface-subtle p-4 whitespace-pre-wrap text-fg-secondary',
              )}
            >
              {form.form.notice}
            </p>
          )}
          <BaseFields form={form} values={values} errors={errors} busy={props.busy} set={set} />
          {form.questions.map((question, at) => (
            <Question
              key={question.id}
              question={question}
              at={at}
              values={values}
              errors={errors}
              busy={props.busy}
              set={set}
            />
          ))}
          <div className="flex flex-col gap-3">
            <SubmitButton busy={props.busy} />
            {props.problem && (
              <p
                role="alert"
                className={cn(
                  type.label,
                  'flex items-start gap-2 rounded-xl border border-danger-border bg-danger-surface p-3 text-danger',
                )}
              >
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                {props.problem}
              </p>
            )}
            <p className={cn(type.small, 'break-keep text-fg-muted wrap-anywhere')}>
              {text.notice}
            </p>
          </div>
        </form>
      </Sheet>
    </Page>
  )
}
