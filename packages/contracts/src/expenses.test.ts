import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CreateExpenseSchema } from './expenses.js'

const COMMAND_ID = '3f0c1d52-8a4e-4b7a-9c1e-5d2f6a7b8c90'
const BODY = {
  vendor: '다이소',
  description: '마커',
  amount: 1000,
  method: 'card',
  paidOn: '2026-10-25',
}

test('지출 본문: 명령 번호는 UUID v4만 받고 없으면 거절한다', () => {
  assert.equal(CreateExpenseSchema.safeParse(BODY).success, false)
  for (const bad of ['', 'abc', '019e0000-0000-7000-8000-000000000000', `${COMMAND_ID}0`, ' '])
    assert.equal(CreateExpenseSchema.safeParse({ ...BODY, commandId: bad }).success, false, bad)
  assert.equal(CreateExpenseSchema.safeParse({ ...BODY, commandId: COMMAND_ID }).success, true)
})

test('결제 수단은 기본값 없이 필수다', () => {
  const { method: _method, ...body } = BODY
  assert.equal(CreateExpenseSchema.safeParse({ ...body, commandId: COMMAND_ID }).success, false)
  for (const method of ['', null, 'bitcoin'])
    assert.equal(
      CreateExpenseSchema.safeParse({ ...BODY, commandId: COMMAND_ID, method }).success,
      false,
    )
})
