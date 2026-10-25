import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isStrictObject } from './input.js'
import { MEMBER_NAME_MAX, UpdateMeProfileSchema } from './profile.js'

test('내 이름 고치기: 이름을 다듬어 받고, 빈 값·공백만·상한+1(이모지)·NUL·서러게이트·모르는 키는 거절한다', () => {
  assert.deepEqual(UpdateMeProfileSchema.parse({ name: ' 김회장 ' }), { name: '김회장' })
  assert.equal(
    UpdateMeProfileSchema.safeParse({ name: '😀'.repeat(MEMBER_NAME_MAX) }).success,
    true,
  )
  for (const value of [
    {},
    { name: '' },
    { name: '   ' },
    { name: '😀'.repeat(MEMBER_NAME_MAX + 1) },
    { name: '김\u0000' },
    { name: '\uD800' },
    { name: null },
    { name: '김회장', extra: 1 },
  ]) {
    assert.equal(UpdateMeProfileSchema.safeParse(value).success, false, JSON.stringify(value))
  }
  assert.equal(isStrictObject(UpdateMeProfileSchema), true)
})
