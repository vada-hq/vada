import { and, count, eq, isNull } from 'drizzle-orm'
import type { FormQuestion, QuestionInput } from '@vada/contracts'
import {
  registration,
  registrationAnswer,
  registrationForm,
  registrationQuestion,
  registrationQuestionChoice,
} from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { questionsOfForm } from './questions.js'

const sameChoices = (stored: FormQuestion['choices'], input: QuestionInput['choices']) =>
  stored.length === input.length && stored.every((choice, at) => choice.label === input[at]!.label)
const sameQuestion = (stored: FormQuestion, input: QuestionInput) =>
  stored.kind === input.kind &&
  stored.title === input.title &&
  stored.required === input.required &&
  sameChoices(stored.choices, input.choices)
// 차례까지 같은 목록인가. 같으면 번호를 바꾸지 않는다(열린 신청 화면이 낡지 않게).
const sameQuestions = (stored: FormQuestion[], input: QuestionInput[]) =>
  stored.length === input.length &&
  stored.every((question, at) => sameQuestion(question, input[at]!))

// 새 질문 목록을 차례대로 넣는다. 차례는 1부터다(DB CHECK).
export async function insertQuestions(tx: Tx, formId: string, input: QuestionInput[]) {
  if (!input.length) return
  const rows = await tx
    .insert(registrationQuestion)
    .values(
      input.map((question, at) => ({
        formId,
        position: at + 1,
        kind: question.kind,
        title: question.title,
        required: question.required,
      })),
    )
    .returning({ id: registrationQuestion.id, position: registrationQuestion.position })
  const idAt = new Map(rows.map(row => [row.position, row.id]))
  const choices = input.flatMap((question, at) =>
    question.choices.map((choice, order) => ({
      questionId: idAt.get(at + 1)!,
      formId,
      position: order + 1,
      label: choice.label,
    })),
  )
  if (choices.length) await tx.insert(registrationQuestionChoice).values(choices)
}

// 취소하지 않은 신청이 있거나, 어떤 신청이든 이 양식 질문에 남은 답이 있으면 질문을 바꾸지 않는다.
// 답은 취소·비우기 때 지우므로 뒤의 것은 외래 키가 막기 전에 409로 돌려주는 마지막 방어선이다.
export async function isTaken(tx: Tx, formId: string) {
  const [live] = await tx
    .select({ n: count() })
    .from(registration)
    .where(and(eq(registration.formId, formId), isNull(registration.cancelledAt)))
  if (live!.n > 0) return true
  const [answered] = await tx
    .select({ n: count() })
    .from(registrationAnswer)
    .innerJoin(registrationQuestion, eq(registrationQuestion.id, registrationAnswer.questionId))
    .where(eq(registrationQuestion.formId, formId))
  return answered!.n > 0
}

// 공개 신청(apply.ts)과 줄을 세운다. 신청에 따라 잠기는 칸(질문, 참가비)은 이 잠금 뒤에 센다.
export async function lockFormRow(tx: Tx, formId: string) {
  await tx
    .select({ id: registrationForm.id })
    .from(registrationForm)
    .where(eq(registrationForm.id, formId))
    .for('update')
}

// 질문 목록을 통째로 바꾼다(DEC-93). 신청이 한 명이라도 있으면 같은 목록만 받고 다르면 409 FORM_HAS_APPLICANTS다.
// 목록이 실제로 바뀌었는지 돌려준다(질문은 판이 없어 부르는 쪽이 양식의 판을 올린다).
// 양식 행을 FOR UPDATE로 잠근 뒤 센다: 공개 신청(apply.ts)도 같은 행을 잠그고 잠근 뒤에 질문을 읽으므로,
// 신청과 질문 바꾸기가 겹쳐도 '신청 0명이라 바꿈'과 '옛 질문으로 신청'이 함께 일어나지 않는다(READ COMMITTED라 잠근 뒤의 셈은 앞 신청을 본다).
// 신청 0명이면 질문과 선택지를 지우고 다시 넣는다. 가리키는 답이 없어 잃는 것이 없다.
export async function replaceQuestions(tx: Tx, formId: string, input: QuestionInput[]) {
  await lockFormRow(tx, formId)
  if (sameQuestions(await questionsOfForm(tx, formId), input)) return false
  if (await isTaken(tx, formId)) throw new ApiError('FORM_HAS_APPLICANTS')
  await tx.delete(registrationQuestionChoice).where(eq(registrationQuestionChoice.formId, formId))
  await tx.delete(registrationQuestion).where(eq(registrationQuestion.formId, formId))
  await insertQuestions(tx, formId, input)
  return true
}
