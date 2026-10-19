import assert from 'node:assert/strict'
import { test } from 'node:test'
import fc from 'fast-check'
import { z } from 'zod'
import { codePoints, isStrictObject, text, token } from './input.js'
// 홀로 쓰인 서러게이트까지 만들도록 UTF-16 코드 단위를 직접 뽑는다.
const anyText = fc.string({ unit: fc.integer({ min: 0, max: 0xffff }).map(n => String.fromCharCode(n)), maxLength: 120 })

test('text: 앞뒤 공백 제거 후 1..max 코드 포인트, NUL·홀로 쓰인 서러게이트 없음일 때만 통과한다', () => {
  const schema = text(50)
  fc.assert(fc.property(anyText, value => {
    const trimmed = value.trim()
    const expected = trimmed.length > 0 && codePoints(trimmed) <= 50 && !/[\u0000\uD800-\uDFFF]/u.test(value)
    const result = schema.safeParse(value)
    assert.equal(result.success, expected)
    if (result.success) assert.equal(result.data, trimmed)
  }))
})

test('token: 원문 max 이하, 제어 문자 없음, 공백 제거 후 1자 이상일 때만 통과한다', () => {
  const schema = token(40)
  fc.assert(fc.property(anyText, value => {
    const expected = value.length <= 40 && !/[\u0000-\u001f\u007f\uD800-\uDFFF]/u.test(value) && value.trim().length > 0
    const result = schema.safeParse(value)
    assert.equal(result.success, expected)
    if (result.success) assert.equal(result.data, value.trim())
  }))
})

test('문자열이 아닌 값은 거부한다', () => {
  for (const value of [null, undefined, 1, true, [], {}]) {
    assert.equal(text(10).safeParse(value).success, false)
    assert.equal(token(10).safeParse(value).success, false)
  }
})

test('isStrictObject: 모르는 키를 거부하는 z.strictObject만 참이다', () => {
  assert.equal(isStrictObject(z.strictObject({ a: z.string() })), true)
  for (const schema of [z.object({ a: z.string() }), z.looseObject({ a: z.string() }), z.string(), null, {}]) {
    assert.equal(isStrictObject(schema), false)
  }
})
