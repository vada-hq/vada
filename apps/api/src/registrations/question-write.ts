import { and, count, eq, inArray, isNull, sql } from 'drizzle-orm'
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

type Placed = { question: QuestionInput; position: number }

// 질문을 정해진 차례에 넣는다. 차례는 1부터다(DB CHECK).
async function insertPlaced(tx: Tx, formId: string, placed: Placed[]) {
  if (!placed.length) return
  const rows = await tx
    .insert(registrationQuestion)
    .values(
      placed.map(({ question, position }) => ({
        formId,
        position,
        kind: question.kind,
        title: question.title,
        required: question.required,
      })),
    )
    .returning({ id: registrationQuestion.id, position: registrationQuestion.position })
  const idAt = new Map(rows.map(row => [row.position, row.id]))
  const choices = placed.flatMap(({ question, position }) =>
    question.choices.map((choice, order) => ({
      questionId: idAt.get(position)!,
      formId,
      position: order + 1,
      label: choice.label,
    })),
  )
  if (choices.length) await tx.insert(registrationQuestionChoice).values(choices)
}

// 새 질문 목록을 차례대로 넣는다.
export const insertQuestions = (tx: Tx, formId: string, input: QuestionInput[]) =>
  insertPlaced(
    tx,
    formId,
    input.map((question, at) => ({ question, position: at + 1 })),
  )

// 취소하지 않은 신청이 있거나, 어떤 신청이든 이 양식 질문에 남은 답이 있으면 질문을 바꾸지 않는다.
// 답은 취소·비우기 때 지우므로 뒤의 것은 외래 키가 막기 전에 409로 돌려주는 마지막 방어선이다.
async function isTaken(tx: Tx, formId: string) {
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

type PositionTable = typeof registrationQuestion | typeof registrationQuestionChoice
type Move = { id: string; from: number; to: number }
// 차례 칸은 UNIQUE라 둘이 자리를 바꾸면 그 사이에 밟는다. 옮길 행을 먼저 어떤 양식에도 없는 차례로 민다(질문·선택지 상한 20).
const POSITION_ASIDE = 1000

async function removeRows(tx: Tx, table: PositionTable, formId: string, ids: string[]) {
  if (ids.length)
    await tx.delete(table).where(and(eq(table.formId, formId), inArray(table.id, ids)))
}

async function moveRows(tx: Tx, table: PositionTable, formId: string, rows: Move[]) {
  const moving = rows.filter(row => row.from !== row.to)
  if (!moving.length) return
  const ids = moving.map(row => row.id)
  await tx
    .update(table)
    .set({ position: sql`${table.position} + ${POSITION_ASIDE}` })
    .where(and(eq(table.formId, formId), inArray(table.id, ids)))
  for (const { id, to } of moving)
    await tx
      .update(table)
      .set({ position: to })
      .where(and(eq(table.formId, formId), eq(table.id, id)))
}

// 남는 질문의 선택지를 맞춘다. 같은 이름이면 같은 선택지다(한 질문 안에서 이름이 겹치지 않는다, 계약).
async function syncChoices(
  tx: Tx,
  formId: string,
  question: FormQuestion,
  input: QuestionInput['choices'],
) {
  const stored = question.choices
  const fromOf = new Map(
    stored.map((choice, at) => [choice.label, { id: choice.id, from: at + 1 }]),
  )
  const wanted = new Set(input.map(choice => choice.label))
  const gone = stored.filter(choice => !wanted.has(choice.label)).map(choice => choice.id)
  await removeRows(tx, registrationQuestionChoice, formId, gone)
  const placed = input.map((choice, order) => ({
    ...choice,
    to: order + 1,
    kept: fromOf.get(choice.label),
  }))
  const moves = placed.flatMap(({ to, kept }) => (kept ? [{ ...kept, to }] : []))
  await moveRows(tx, registrationQuestionChoice, formId, moves)
  const fresh = placed.filter(choice => !choice.kept)
  if (fresh.length)
    await tx.insert(registrationQuestionChoice).values(
      fresh.map(({ label, to }) => ({
        questionId: question.id,
        formId,
        position: to,
        label,
      })),
    )
}

// 받은 질문마다 저장된 같은 질문을 찾는다(없으면 null). 종류와 제목이 같으면 같은 질문이다. 제목이 다르면 물은 것이 달라졌으니
// 답을 잇지 않는다: 열린 화면의 옛 답이 새 질문의 답으로 들어가지 않고, 고지의 받는 항목(질문 제목)이 바뀐 화면은 409로 다시 읽는다.
function matchQuestions(stored: FormQuestion[], input: QuestionInput[]) {
  const left = [...stored]
  return input.map(question => {
    const at = left.findIndex(item => item.kind === question.kind && item.title === question.title)
    return at < 0 ? null : left.splice(at, 1)[0]!
  })
}

// 안 바뀐 질문과 선택지의 번호를 남기고 바뀐 것만 고친다. 열린 신청 화면은 답을 질문·선택지 번호로 들고 있어,
// 번호가 바뀌면 안 바뀐 질문의 답까지 사라진다. 판은 그대로 없다: 질문은 기록이 아니다.
async function syncQuestions(
  tx: Tx,
  formId: string,
  stored: FormQuestion[],
  input: QuestionInput[],
) {
  const matches = matchQuestions(stored, input)
  const kept = new Set(matches)
  const gone = stored.filter(question => !kept.has(question)).map(question => question.id)
  // 선택지는 외래 키가 함께 지운다.
  await removeRows(tx, registrationQuestion, formId, gone)
  const moves = matches.flatMap((match, at) =>
    match ? [{ id: match.id, from: stored.indexOf(match) + 1, to: at + 1 }] : [],
  )
  await moveRows(tx, registrationQuestion, formId, moves)
  for (const [at, match] of matches.entries()) {
    if (!match) continue
    const question = input[at]!
    if (match.required !== question.required)
      await tx
        .update(registrationQuestion)
        .set({ required: question.required })
        .where(and(eq(registrationQuestion.formId, formId), eq(registrationQuestion.id, match.id)))
    await syncChoices(tx, formId, match, question.choices)
  }
  const fresh = input.flatMap((question, at) =>
    matches[at] ? [] : [{ question, position: at + 1 }],
  )
  await insertPlaced(tx, formId, fresh)
}

// 질문 목록을 통째로 받아 맞춘다(DEC-93). 신청이 한 명이라도 있으면 같은 목록만 받고 다르면 409 FORM_HAS_APPLICANTS다.
// 양식 행을 FOR UPDATE로 잠근 뒤 센다: 공개 신청(apply.ts)도 같은 행을 잠그고 잠근 뒤에 질문을 읽으므로,
// 신청과 질문 바꾸기가 겹쳐도 '신청 0명이라 바꿈'과 '옛 질문으로 신청'이 함께 일어나지 않는다(READ COMMITTED라 잠근 뒤의 셈은 앞 신청을 본다).
// 신청 0명이면 지워지는 질문과 선택지를 가리키는 답이 없어 잃는 것이 없다.
export async function replaceQuestions(tx: Tx, formId: string, input: QuestionInput[]) {
  await tx
    .select({ id: registrationForm.id })
    .from(registrationForm)
    .where(eq(registrationForm.id, formId))
    .for('update')
  const stored = await questionsOfForm(tx, formId)
  if (sameQuestions(stored, input)) return
  if (await isTaken(tx, formId)) throw new ApiError('FORM_HAS_APPLICANTS')
  await syncQuestions(tx, formId, stored, input)
}
