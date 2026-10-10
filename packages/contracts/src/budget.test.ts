import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BUDGET_EVENTS_MAX, BUDGET_INCOME_LINES_MAX, BUDGET_LINE_NAME_MAX, BUDGET_OPERATING_LINES_MAX, BUDGET_PERIOD_NAME_MAX,
  BUDGET_REOPEN_REASON_MAX, ClosePeriodSchema, CreateBudgetPeriodSchema, ReopenPeriodSchema, SaveBudgetPlanSchema } from './budget.js'
import { isStrictObject } from './input.js'

// 테스트 파일에 제어 문자를 그대로 쓰지 않는다.
const nul = String.fromCharCode(0)
const lone = String.fromCharCode(0xd800)
const emoji = '😀'
const period = { name: '2026년 2학기', startsOn: '2026-09-01', endsOn: '2027-02-28' }
const plan = { version: 1, ...period, incomes: [{ id: null, name: '학생회비', amount: 800000 }, { id: 'l1', name: '이월금', amount: 0 }],
  operating: [{ id: 'l2', name: '회의비', amount: 100000 }], events: [{ eventId: 'e', version: 0, budget: null }, { eventId: 'e2', version: 3, budget: 300000 }] }

test('기간: 이름 앞뒤 공백을 지우고, 하루짜리 기간과 범위 끝 날짜를 받는다', () => {
  assert.deepEqual(CreateBudgetPeriodSchema.parse({ ...period, name: ' 2026년 2학기 ' }), period)
  for (const body of [{ ...period, endsOn: period.startsOn }, { name: emoji.repeat(BUDGET_PERIOD_NAME_MAX), startsOn: '2000-01-01', endsOn: '2999-12-31' }]) {
    assert.equal(CreateBudgetPeriodSchema.safeParse(body).success, true, JSON.stringify(body))
  }
})

test('기간: 빠진 값·빈 이름·상한+1·제어 문자·없는 날짜·범위 밖·거꾸로 된 날짜·모르는 키는 거절한다', () => {
  for (const body of [{ startsOn: '2026-09-01', endsOn: '2027-02-28' }, { name: '학기', endsOn: '2027-02-28' }, { name: '학기', startsOn: '2026-09-01' },
    { ...period, name: '' }, { ...period, name: '   ' }, { ...period, name: emoji.repeat(BUDGET_PERIOD_NAME_MAX + 1) },
    { ...period, name: `학기${nul}` }, { ...period, name: `학기${lone}` },
    { ...period, startsOn: '2026-02-30' }, { ...period, startsOn: '1999-12-31' }, { ...period, endsOn: '3000-01-01' }, { ...period, startsOn: '2026-9-1' },
    { ...period, startsOn: '2027-03-01' }, { ...period, extra: 1 }]) {
    assert.equal(CreateBudgetPeriodSchema.safeParse(body).success, false, JSON.stringify(body))
  }
})

test('편성: 새 줄(id null), 0원, 미정 행사, 버전 0인 행사를 받고 이름의 앞뒤 공백을 지운다', () => {
  const parsed = SaveBudgetPlanSchema.parse({ ...plan, incomes: [{ id: null, name: ' 학생회비 ', amount: 800000 }] })
  assert.equal(parsed.incomes[0]!.name, '학생회비')
  assert.equal(SaveBudgetPlanSchema.safeParse(plan).success, true)
  assert.equal(SaveBudgetPlanSchema.safeParse({ ...plan, incomes: [], operating: [], events: [] }).success, true)
})

test('편성: 상한+1·중복 이름·중복 ID·중복 행사·잘못된 금액·버전·모르는 키는 거절한다', () => {
  const line = (n: number) => ({ id: null, name: `줄${n}`, amount: 1 })
  const bodies: unknown[] = [
    { ...plan, version: 0 }, { ...plan, version: 1.5 }, { ...plan, startsOn: '2027-03-01' },
    { ...plan, incomes: Array.from({ length: BUDGET_INCOME_LINES_MAX + 1 }, (_, n) => line(n)) },
    { ...plan, operating: Array.from({ length: BUDGET_OPERATING_LINES_MAX + 1 }, (_, n) => line(n)) },
    { ...plan, events: Array.from({ length: BUDGET_EVENTS_MAX + 1 }, (_, n) => ({ eventId: `e${n}`, version: 0, budget: null })) },
    { ...plan, incomes: [line(1), { ...line(1), name: ' 줄1 ' }] },
    { ...plan, incomes: [{ id: 'l9', name: '가', amount: 1 }], operating: [{ id: 'l9', name: '나', amount: 1 }] },
    { ...plan, events: [{ eventId: 'e', version: 0, budget: 1 }, { eventId: 'e', version: 0, budget: 2 }] },
    { ...plan, incomes: [{ id: null, name: emoji.repeat(BUDGET_LINE_NAME_MAX + 1), amount: 1 }] },
    { ...plan, incomes: [{ id: null, name: ' ', amount: 1 }] }, { ...plan, incomes: [{ id: null, name: `가${nul}`, amount: 1 }] },
    { ...plan, incomes: [{ id: null, name: '가', amount: -1 }] }, { ...plan, incomes: [{ id: null, name: '가', amount: 1.5 }] },
    { ...plan, incomes: [{ id: null, name: '가', amount: 2147483648 }] }, { ...plan, incomes: [{ id: null, name: '가', amount: null }] },
    { ...plan, incomes: [{ id: null, name: '가', amount: 1, extra: 1 }] },
    { ...plan, events: [{ eventId: 'e', version: -1, budget: null }] }, { ...plan, events: [{ eventId: 'e', budget: null }] },
    { ...plan, events: [{ eventId: 'e', version: 0, budget: -1 }] }, { ...plan, events: [{ eventId: '', version: 0, budget: null }] },
    { ...plan, extra: 1 },
  ]
  for (const body of bodies) assert.equal(SaveBudgetPlanSchema.safeParse(body).success, false, JSON.stringify(body).slice(0, 120))
})

test('요청 스키마는 모르는 키를 조용히 버리지 않는다', () => {
  for (const schema of [CreateBudgetPeriodSchema, SaveBudgetPlanSchema, ClosePeriodSchema, ReopenPeriodSchema]) assert.equal(isStrictObject(schema), true)
})

test('마감: 버전과 이월금 수입 항목(고르지 않으면 null)을 꼭 받고, 틀린 버전·빠진 항목·빈 ID·긴 ID·모르는 키는 거절한다', () => {
  for (const body of [{ version: 1, carryoverLineId: null }, { version: 7, carryoverLineId: 'l1' }]) {
    assert.deepEqual(ClosePeriodSchema.parse(body), body)
  }
  for (const body of [{ version: 0, carryoverLineId: null }, { version: 1.5, carryoverLineId: null }, { version: '1', carryoverLineId: null },
    { carryoverLineId: null }, { version: 1 }, { version: 1, carryoverLineId: '' }, { version: 1, carryoverLineId: 'x'.repeat(65) },
    { version: 1, carryoverLineId: null, extra: 1 }]) {
    assert.equal(ClosePeriodSchema.safeParse(body).success, false, JSON.stringify(body))
  }
})

test('마감 다시 열기: 사유 앞뒤 공백을 지우고 상한까지 받으며, 빠진 값·빈 사유·상한+1·제어 문자·모르는 키는 거절한다', () => {
  assert.deepEqual(ReopenPeriodSchema.parse({ version: 3, reason: ' 영수증 빠짐 ' }), { version: 3, reason: '영수증 빠짐' })
  assert.equal(ReopenPeriodSchema.safeParse({ version: 3, reason: emoji.repeat(BUDGET_REOPEN_REASON_MAX) }).success, true)
  for (const body of [{ version: 3 }, { reason: '빠짐' }, { version: 3, reason: '' }, { version: 3, reason: '   ' },
    { version: 3, reason: emoji.repeat(BUDGET_REOPEN_REASON_MAX + 1) }, { version: 3, reason: `빠짐${nul}` }, { version: 3, reason: `빠짐${lone}` },
    { version: 0, reason: '빠짐' }, { version: 3, reason: '빠짐', extra: 1 }]) {
    assert.equal(ReopenPeriodSchema.safeParse(body).success, false, JSON.stringify(body))
  }
})

test('편성: 행사 줄은 금액을 바꿀 때만 보내고, 보내지 않으면 그대로 둔다', () => {
  assert.equal(SaveBudgetPlanSchema.safeParse({ ...plan, events: [{ eventId: 'e', version: 2 }] }).success, true)
})
