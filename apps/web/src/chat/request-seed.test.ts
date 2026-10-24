import { expect, test } from 'vitest'
import { CreatePurchaseRequestSchema, type TeamMember } from '@vada/contracts'
import { message } from '@/test-support/chat-fixtures'
import { requestSeedOf } from './request-seed'

const member = (id: string): TeamMember => ({
  id,
  name: id,
  profile: { schoolName: null, collegeName: null, majorName: null, grade: null },
  councilRank: null,
  departments: [],
  joinedAt: '2026-10-01T01:00:00.000Z',
})
const members = [member('m1'), member('m2')]
const finance = { meId: 'm1', members, canAssign: true }
const plain = { meId: 'm1', members, canAssign: false }

// 계약이 받는지는 같은 스키마로 본다(숫자를 다시 적지 않는다).
const accepted = (seed: ReturnType<typeof requestSeedOf>) =>
  CreatePurchaseRequestSchema.safeParse({
    title: seed.title,
    body: seed.body === '' ? null : seed.body,
    items: [{ name: '물건', quantity: 1, link: null, options: null }],
  }).success

test('제목은 첫 줄, 내용은 본문 전체다', () => {
  const seed = requestSeedOf(message('a1', '\n  현수막 2개 사 주세요  \n색은 파랑'), finance)
  expect(seed.title).toBe('현수막 2개 사 주세요')
  expect(seed.body).toBe('현수막 2개 사 주세요  \n색은 파랑')
  expect(seed.sourceMessageId).toBe('a1')
})

test('사진만 있는 메시지는 제목과 내용이 비어 있다', () => {
  const seed = requestSeedOf(message('a1', ''), plain)
  expect(seed.title).toBe('')
  expect(seed.body).toBe('')
})

test('긴 글은 상한 안으로 자르고 이모지를 반으로 자르지 않는다', () => {
  const long = '😀'.repeat(5000)
  const seed = requestSeedOf(message('a1', long), plain)
  expect(accepted(seed)).toBe(true)
  expect(seed.title).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/)
  expect(seed.body).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/)
  expect(seed.title.length).toBeGreaterThan(0)
})

test('요청한 사람은 재정부에게만: 남의 메시지면 보낸 사람, 내 것이나 떠난 사람이나 시스템이면 나', () => {
  expect(requestSeedOf(message('a1', 'x', { senderId: 'm2' }), finance).requestedBy).toBe('m2')
  expect(requestSeedOf(message('a1', 'x', { senderId: 'm1' }), finance).requestedBy).toBe('m1')
  expect(requestSeedOf(message('a1', 'x', { senderId: 'm9' }), finance).requestedBy).toBe('m1')
  expect(requestSeedOf(message('a1', 'x', { senderId: null }), finance).requestedBy).toBe('m1')
  expect(requestSeedOf(message('a1', 'x', { senderId: 'm2' }), plain).requestedBy).toBeNull()
})

test('운영진 목록을 못 읽었으면 나로 채운다', () => {
  const seed = requestSeedOf(message('a1', 'x', { senderId: 'm2' }), { ...finance, members: null })
  expect(seed.requestedBy).toBe('m1')
})
