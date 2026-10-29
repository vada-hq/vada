import { asc, eq, inArray } from 'drizzle-orm'
import type { AnswerInput, FormQuestion, ShownAnswer } from '@vada/contracts'
import { registrationAnswer, registrationQuestionChoice } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { questionsOf } from './questions.js'

type Reader = Pick<Db, 'select'>
type AnswerRow = { questionId: string; choiceId: string | null; textValue: string | null }

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

// 답 하나를 질문의 종류에 맞춰 행들로 바꾼다. 모양이 종류와 다르거나 모르는 선택지면 열린 화면이 낡았다(409 FORM_CHANGED).
function rowsOfAnswer(question: FormQuestion, answer: AnswerInput): AnswerRow[] {
  const choiceIdOf = (id: string) => {
    const choice = question.choices.find(item => same(item.id, id))
    if (!choice) throw new ApiError('FORM_CHANGED')
    return { questionId: question.id, choiceId: choice.id, textValue: null }
  }
  if ('text' in answer && question.kind === 'short_text')
    return answer.text === null
      ? []
      : [{ questionId: question.id, choiceId: null, textValue: answer.text }]
  if ('choiceId' in answer && question.kind === 'single_choice')
    return answer.choiceId === null ? [] : [choiceIdOf(answer.choiceId)]
  if ('choiceIds' in answer && question.kind === 'multiple_choice')
    return answer.choiceIds.map(choiceIdOf)
  throw new ApiError('FORM_CHANGED')
}

// 신청의 답을 양식의 질문과 맞춰 저장할 행으로 만든다. 서버가 최종 판정이다.
// 질문마다 답이 꼭 하나 있어야 하고(빠지거나 모르는 질문이면 409 FORM_CHANGED), 필수 질문의 빈 답은 400 INVALID_INPUT이다.
export function answerRowsOf(questions: FormQuestion[], answers: AnswerInput[]): AnswerRow[] {
  if (answers.length !== questions.length) throw new ApiError('FORM_CHANGED')
  return questions.flatMap(question => {
    const answer = answers.find(item => same(item.questionId, question.id))
    if (!answer) throw new ApiError('FORM_CHANGED')
    const rows = rowsOfAnswer(question, answer)
    if (question.required && !rows.length) throw new ApiError('INVALID_INPUT')
    return rows
  })
}

export async function saveAnswers(tx: Tx, registrationId: string, rows: AnswerRow[]) {
  if (rows.length)
    await tx.insert(registrationAnswer).values(rows.map(row => ({ ...row, registrationId })))
}

// 신청들의 답을 지운다. 답은 판이 없어 행을 지우면 어디에도 남지 않는다(DEC-55).
// 취소(입금 전·후 모두: 환불 연락에는 답이 필요 없다)와 기한 비우기가 신청자 정보를 비우는 같은 거래에서 부른다.
export async function removeAnswers(tx: Pick<Db, 'delete'>, registrationIds: string[]) {
  if (registrationIds.length)
    await tx
      .delete(registrationAnswer)
      .where(inArray(registrationAnswer.registrationId, registrationIds))
}

// 신청들의 보이는 답: 그 양식의 질문마다 하나(차례대로). 짧은 답은 글, 고르기는 선택지 차례대로의 이름이다.
// 신청자 정보라 부르는 쪽이 열람 기록을 남긴 거래(운영진)나 본인 링크(신청자)에서만 부른다.
export async function shownAnswersOf(
  db: Reader,
  registrations: readonly { id: string; formId: string }[],
): Promise<Map<string, ShownAnswer[]>> {
  const result = new Map<string, ShownAnswer[]>()
  if (!registrations.length) return result
  const questions = await questionsOf(db, [...new Set(registrations.map(item => item.formId))])
  const rows = await db
    .select({
      registrationId: registrationAnswer.registrationId,
      questionId: registrationAnswer.questionId,
      textValue: registrationAnswer.textValue,
      label: registrationQuestionChoice.label,
    })
    .from(registrationAnswer)
    .leftJoin(
      registrationQuestionChoice,
      eq(registrationQuestionChoice.id, registrationAnswer.choiceId),
    )
    .where(
      inArray(
        registrationAnswer.registrationId,
        registrations.map(item => item.id),
      ),
    )
    .orderBy(asc(registrationAnswer.registrationId), asc(registrationQuestionChoice.position))
  const valuesOf = (registrationId: string, questionId: string) =>
    rows
      .filter(row => row.registrationId === registrationId && row.questionId === questionId)
      .map(row => row.textValue ?? row.label ?? '')
  for (const { id, formId } of registrations)
    result.set(
      id,
      questions.get(formId)!.map(question => ({
        questionId: question.id,
        title: question.title,
        values: valuesOf(id, question.id),
      })),
    )
  return result
}
