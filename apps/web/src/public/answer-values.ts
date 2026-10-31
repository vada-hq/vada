import type { AnswerInput, FormQuestion } from '@vada/contracts'
import type { FieldErrors } from '@/lib/use-form-check'

// 질문 번호 → 화면의 답(짧은 답과 하나 고르기는 글, 여럿 고르기는 고른 선택지 번호들)
export type AnswerValues = Record<string, string | string[]>

type Answer = AnswerValues[string] | undefined

const textOf = (value: Answer) => (typeof value === 'string' ? value : '')
const listOf = (value: Answer) => (Array.isArray(value) ? value : [])

// 지금 양식에 있는 답만 남긴다. 운영진이 선택지를 빼도 질문 번호는 남아 값이 없는 선택지를 가리킬 수 있다.
// 그대로 보내면 서버가 409로 거절하고, 다시 읽어도 값이 같아 신청이 끝나지 않는다.
function liveAnswer(question: FormQuestion, value: Answer): Answer {
  if (question.kind === 'short_text') return value
  const live = (id: string) => question.choices.some(choice => choice.id === id)
  if (Array.isArray(value)) return value.filter(live)
  return value !== undefined && live(value) ? value : undefined
}

// 보낼 답: 질문마다 하나(답하지 않은 선택 질문은 null이나 빈 목록). 서버가 질문이 빠지면 409로 본다.
export function answersRequest(questions: FormQuestion[], values: AnswerValues): AnswerInput[] {
  return questions.map(question => {
    const value = liveAnswer(question, values[question.id])
    if (question.kind === 'short_text')
      return { questionId: question.id, text: textOf(value).trim() || null }
    if (question.kind === 'single_choice')
      return { questionId: question.id, choiceId: textOf(value) || null }
    // 고른 차례가 아니라 선택지 차례로 보낸다. 같은 답이면 본문이 같아 재전송이 같은 신청이 된다.
    const picked = listOf(value)
    return {
      questionId: question.id,
      choiceIds: question.choices.map(choice => choice.id).filter(id => picked.includes(id)),
    }
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
    const value = liveAnswer(question, values[question.id])
    const empty = Array.isArray(value) ? value.length === 0 : textOf(value).trim() === ''
    if (question.required && empty) errors[`answers.${at}`] = EMPTY_MESSAGE[question.kind]
  })
  return errors
}
