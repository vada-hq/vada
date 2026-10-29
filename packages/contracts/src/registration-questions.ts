import { z } from 'zod'
import { text } from './input.js'
import { recordIdInput } from './team.js'

// 신청 양식의 질문(DEC-93, 기능 025 조각 21). 값은 DB CHECK와 같다.
// 종류는 학생회 공지에 나온 셋뿐이다(RFC-11: 장문·배율·날짜 질문 0건).
export const QUESTION_KINDS = ['short_text', 'single_choice', 'multiple_choice'] as const
export type QuestionKind = (typeof QUESTION_KINDS)[number]
export const QUESTION_KIND_LABELS: Record<QuestionKind, string> = {
  short_text: '짧은 답',
  single_choice: '하나 고르기',
  multiple_choice: '여럿 고르기',
}
// 상한의 근거(명세 025 정한 것 18): 공지 사례는 고르기 질문 1~2개(RFC-11), 기획자 표본은 6문항이라 20문항이면 넉넉하다.
// 선택지 20개는 사이즈·종목·노선·메뉴·조를 덮는다. 학과처럼 긴 목록은 짧은 답으로 받는다.
// 제목은 고지의 받는 항목에 그대로 실리므로 짧게(100자), 선택지는 한 줄(50자), 짧은 답은 한 줄 의견까지(200자)다.
export const FORM_QUESTION_MAX = 20
export const QUESTION_TITLE_MAX = 100
export const QUESTION_CHOICE_MAX = 20
export const CHOICE_LABEL_MAX = 50
export const SHORT_ANSWER_MAX = 200

const isChoiceKind = (kind: QuestionKind) => kind !== 'short_text'
const distinct = (values: string[]) => new Set(values).size === values.length
const lowered = (ids: string[]) => ids.map(id => id.toLowerCase())

// 질문 하나. 짧은 답은 선택지가 없고, 고르기는 선택지가 하나 이상이며 이름이 겹치지 않는다.
// 선택지는 객체로 받아 나중에 선택지별 정원 같은 칸을 더하기만 하면 되게 한다.
const QuestionInputSchema = z
  .strictObject({
    kind: z.enum(QUESTION_KINDS),
    title: text(QUESTION_TITLE_MAX),
    required: z.boolean(),
    choices: z
      .array(z.strictObject({ label: text(CHOICE_LABEL_MAX) }))
      .max(QUESTION_CHOICE_MAX)
      .default([]),
  })
  .refine(question =>
    isChoiceKind(question.kind) ? question.choices.length > 0 : question.choices.length === 0,
  )
  .refine(question => distinct(question.choices.map(choice => choice.label)))
// 양식의 질문 목록 전체(차례대로). 양식 만들기와 고치기가 받는다.
export const QuestionsInputSchema = z.array(QuestionInputSchema).max(FORM_QUESTION_MAX)
export type QuestionInput = z.infer<typeof QuestionInputSchema>

export interface QuestionChoice {
  id: string
  label: string
}
export interface FormQuestion {
  id: string
  kind: QuestionKind
  title: string
  required: boolean
  choices: QuestionChoice[]
}

// 신청의 답. 화면은 양식의 질문마다 하나씩 보낸다(답하지 않은 선택 질문은 null이나 빈 목록).
// 질문이 빠지거나 모르는 질문·선택지·종류에 맞지 않는 모양이면 열린 화면이 낡았다는 뜻이라 서버가 409 FORM_CHANGED를 준다.
const questionId = recordIdInput
const AnswerSchema = z.union([
  z.strictObject({ questionId, text: text(SHORT_ANSWER_MAX).nullable() }),
  z.strictObject({ questionId, choiceId: recordIdInput.nullable() }),
  z.strictObject({
    questionId,
    choiceIds: z
      .array(recordIdInput)
      .max(QUESTION_CHOICE_MAX)
      .refine(ids => distinct(lowered(ids))),
  }),
])
export type AnswerInput = z.infer<typeof AnswerSchema>
export const AnswersSchema = z
  .array(AnswerSchema)
  .max(FORM_QUESTION_MAX)
  .refine(answers => distinct(lowered(answers.map(answer => answer.questionId))))

// 보이는 답: 양식의 질문마다 하나(차례대로), 값은 짧은 답의 글이나 고른 선택지 이름들이다. 답이 없으면 빈 목록이다.
export interface ShownAnswer {
  questionId: string
  title: string
  values: string[]
}
