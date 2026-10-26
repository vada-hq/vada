import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AddFeePaymentsSchema, FEE_PAYMENT_TEXT_MAX } from './fee-payments.js'

const input = { paidFrom: '2026-01-01', paidUntil: '2026-06-30', students: '20260001' }
test('납부 명단은 날짜·학번과 선택한 교체 확인만 받는다', () => {
  for (const body of [input, { ...input, replace: true }, { ...input, replace: false }])
    assert.equal(AddFeePaymentsSchema.safeParse(body).success, true)
  for (const body of [
    { ...input, replace: 'true' },
    { ...input, name: '김학생' },
    { ...input, file: '명단.csv' },
    { ...input, students: '' },
    { ...input, students: '   ' },
    { ...input, students: '\u0000' },
    { ...input, students: '\ud800' },
    { ...input, students: '😀'.repeat(FEE_PAYMENT_TEXT_MAX + 1) },
    { paidFrom: input.paidFrom, students: input.students },
    { ...input, paidUntil: '2025-12-31' },
  ])
    assert.equal(AddFeePaymentsSchema.safeParse(body).success, false)
})
