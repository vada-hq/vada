import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isStrictObject } from './input.js'
import { ConfirmRetrospectiveSchema, dDayOf, GenerateRetrospectiveSchema, RETRO_ANSWER_MAX, RETRO_ITEMS_MAX, RETRO_QUESTIONS_MAX, RETRO_TEXT_MAX,
  SaveRetrospectiveSchema } from './reports.js'

// 테스트 파일에 제어 문자를 그대로 쓰지 않는다.
const nul = String.fromCharCode(0)
const lone = String.fromCharCode(0xd800)
const emoji = '😀'
type Schema = { safeParse: (value: unknown) => { success: boolean } }
const accepts = (schema: Schema, values: unknown[]) => {
  for (const value of values) assert.equal(schema.safeParse(value).success, true, JSON.stringify(value))
}
const rejects = (schema: Schema, values: unknown[]) => {
  for (const value of values) assert.equal(schema.safeParse(value).success, false, JSON.stringify(value))
}
const save = { version: 1, wentWell: [{ id: 'a', text: '조를 미리 정했다' }], shortfalls: [], nextTime: [{ id: null, text: '물은 1인 1병' }],
  questions: [{ id: 'q', answer: null }] }
const many = (count: number) => Array.from({ length: count }, () => ({ id: null, text: '가' }))
const asked = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `q${index}`, answer: null }))

test('회고 저장: 문장은 200자, 답은 300자, 섹션마다 10문장, 확인 필요는 3개까지다', () => {
  for (const schema of [GenerateRetrospectiveSchema, SaveRetrospectiveSchema, ConfirmRetrospectiveSchema]) assert.equal(isStrictObject(schema), true)
  accepts(SaveRetrospectiveSchema, [save, { ...save, wentWell: [{ id: null, text: emoji.repeat(RETRO_TEXT_MAX) }] },
    { ...save, questions: [{ id: 'q', answer: emoji.repeat(RETRO_ANSWER_MAX) }] }, { ...save, shortfalls: many(RETRO_ITEMS_MAX) },
    { ...save, questions: asked(RETRO_QUESTIONS_MAX) }, { ...save, wentWell: [], nextTime: [], questions: [] }])
  rejects(SaveRetrospectiveSchema, [
    { ...save, version: 0 }, { ...save, version: 1.5 }, { ...save, version: '1' }, { ...save, version: -1 },
    { ...save, wentWell: [{ id: null, text: '' }] }, { ...save, wentWell: [{ id: null, text: ' \n\t ' }] },
    { ...save, wentWell: [{ id: null, text: emoji.repeat(RETRO_TEXT_MAX + 1) }] },
    { ...save, wentWell: [{ id: null, text: `가${nul}` }] }, { ...save, wentWell: [{ id: null, text: `가${lone}` }] },
    { ...save, questions: [{ id: 'q', answer: emoji.repeat(RETRO_ANSWER_MAX + 1) }] }, { ...save, questions: [{ id: 'q', answer: '  ' }] },
    { ...save, shortfalls: many(RETRO_ITEMS_MAX + 1) }, { ...save, questions: asked(RETRO_QUESTIONS_MAX + 1) },
    { ...save, wentWell: [{ id: '', text: '가' }] }, { ...save, wentWell: [{ text: '가' }] }, { ...save, questions: [{ id: 'q' }] },
    { ...save, wentWell: [{ id: null, text: '가', sources: [] }] }, { ...save, extra: true },
    Object.fromEntries(Object.entries(save).filter(([key]) => key !== 'nextTime')),
  ])
  accepts(GenerateRetrospectiveSchema, [{ version: 0 }, { version: 3 }])
  rejects(GenerateRetrospectiveSchema, [{ version: -1 }, { version: 0.5 }, { version: '0' }, {}, { version: 0, extra: 1 }])
  accepts(ConfirmRetrospectiveSchema, [{ version: 1 }])
  rejects(ConfirmRetrospectiveSchema, [{ version: 0 }, { version: '1' }, { version: 1, extra: 1 }])
})

test('준비 과정 날짜는 행사 시작일 기준 D-n이다', () => {
  assert.equal(dDayOf('2026-02-14', '2026-03-06'), 'D-20')
  assert.equal(dDayOf('2026-03-06', '2026-03-06'), 'D-day')
  assert.equal(dDayOf('2026-03-09', '2026-03-06'), 'D+3')
  assert.equal(dDayOf('2026-04-01', '2026-03-01'), 'D+31')
})
