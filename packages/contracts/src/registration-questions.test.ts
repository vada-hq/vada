import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { AnswersSchema, QuestionsInputSchema } from './registration-questions.js'
import { ApplySchema, CreateFormSchema, UpdateFormSchema } from './registrations.js'

const FORM = { name: '신청', closesAt: '2026-11-01T18:00' }
const short = { kind: 'short_text', title: '이니셜', required: true }

test('질문은 짧은 답에 선택지가 없고 고르기에는 겹치지 않는 선택지가 하나 이상 있다', () => {
  assert.deepEqual(QuestionsInputSchema.parse([short]), [{ ...short, choices: [] }])
  const choice = { kind: 'single_choice', title: '사이즈', required: false }
  assert.equal(
    QuestionsInputSchema.safeParse([{ ...choice, choices: [{ label: 'S' }] }]).success,
    true,
  )
  for (const bad of [
    [{ ...choice, choices: [] }],
    [{ ...short, choices: [{ label: 'S' }] }],
    [{ ...choice, choices: [{ label: 'S' }, { label: 'S' }] }],
    [{ ...choice, choices: [{ label: 'S', capacity: 3 }] }],
  ])
    assert.equal(QuestionsInputSchema.safeParse(bad).success, false, JSON.stringify(bad))
})

test('양식 만들기는 질문을 빼면 빈 목록이고 고치기는 빼면 그대로 둔다', () => {
  assert.deepEqual(CreateFormSchema.parse(FORM).questions, [])
  const update = {
    ...FORM,
    opensAt: null,
    capacity: null,
    notice: null,
    collectsPhone: false,
    collectsStudentId: true,
    payerFee: null,
    nonPayerFee: null,
    feeAccountId: null,
    baseVersionNo: 1,
  }
  assert.equal(UpdateFormSchema.parse(update).questions, undefined)
  assert.equal(UpdateFormSchema.parse({ ...update, questions: [short] }).questions?.length, 1)
})

test('답은 질문마다 하나이고 모양은 글, 선택지 하나, 선택지 목록 가운데 하나다', () => {
  const questionId = randomUUID()
  const choiceId = randomUUID()
  assert.deepEqual(ApplySchema.parse({ commandId: randomUUID(), name: '김' }).answers, [])
  for (const answer of [
    { questionId, text: 'KHS' },
    { questionId, text: null },
    { questionId, choiceId },
    { questionId, choiceId: null },
    { questionId, choiceIds: [] },
    { questionId, choiceIds: [choiceId] },
  ])
    assert.equal(AnswersSchema.safeParse([answer]).success, true, JSON.stringify(answer))
  for (const bad of [
    [{ questionId, text: '  ' }],
    [{ questionId, text: 'a', choiceId }],
    [{ questionId, choiceIds: [choiceId, choiceId.toUpperCase()] }],
    [
      { questionId, text: 'a' },
      { questionId: questionId.toUpperCase(), text: 'b' },
    ],
    [{ questionId }],
  ])
    assert.equal(AnswersSchema.safeParse(bad).success, false, JSON.stringify(bad))
})
