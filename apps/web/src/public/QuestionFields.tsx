import type { FormQuestion } from '@vada/contracts'
import type { FieldErrors } from '@/lib/use-form-check'
import type { AnswerValues } from './answer-values'
import { ChoiceField } from './ChoiceField'
import { FilledField } from './FilledField'

type Props = {
  questions: FormQuestion[]
  answers: AnswerValues
  busy: boolean
  errors: FieldErrors
  onAnswer: (questionId: string, value: string | string[]) => void
}

// 양식의 질문들(운영진이 정한 차례). 짧은 답은 채운 칸, 고르기는 큰 누름 줄이다(GOV.UK radios·checkboxes).
// 필수는 별표, 아니면 '(선택)'이다. 문제는 칸 아래에 보인다.
export function QuestionFields({ questions, answers, busy, errors, onAnswer }: Props) {
  return questions.map((question, at) => {
    const value = answers[question.id]
    const error = errors[`answers.${at}`] ?? errors[`answers.${at}.text`]
    if (question.kind === 'short_text')
      return (
        <FilledField
          key={question.id}
          label={question.title}
          required={question.required}
          error={error}
          value={typeof value === 'string' ? value : ''}
          disabled={busy}
          onChange={event => onAnswer(question.id, event.target.value)}
        />
      )
    return (
      <ChoiceField
        key={question.id}
        question={question}
        value={value}
        error={error}
        disabled={busy}
        onAnswer={next => onAnswer(question.id, next)}
      />
    )
  })
}
