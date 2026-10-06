import assert from 'node:assert/strict'
import { test } from 'node:test'
import fc from 'fast-check'
import { codePoints, text, token } from './input.js'
import { CreateEventSchema, EVENT_NAME_MAX } from './events.js'
import { CreateMessageSchema, MESSAGE_CONTENT_MAX } from './chat.js'

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

test('행사 이름: 이모지도 코드 포인트로 세어 100개까지 통과한다', () => {
  assert.equal(CreateEventSchema.safeParse({ name: '😀'.repeat(EVENT_NAME_MAX) }).success, true)
  assert.equal(CreateEventSchema.safeParse({ name: '😀'.repeat(EVENT_NAME_MAX + 1) }).success, false)
  assert.deepEqual(CreateEventSchema.parse({ name: '  축제  ' }), { name: '축제' })
})

test('채팅 본문: 2000 코드 포인트까지, 줄바꿈은 허용한다', () => {
  assert.equal(CreateMessageSchema.safeParse({ content: '😀'.repeat(MESSAGE_CONTENT_MAX) }).success, true)
  assert.equal(CreateMessageSchema.safeParse({ content: 'a'.repeat(MESSAGE_CONTENT_MAX + 1) }).success, false)
  assert.equal(CreateMessageSchema.parse({ content: '첫 줄\n둘째 줄' }).content, '첫 줄\n둘째 줄')
})

test('모르는 키가 하나라도 있으면 거부한다', () => {
  const key = fc.string({ minLength: 1, maxLength: 20 })
  fc.assert(fc.property(key.filter(k => k !== 'name'), k => !CreateEventSchema.safeParse(JSON.parse(JSON.stringify({ name: 'a', [k]: 1 }))).success))
  fc.assert(fc.property(key.filter(k => k !== 'content'), k => !CreateMessageSchema.safeParse(JSON.parse(JSON.stringify({ content: 'a', [k]: 1 }))).success))
})
