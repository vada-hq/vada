import { asc, inArray } from 'drizzle-orm'
import type { FormQuestion, QuestionKind } from '@vada/contracts'
import { registrationQuestion, registrationQuestionChoice } from '../db/schema.js'
import type { Db } from '../db/types.js'

type Reader = Pick<Db, 'select'>

// 양식들의 질문(차례대로)과 선택지(차례대로). 질문이 없는 양식도 빈 목록으로 들어 있다.
// 학생회 경계는 부르는 쪽이 이미 건 양식 번호로 지킨다(이 학생회 양식만 넘긴다).
export async function questionsOf(
  db: Reader,
  formIds: readonly string[],
): Promise<Map<string, FormQuestion[]>> {
  const result = new Map<string, FormQuestion[]>(formIds.map(id => [id, []]))
  if (!formIds.length) return result
  const questions = await db
    .select({
      id: registrationQuestion.id,
      formId: registrationQuestion.formId,
      kind: registrationQuestion.kind,
      title: registrationQuestion.title,
      required: registrationQuestion.required,
    })
    .from(registrationQuestion)
    .where(inArray(registrationQuestion.formId, [...formIds]))
    .orderBy(asc(registrationQuestion.formId), asc(registrationQuestion.position))
  const choices = await db
    .select({
      id: registrationQuestionChoice.id,
      questionId: registrationQuestionChoice.questionId,
      label: registrationQuestionChoice.label,
    })
    .from(registrationQuestionChoice)
    .where(inArray(registrationQuestionChoice.formId, [...formIds]))
    .orderBy(asc(registrationQuestionChoice.questionId), asc(registrationQuestionChoice.position))
  const byQuestion = new Map<string, FormQuestion['choices']>()
  for (const choice of choices) {
    const list = byQuestion.get(choice.questionId) ?? []
    list.push({ id: choice.id, label: choice.label })
    byQuestion.set(choice.questionId, list)
  }
  for (const { formId, kind, ...question } of questions)
    result.get(formId)!.push({
      ...question,
      kind: kind as QuestionKind,
      choices: byQuestion.get(question.id) ?? [],
    })
  return result
}

export const questionsOfForm = async (db: Reader, formId: string) =>
  (await questionsOf(db, [formId])).get(formId)!
