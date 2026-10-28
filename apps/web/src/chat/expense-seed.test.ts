import { expect, test } from 'vitest'
import { CreateExpenseSchema, type TeamMember } from '@vada/contracts'
import { message } from '@/test-support/chat-fixtures'
import { expenseSeedOf } from './expense-seed'

const member = (id: string): TeamMember => ({
  id,
  name: id,
  councilRank: null,
  departments: [],
  joinedAt: '2026-10-01T01:00:00.000Z',
  actions: [],
})
const context = { meId: 'm1', members: [member('m1'), member('m2')] }

// 계약이 받는지는 같은 스키마로 본다(숫자를 다시 적지 않는다).
const accepted = (seed: ReturnType<typeof expenseSeedOf>) =>
  CreateExpenseSchema.safeParse({
    commandId: '3f0c1d52-8a4e-4b7a-9c1e-5d2f6a7b8c90',
    vendor: '가게',
    description: seed.description,
    amount: 1000,
    method: 'card',
    paidOn: seed.paidOn,
  }).success

test('내역은 첫 줄이고 근거 메시지가 같이 간다', () => {
  const seed = expenseSeedOf(message('a1', '\n  영수증 올려요  \n둘째 줄'), context)
  expect(seed.description).toBe('영수증 올려요')
  expect(seed.sourceMessageId).toBe('a1')
})

test('내역은 상한 안으로 자르고 이모지를 반으로 자르지 않는다', () => {
  const seed = expenseSeedOf(message('a1', '😀'.repeat(3000)), context)
  expect(seed.description).not.toBe('')
  expect(accepted(seed)).toBe(true)
})

test('결제일은 메시지를 보낸 한국 날짜다(자정 앞뒤 1초)', () => {
  const at = (sentAt: string) => expenseSeedOf(message('a1', 'x', { sentAt }), context).paidOn
  expect(at('2026-10-20T14:59:59Z')).toBe('2026-10-20')
  expect(at('2026-10-20T15:00:00Z')).toBe('2026-10-21')
  expect(at('2026-10-20T15:00:01Z')).toBe('2026-10-21')
})

test('먼저 낸 사람은 남의 메시지면 보낸 사람, 내 것이면 학생회 돈, 떠났거나 시스템이면 비운다', () => {
  const by = (senderId: string | null) =>
    expenseSeedOf(message('a1', 'x', { senderId }), context).paidBy
  expect(by('m2')).toBe('m2')
  expect(by('m1')).toBeNull()
  expect(by('gone')).toBeNull()
  expect(by(null)).toBeNull()
  expect(
    expenseSeedOf(message('a1', 'x', { senderId: 'm2' }), { ...context, members: null }).paidBy,
  ).toBeNull()
})

test('이 메시지로 만든 구매 요청만 연결된 요청으로 넘긴다', () => {
  const made = [
    { kind: 'purchase_request' as const, id: 'r1', title: '간식', blocking: false },
    { kind: 'expense' as const, id: 'e1', title: '간식', blocking: true },
    { kind: 'purchase_request' as const, id: 'r2', title: '간식', blocking: true },
  ]
  expect(expenseSeedOf(message('a1', 'x', { made }), context).linkedRequestIds).toEqual([
    'r1',
    'r2',
  ])
  expect(expenseSeedOf(message('a1', 'x'), context).linkedRequestIds).toEqual([])
})
