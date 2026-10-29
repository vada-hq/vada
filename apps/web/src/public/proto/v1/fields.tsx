import { useId, type ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'
import type { FormQuestion } from '@vada/contracts'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { AnswerValues } from '../../answer-values'
import { CLS } from './tokens'

// 종이 위 칸 부품: 이름표가 위에 있는 1px 테두리 사각 칸(r02), 고르기는 가는 선으로 나눈 줄. 오류는 칸 아래 빨간 한 줄.

// 칸이 받는 번호와 aria(이름표·필수·오류 잇기)
export type Control = {
  id: string
  'aria-labelledby': string
  'aria-required'?: boolean
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

type FieldProps = {
  label: string
  required: boolean
  error: string | undefined
  children: (control: Control) => ReactNode
}

export function PaperField({ label, required, error, children }: FieldProps) {
  const id = useId()
  const labelId = `${id}-label`
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm leading-5 font-semibold break-keep text-fg">
        <label id={labelId} htmlFor={id}>
          {label}
        </label>
        {required ? (
          <span aria-hidden className="ml-1 text-danger-emphasis">
            *
          </span>
        ) : (
          <span className="ml-1 text-xs font-normal text-fg-muted">(선택)</span>
        )}
      </p>
      {children({
        id,
        'aria-labelledby': labelId,
        ...(required && { 'aria-required': true }),
        ...(error && { 'aria-invalid': true, 'aria-describedby': errorId }),
      })}
      {error && (
        <p id={errorId} className="flex items-center gap-1.5 text-sm text-danger-emphasis">
          <CircleAlert aria-hidden className="size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

type TextProps = Control & {
  value: string
  busy: boolean
  onText: (value: string) => void
  inputMode?: 'numeric' | 'tel'
  autoComplete?: string
}

export function PaperInput({ value, busy, onText, ...rest }: TextProps) {
  return (
    <Input
      {...rest}
      className={CLS.field}
      value={value}
      disabled={busy}
      onChange={event => onText(event.target.value)}
    />
  )
}

type ChoiceProps = Control & {
  question: FormQuestion
  value: string | string[] | undefined
  busy: boolean
  onAnswer: (questionId: string, value: string | string[]) => void
}

// 하나 고르기: 세로 라디오 줄. 고른 줄은 글자가 굵어진다(색만으로 말하지 않기).
function SingleChoice({ question, value, busy, onAnswer, ...control }: ChoiceProps) {
  const picked = typeof value === 'string' ? value : ''
  return (
    <RadioGroup
      {...control}
      tabIndex={-1}
      className={`gap-0 ${CLS.choiceList}`}
      value={picked}
      disabled={busy}
      onValueChange={choiceId => onAnswer(question.id, choiceId)}
    >
      {question.choices.map(choice => (
        <label key={choice.id} className={CLS.choiceRow}>
          <RadioGroupItem
            value={choice.id}
            className="text-primary-emphasis data-[state=checked]:border-primary-emphasis"
          />
          <span className={`wrap-anywhere ${picked === choice.id ? 'font-semibold text-fg' : ''}`}>
            {choice.label}
          </span>
        </label>
      ))}
    </RadioGroup>
  )
}

// 여럿 고르기: 체크 줄(브라우저 기본 체크칸, AGENTS.md '화면')
function MultipleChoice({ question, value, busy, onAnswer, ...control }: ChoiceProps) {
  const picked = Array.isArray(value) ? value : []
  const toggle = (choiceId: string, on: boolean) =>
    onAnswer(question.id, on ? [...picked, choiceId] : picked.filter(id => id !== choiceId))
  return (
    <div {...control} role="group" tabIndex={-1} className={CLS.choiceList}>
      {question.choices.map(choice => (
        <label key={choice.id} className={CLS.choiceRow}>
          <input
            type="checkbox"
            className="size-5 accent-primary-emphasis"
            checked={picked.includes(choice.id)}
            disabled={busy}
            onChange={event => toggle(choice.id, event.target.checked)}
          />
          <span className="wrap-anywhere">{choice.label}</span>
        </label>
      ))}
    </div>
  )
}

type QuestionsProps = {
  questions: FormQuestion[]
  answers: AnswerValues
  busy: boolean
  errors: Record<string, string | undefined>
  onAnswer: (questionId: string, value: string | string[]) => void
}

// 운영진이 정한 추가 질문들. 필수는 별표, 아니면 '(선택)'.
export function PaperQuestions({ questions, answers, busy, errors, onAnswer }: QuestionsProps) {
  return questions.map((question, at) => (
    <PaperField
      key={question.id}
      label={question.title}
      required={question.required}
      error={errors[`answers.${at}`] ?? errors[`answers.${at}.text`]}
    >
      {control => {
        const value = answers[question.id]
        if (question.kind === 'short_text')
          return (
            <PaperInput
              {...control}
              value={typeof value === 'string' ? value : ''}
              busy={busy}
              onText={text => onAnswer(question.id, text)}
            />
          )
        const Choice = question.kind === 'single_choice' ? SingleChoice : MultipleChoice
        return (
          <Choice {...control} question={question} value={value} busy={busy} onAnswer={onAnswer} />
        )
      }}
    </PaperField>
  ))
}
