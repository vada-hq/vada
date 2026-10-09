import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CreateIncomeSchema, INCOME_DESCRIPTION_MAX, INCOME_NOTE_MAX, INCOME_VOID_REASON_MAX, UpdateIncomeSchema, VoidIncomeSchema } from './incomes.js'
import { isStrictObject } from './input.js'

// 테스트 파일에 제어 문자를 그대로 쓰지 않는다.
const nul = String.fromCharCode(0)
const lone = String.fromCharCode(0xd800)
const emoji = '😀'
const income = { description: '2학기 학생회비', amount: 750000, receivedOn: '2026-09-15', budgetLineId: 'l1', note: '학교 지급' }

test('수입 본문: 항목·메모가 있거나 null인 본문을 받고, 앞뒤 공백을 지우며, 범위 끝 날짜와 상한 글자를 받는다', () => {
  assert.deepEqual(CreateIncomeSchema.parse({ ...income, description: ' 2학기 학생회비 ', note: ' 학교 지급 ' }), income)
  for (const body of [{ ...income, budgetLineId: null, note: null }, { ...income, receivedOn: '2000-01-01' }, { ...income, receivedOn: '2999-12-31' },
    { ...income, amount: 1 }, { ...income, amount: 2147483647 },
    { ...income, description: emoji.repeat(INCOME_DESCRIPTION_MAX), note: emoji.repeat(INCOME_NOTE_MAX) }]) {
    assert.equal(CreateIncomeSchema.safeParse(body).success, true, JSON.stringify(body).slice(0, 80))
  }
  assert.equal(UpdateIncomeSchema.safeParse({ version: 1, ...income }).success, true)
  assert.equal(VoidIncomeSchema.safeParse({ version: 3, reason: emoji.repeat(INCOME_VOID_REASON_MAX) }).success, true)
  for (const schema of [CreateIncomeSchema, UpdateIncomeSchema, VoidIncomeSchema]) assert.equal(isStrictObject(schema), true)
})

test('수입 본문: 빠진 값·빈 글·상한+1·제어 문자·잘못된 금액과 날짜·모르는 키는 거절한다', () => {
  const without = (key: keyof typeof income) => Object.fromEntries(Object.entries(income).filter(([name]) => name !== key))
  const bodies: unknown[] = [
    without('description'), without('amount'), without('receivedOn'), without('budgetLineId'), without('note'),
    { ...income, description: '' }, { ...income, description: '   ' }, { ...income, description: emoji.repeat(INCOME_DESCRIPTION_MAX + 1) },
    { ...income, description: `입금${nul}` }, { ...income, description: `입금${lone}` },
    { ...income, note: '' }, { ...income, note: ' ' }, { ...income, note: emoji.repeat(INCOME_NOTE_MAX + 1) }, { ...income, note: `메모${nul}` },
    { ...income, amount: 0 }, { ...income, amount: -1 }, { ...income, amount: 1.5 }, { ...income, amount: 2147483648 }, { ...income, amount: '1000' },
    { ...income, receivedOn: '2026-02-30' }, { ...income, receivedOn: '2026-9-1' }, { ...income, receivedOn: '1999-12-31' },
    { ...income, receivedOn: '3000-01-01' }, { ...income, receivedOn: null },
    { ...income, budgetLineId: '' }, { ...income, budgetLineId: 'l'.repeat(65) }, { ...income, budgetLineId: `l${nul}` },
    { ...income, extra: 1 },
  ]
  for (const body of bodies) assert.equal(CreateIncomeSchema.safeParse(body).success, false, JSON.stringify(body).slice(0, 80))
  for (const body of [income, { version: 0, ...income }, { version: 1.5, ...income }, { version: 1, ...income, extra: 1 }]) {
    assert.equal(UpdateIncomeSchema.safeParse(body).success, false, JSON.stringify(body).slice(0, 80))
  }
  for (const body of [{ reason: '중복' }, { version: 0, reason: '중복' }, { version: 1, reason: '  ' }, { version: 1, reason: `중복${lone}` },
    { version: 1, reason: emoji.repeat(INCOME_VOID_REASON_MAX + 1) }, { version: 1, reason: '중복', extra: 1 }]) {
    assert.equal(VoidIncomeSchema.safeParse(body).success, false, JSON.stringify(body).slice(0, 80))
  }
})
