import type { FormQuestion } from '@vada/contracts'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { FieldErrors } from '@/lib/use-form-check'
import type { AnswerValues } from './answer-values'

type Props = {
  questions: FormQuestion[]
  answers: AnswerValues
  busy: boolean
  errors: FieldErrors
  onAnswer: (questionId: string, value: string | string[]) => void
}

const choiceRow = 'flex min-h-11 cursor-pointer items-center gap-2 text-sm font-normal'

// Field가 붙이는 번호와 aria 값(라벨·필수·오류 잇기). 칸이나 묶음의 바깥 요소에 그대로 준다.
type Control = {
  id?: string
  'aria-required'?: boolean
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

// 질문 하나의 입력: 짧은 답은 한 줄 칸, 하나 고르기는 세로 라디오, 여럿 고르기는 체크칸이다(GOV.UK radios·checkboxes).
function QuestionInput({
  question,
  value,
  busy,
  onAnswer,
  ...control
}: Omit<Props, 'questions' | 'answers' | 'errors'> &
  Control & {
    question: FormQuestion
    value: string | string[] | undefined
  }) {
  if (question.kind === 'short_text')
    return (
      <Input
        {...control}
        value={typeof value === 'string' ? value : ''}
        disabled={busy}
        onChange={event => onAnswer(question.id, event.target.value)}
      />
    )
  if (question.kind === 'single_choice')
    return (
      <RadioGroup
        {...control}
        aria-label={question.title}
        value={typeof value === 'string' ? value : ''}
        disabled={busy}
        onValueChange={choiceId => onAnswer(question.id, choiceId)}
      >
        {question.choices.map(choice => (
          <Label key={choice.id} className={choiceRow}>
            <RadioGroupItem value={choice.id} />
            <span className="wrap-anywhere">{choice.label}</span>
          </Label>
        ))}
      </RadioGroup>
    )
  const picked = Array.isArray(value) ? value : []
  return (
    <div {...control} role="group" aria-label={question.title} className="grid gap-2">
      {question.choices.map(choice => (
        <Label key={choice.id} className={choiceRow}>
          <input
            type="checkbox"
            className="size-4 accent-blue-600"
            checked={picked.includes(choice.id)}
            disabled={busy}
            onChange={event =>
              onAnswer(
                question.id,
                event.target.checked
                  ? [...picked, choice.id]
                  : picked.filter(id => id !== choice.id),
              )
            }
          />
          <span className="wrap-anywhere">{choice.label}</span>
        </Label>
      ))}
    </div>
  )
}

// 양식의 질문들. 필수는 별표, 아니면 '(선택)'이다. 문제는 칸 아래에 보인다.
export function QuestionFields({ questions, answers, busy, errors, onAnswer }: Props) {
  return (
    <>
      {questions.map((question, at) => (
        <Field
          key={question.id}
          label={question.title}
          required={question.required}
          optional={!question.required}
          error={errors[`answers.${at}`] ?? errors[`answers.${at}.text`]}
        >
          <QuestionInput
            question={question}
            value={answers[question.id]}
            busy={busy}
            onAnswer={onAnswer}
          />
        </Field>
      ))}
    </>
  )
}
