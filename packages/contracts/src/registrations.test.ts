import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ApplySchema,
  CreateFormSchema,
  qrTextOf,
  tokenHashOfQr,
  UpdateFormSchema,
} from './registrations.js'

const HASH = 'ab12'.repeat(16)

test('QR 글자는 VADA:와 대문자 해시이고, 꺼낼 때 소문자 해시로 돌아온다', () => {
  assert.equal(qrTextOf(HASH), `VADA:${HASH.toUpperCase()}`)
  assert.equal(tokenHashOfQr(qrTextOf(HASH)), HASH)
  // 소문자로 옮겨 적어도 같은 해시다.
  assert.equal(tokenHashOfQr(`VADA:${HASH}`), HASH)
})

test('VADA 글자가 아니거나 해시 모양이 아니면 null이다', () => {
  for (const value of [
    '',
    'VADA:',
    `vada:${HASH}`,
    `https://x/${HASH}`,
    `VADA:${HASH}0`,
    `VADA:${'g'.repeat(64)}`,
    `VADA:${HASH.slice(1)}`,
  ])
    assert.equal(tokenHashOfQr(value), null, value)
})

test('신청 본문: 휴대폰은 공백과 -를 빼고, 안 보낸 칸은 null이다', () => {
  assert.deepEqual(ApplySchema.parse({ name: ' 김 ', phone: '010-1234 5678' }), {
    name: '김',
    studentId: null,
    phone: '01012345678',
  })
  assert.equal(ApplySchema.safeParse({ name: '김', studentId: '12345' }).success, false)
  assert.equal(ApplySchema.safeParse({ name: '김', x: 1 }).success, false)
})

const FORM = { name: '가을 축제', closesAt: '2026-11-01T18:00' }
const FULL_FORM = {
  ...FORM,
  opensAt: null,
  capacity: null,
  notice: null,
  collectsPhone: false,
  collectsStudentId: true,
  payerFee: null,
  nonPayerFee: null,
  feeAccountId: null,
}

test('양식 만들기: 학번 받기를 빼면 받는다(DEC-75)', () => {
  assert.equal(CreateFormSchema.parse(FORM).collectsStudentId, true)
  assert.equal(
    CreateFormSchema.parse({ ...FORM, collectsStudentId: false }).collectsStudentId,
    false,
  )
  assert.equal(CreateFormSchema.safeParse({ ...FORM, collectsStudentId: null }).success, false)
  assert.equal(CreateFormSchema.safeParse({ ...FORM, collectsStudentId: 'true' }).success, false)
})

test('두 참가비가 다르면 학번 받기를 끌 수 없다. 같거나 없으면 끌 수 있다', () => {
  const split = { payerFee: 0, nonPayerFee: 5000 }
  for (const schema of [CreateFormSchema, UpdateFormSchema]) {
    const base = schema === CreateFormSchema ? FORM : FULL_FORM
    assert.equal(schema.safeParse({ ...base, ...split, collectsStudentId: false }).success, false)
    assert.equal(schema.safeParse({ ...base, ...split, collectsStudentId: true }).success, true)
    for (const fees of [
      { payerFee: 3000, nonPayerFee: 3000 },
      { payerFee: null, nonPayerFee: null },
    ])
      assert.equal(schema.safeParse({ ...base, ...fees, collectsStudentId: false }).success, true)
  }
})

test('양식 고치기는 학번 받기를 꼭 받는다', () => {
  assert.equal(UpdateFormSchema.safeParse(FULL_FORM).success, true)
  const { collectsStudentId: _omitted, ...missing } = FULL_FORM
  assert.equal(UpdateFormSchema.safeParse(missing).success, false)
})
