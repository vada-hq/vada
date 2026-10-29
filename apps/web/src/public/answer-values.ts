import type { AnswerInput, FormQuestion } from '@vada/contracts'
import type { FieldErrors } from '@/lib/use-form-check'

// 질문 번호 → 화면의 답(짧은 답과 하나 고르기는 글, 여럿 고르기는 고른 선택지 번호들)
export type AnswerValues = Record<string, string | string[]>

const textOf = (value: string | string[] | undefined) => (typeof value === 'string' ? value : '')
const listOf = (value: string | string[] | undefined) => (Array.isArray(value) ? value : [])

// 보낼 답: 질문마다 하나(답하지 않은 선택 질문은 null이나 빈 목록). 서버가 질문이 빠지면 409로 본다.
export function answersRequest(questions: FormQuestion[], values: AnswerValues): AnswerInput[] {
  return questions.map(question => {
    const value = values[question.id]
    if (question.kind === 'short_text')
      return { questionId: question.id, text: textOf(value).trim() || null }
    if (question.kind === 'single_choice')
      return { questionId: question.id, choiceId: textOf(value) || null }
    return { questionId: question.id, choiceIds: listOf(value) }
  })
}

const EMPTY_MESSAGE = {
  short_text: '답을 입력해 주세요',
  single_choice: '하나를 골라 주세요',
  multiple_choice: '하나 이상 골라 주세요',
} as const

// 필수 질문이 비었을 때의 문제. 칸 이름은 계약 경로(answers.차례)와 같다.
export function answerErrors(questions: FormQuestion[], values: AnswerValues): FieldErrors {
  const errors: FieldErrors = {}
  questions.forEach((question, at) => {
    const value = values[question.id]
    const empty = Array.isArray(value) ? value.length === 0 : textOf(value).trim() === ''
    if (question.required && empty) errors[`answers.${at}`] = EMPTY_MESSAGE[question.kind]
  })
  return errors
}
