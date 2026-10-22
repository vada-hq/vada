import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ApplySchema, qrTextOf, tokenHashOfQr } from './registrations.js'

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
