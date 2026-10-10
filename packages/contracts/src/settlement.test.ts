import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EXPENSE_METHOD_LABELS, EXPENSE_METHODS, RECEIPT_KIND_LABELS, RECEIPT_KINDS } from './expenses.js'
import { isStrictObject } from './input.js'
import { ReopenSettlementSchema, SETTLEMENT_REASON_MAX, SetEventBudgetSchema, SettleEventSchema } from './settlement.js'

// 테스트 파일에 제어 문자를 그대로 쓰지 않는다.
const nul = String.fromCharCode(0)
const lone = String.fromCharCode(0xd800)
const emoji = '😀'

test('예산: 버전 0(아직 행 없음)과 미정(null)을 받고, 음수·소수·상한+1·문자열·모르는 키는 거절한다', () => {
  assert.deepEqual(SetEventBudgetSchema.parse({ version: 0, budget: 3000000 }), { version: 0, budget: 3000000 })
  for (const body of [{ version: 4, budget: null }, { version: 1, budget: 0 }, { version: 2147483647, budget: 2147483647 }]) {
    assert.equal(SetEventBudgetSchema.safeParse(body).success, true, JSON.stringify(body))
  }
  for (const body of [{ budget: 1 }, { version: 1 }, { version: -1, budget: 1 }, { version: 1.5, budget: 1 }, { version: 2147483648, budget: 1 },
    { version: 1, budget: -1 }, { version: 1, budget: 1.5 }, { version: 1, budget: 2147483648 }, { version: 1, budget: '1000' },
    { version: '1', budget: 1 }, { version: 1, budget: 1, extra: 1 }]) {
    assert.equal(SetEventBudgetSchema.safeParse(body).success, false, JSON.stringify(body))
  }
})

test('정산·다시 열기: 버전과 참가비 수입 항목이 필요하고, 다시 열기 사유는 비울 수 없다', () => {
  assert.deepEqual(SettleEventSchema.parse({ version: 0, feeIncomeLineId: null }), { version: 0, feeIncomeLineId: null })
  assert.deepEqual(SettleEventSchema.parse({ version: 1, feeIncomeLineId: ' l1 ' }), { version: 1, feeIncomeLineId: 'l1' })
  for (const body of [{}, { version: 0 }, { feeIncomeLineId: null }, { version: -1, feeIncomeLineId: null }, { version: '1', feeIncomeLineId: null },
    { version: 0, feeIncomeLineId: '' }, { version: 0, feeIncomeLineId: ' ' }, { version: 0, feeIncomeLineId: 'x'.repeat(65) },
    { version: 0, feeIncomeLineId: `a${nul}` }, { version: 0, feeIncomeLineId: `a${String.fromCharCode(7)}` }, { version: 0, feeIncomeLineId: 1 },
    { version: 1, feeIncomeLineId: null, extra: 1 }]) {
    assert.equal(SettleEventSchema.safeParse(body).success, false, JSON.stringify(body))
  }
  assert.deepEqual(ReopenSettlementSchema.parse({ version: 3, reason: ' 영수증 빠짐 ' }), { version: 3, reason: '영수증 빠짐' })
  assert.equal(ReopenSettlementSchema.safeParse({ version: 3, reason: emoji.repeat(SETTLEMENT_REASON_MAX) }).success, true)
  for (const body of [{ version: 3 }, { version: 3, reason: '' }, { version: 3, reason: '  ' }, { version: 3, reason: emoji.repeat(SETTLEMENT_REASON_MAX + 1) },
    { version: 3, reason: `a${nul}` }, { version: 3, reason: `a${lone}` }, { reason: '빠짐' }, { version: 3, reason: '빠짐', extra: 1 }]) {
    assert.equal(ReopenSettlementSchema.safeParse(body).success, false, JSON.stringify(body))
  }
})

test('요청 스키마는 모르는 키를 조용히 버리지 않는다', () => {
  for (const schema of [SetEventBudgetSchema, SettleEventSchema, ReopenSettlementSchema]) assert.equal(isStrictObject(schema), true)
})

test('결제 수단·증빙 종류마다 화면과 엑셀이 같이 쓰는 이름이 있다', () => {
  assert.deepEqual(Object.keys(EXPENSE_METHOD_LABELS), [...EXPENSE_METHODS])
  assert.deepEqual(Object.keys(RECEIPT_KIND_LABELS), [...RECEIPT_KINDS])
  assert.deepEqual([EXPENSE_METHOD_LABELS.council_card, EXPENSE_METHOD_LABELS.personal, RECEIPT_KIND_LABELS.tax_invoice],
    ['학생회 카드', '개인 결제(환급 필요)', '세금계산서'])
})
