import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EmptyRequestSchema, isStrictObject } from './input.js'
import { INVITE_CODE_MAX, InviteCodeSchema, JoinCouncilSchema } from './invites.js'

test('초대 코드: 공백·하이픈·소문자를 정규화하고, 빈 값·제어 문자·상한 초과는 거부한다', () => {
  assert.equal(InviteCodeSchema.parse(' abcd-2345 '), 'ABCD2345')
  assert.equal(InviteCodeSchema.parse('abcd 2345'), 'ABCD2345')
  for (const value of ['', '   ', '-', 'A'.repeat(INVITE_CODE_MAX + 1), '😀'.repeat(INVITE_CODE_MAX + 1), 'ABCD\u00002345', '\uD800ABCD', 'AB\tCD', 1, null]) {
    assert.equal(InviteCodeSchema.safeParse(value).success, false, JSON.stringify(value))
  }
})

test('들어오기 본문은 코드 하나만 받는다', () => {
  assert.deepEqual(JoinCouncilSchema.parse({ code: 'abcd2345' }), { code: 'ABCD2345' })
  for (const value of [{}, { code: '' }, { code: 'ABCD2345', extra: 1 }, { code: null }]) {
    assert.equal(JoinCouncilSchema.safeParse(value).success, false, JSON.stringify(value))
  }
  assert.equal(isStrictObject(JoinCouncilSchema), true)
})

test('빈 본문 스키마는 빈 객체만 받는다', () => {
  assert.deepEqual(EmptyRequestSchema.parse({}), {})
  for (const value of [{ x: 1 }, null, [], 'x']) assert.equal(EmptyRequestSchema.safeParse(value).success, false, JSON.stringify(value))
  assert.equal(isStrictObject(EmptyRequestSchema), true)
})
