import { useId, type ComponentProps, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import type { FormQuestion } from '@vada/contracts'
import { radius, size, space, type } from './tokens'

// 이름표 줄: 이름표 15px 굵게, 필수는 빨간 별표, 선택은 '(선택)'. 칸 위에 둔다(NN/g placeholder).
function LabelRow({
  htmlFor,
  label,
  required,
  as = 'label',
}: {
  htmlFor?: string
  label: string
  required: boolean
  as?: 'label' | 'legend'
}) {
  const Tag = as
  return (
    <Tag
      htmlFor={as === 'label' ? htmlFor : undefined}
      className={`${type.label} font-semibold text-fg-secondary wrap-anywhere`}
    >
      {label}
      {required ? (
        <span aria-hidden="true" className="ml-0.5 text-danger-emphasis">
          *
        </span>
      ) : (
        <span className="ml-1 font-normal text-fg-muted">(선택)</span>
      )}
    </Tag>
  )
}

function ErrorLine({ id, error }: { id: string; error: string | undefined }) {
  if (!error) return null
  return (
    <p id={id} className={`${type.label} font-medium text-danger`}>
      {error}
    </p>
  )
}

// 회색 채운 칸(테두리 없음, 높이 56px, 글자 17px). 초점이면 흰 면 + 파란 고리, 틀리면 빨간 고리.
const FILLED =
  'w-full min-w-0 appearance-none rounded-[14px] bg-surface-muted px-4 text-[17px] leading-6 text-fg-body outline-none ring-inset transition-colors focus:bg-white focus:ring-2 focus:ring-primary-emphasis aria-invalid:ring-2 aria-invalid:ring-danger-emphasis disabled:text-fg-muted'

export function FilledField({
  label,
  required,
  error,
  ...input
}: { label: string; required: boolean; error: string | undefined } & ComponentProps<'input'>) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className={`flex flex-col ${space.labelGap}`}>
      <LabelRow htmlFor={id} label={label} required={required} />
      <input
        id={id}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`${FILLED} ${size.control}`}
        {...input}
      />
      <ErrorLine id={errorId} error={error} />
    </div>
  )
}

// 짧은 선택지(4개 이하, 모두 3자 이하: S/M/L/XL)는 한 줄 타일, 아니면 세로 줄.
const TILE_MAX_CHOICES = 4
const TILE_MAX_LABEL = 3
const asTiles = (question: FormQuestion) =>
  question.kind === 'single_choice' &&
  question.choices.length <= TILE_MAX_CHOICES &&
  question.choices.every(choice => choice.label.length <= TILE_MAX_LABEL)

const CHOICE_BASE = `relative flex cursor-pointer items-center gap-3 ${size.control} ${radius.control} px-4 ${type.body} transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-emphasis`
const CHOICE_OFF = 'bg-surface-muted text-fg-body active:bg-muted-strong'
const CHOICE_ON = 'bg-primary-surface font-semibold text-primary-strong ring-2 ring-inset ring-primary-border-selected'

// 여럿 고르기는 늘 네모 표시가 있고(여럿 됨을 알림), 하나 고르기는 고른 줄에만 체크가 붙는다(r07).
function Mark({ on, multiple }: { on: boolean; multiple: boolean }) {
  if (multiple)
    return (
      <span
        aria-hidden="true"
        className={`flex size-6 shrink-0 items-center justify-center rounded-md ${on ? 'bg-primary-emphasis text-white' : 'bg-white text-transparent ring-1 ring-border-strong ring-inset'}`}
      >
        <Check className="size-4" strokeWidth={3} />
      </span>
    )
  return on ? (
    <Check aria-hidden="true" className="ml-auto size-6 shrink-0 text-primary-emphasis" strokeWidth={3} />
  ) : null
}

function ChoiceRow({
  name,
  label,
  on,
  multiple,
  tile,
  disabled,
  onPick,
}: {
  name: string
  label: string
  on: boolean
  multiple: boolean
  tile: boolean
  disabled: boolean
  onPick: (on: boolean) => void
}) {
  return (
    <label className={`${CHOICE_BASE} ${on ? CHOICE_ON : CHOICE_OFF} ${tile ? 'justify-center' : ''}`}>
      <input
        type={multiple ? 'checkbox' : 'radio'}
        name={name}
        checked={on}
        disabled={disabled}
        className="sr-only"
        onChange={event => onPick(event.target.checked)}
      />
      {multiple && <Mark on={on} multiple />}
      <span className={`wrap-anywhere ${tile ? 'text-center' : 'min-w-0 flex-1'}`}>{label}</span>
      {!multiple && !tile && <Mark on={on} multiple={false} />}
    </label>
  )
}

// 고르기 질문 하나: 이름표(legend) + 큰 누름 줄들 + 그 아래 오류.
export function ChoiceField({
  question,
  value,
  error,
  disabled,
  onAnswer,
}: {
  question: FormQuestion
  value: string | string[] | undefined
  error: string | undefined
  disabled: boolean
  onAnswer: (value: string | string[]) => void
}) {
  const id = useId()
  const multiple = question.kind === 'multiple_choice'
  const tile = asTiles(question)
  const picked = Array.isArray(value) ? value : value ? [value] : []
  const pick = (choiceId: string, on: boolean) => {
    if (!multiple) return onAnswer(choiceId)
    onAnswer(on ? [...picked, choiceId] : picked.filter(item => item !== choiceId))
  }
  return (
    <fieldset
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      tabIndex={-1}
      className={`flex min-w-0 flex-col ${space.labelGap} outline-none`}
    >
      <LabelRow as="legend" label={question.title} required={question.required} />
      <div className={tile ? `mt-2 grid grid-cols-4 ${space.choices}` : `mt-2 flex flex-col ${space.choices}`}>
        {question.choices.map(choice => (
          <ChoiceRow
            key={choice.id}
            name={question.id}
            label={choice.label}
            on={picked.includes(choice.id)}
            multiple={multiple}
            tile={tile}
            disabled={disabled}
            onPick={on => pick(choice.id, on)}
          />
        ))}
      </div>
      <ErrorLine id={`${id}-error`} error={error} />
    </fieldset>
  )
}

// 휴대폰 번호를 보이기만 하이픈으로 나눈다(서버는 숫자만 본다, GOV.UK telephone numbers).
const PHONE_DIGITS = 11
const HEAD = 3
const MIDDLE_LONG = 4
const MIDDLE_SHORT = 3
export function phoneView(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, PHONE_DIGITS)
  if (digits.length <= HEAD) return digits
  const middle = digits.length < PHONE_DIGITS ? MIDDLE_SHORT : MIDDLE_LONG
  const cut = HEAD + middle
  if (digits.length <= cut) return `${digits.slice(0, HEAD)}-${digits.slice(HEAD)}`
  return `${digits.slice(0, HEAD)}-${digits.slice(HEAD, cut)}-${digits.slice(cut)}`
}

export function FieldStack({ children }: { children: ReactNode }) {
  return <div className={`flex flex-col ${space.fields}`}>{children}</div>
}
