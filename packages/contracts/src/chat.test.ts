import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  MarkNoticeSchema,
  MENTION_MAX,
  MESSAGE_BODY_MAX,
  OpenDirectSchema,
  SendMessageSchema,
} from './chat.js'
import { isStrictObject } from './input.js'

const id = '0192F2A0-0000-7000-8000-000000000001'

test('보내기: 본문은 앞뒤 공백을 떼고 2000자까지, 부른 번호는 소문자로 맞춰 50개까지다', () => {
  assert.deepEqual(SendMessageSchema.parse({ body: ' 안녕 ' }), { body: '안녕', mentions: [] })
  assert.deepEqual(SendMessageSchema.parse({ body: 'a', mentions: [id] }).mentions, [
    id.toLowerCase(),
  ])
  assert.equal(SendMessageSchema.safeParse({ body: 'a'.repeat(MESSAGE_BODY_MAX) }).success, true)
  assert.equal(SendMessageSchema.safeParse({ body: '😀'.repeat(MESSAGE_BODY_MAX) }).success, true)
  const many = Array.from({ length: MENTION_MAX }, () => id)
  assert.equal(SendMessageSchema.safeParse({ body: 'a', mentions: many }).success, true)
})

test('보내기: 빈 글, 공백, 상한+1(이모지 포함), NUL, 홀로 쓰인 서러게이트, 모르는 키, 나쁜 번호는 거절한다', () => {
  const bad: unknown[] = [
    {},
    { body: '' },
    { body: '  \n\t ' },
    { body: 'a'.repeat(MESSAGE_BODY_MAX + 1) },
    { body: '😀'.repeat(MESSAGE_BODY_MAX + 1) },
    { body: 'a\u0000b' },
    { body: 'a\uD800' },
    { body: 'a', extra: 1 },
    { body: 1 },
    { body: 'a', mentions: 'x' },
    { body: 'a', mentions: ['abc'] },
    { body: 'a', mentions: [''] },
    { body: 'a', mentions: [`${id.slice(0, -1)}\u0000`] },
    { body: 'a', mentions: Array.from({ length: MENTION_MAX + 1 }, () => id) },
  ]
  for (const value of bad)
    assert.equal(SendMessageSchema.safeParse(value).success, false, JSON.stringify(value))
})

test('공지 표시와 1:1 열기: 값 하나만 받는다', () => {
  assert.equal(MarkNoticeSchema.safeParse({ isNotice: true }).success, true)
  for (const value of [{}, { isNotice: 'true' }, { isNotice: null }, { isNotice: true, x: 1 }])
    assert.equal(MarkNoticeSchema.safeParse(value).success, false, JSON.stringify(value))
  assert.deepEqual(OpenDirectSchema.parse({ memberId: id }), { memberId: id.toLowerCase() })
  for (const value of [{}, { memberId: '' }, { memberId: 'x' }, { memberId: id, y: 1 }])
    assert.equal(OpenDirectSchema.safeParse(value).success, false, JSON.stringify(value))
  for (const schema of [SendMessageSchema, MarkNoticeSchema, OpenDirectSchema])
    assert.equal(isStrictObject(schema), true)
})
