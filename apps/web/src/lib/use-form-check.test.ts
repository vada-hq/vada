import {
  ACCOUNT_NUMBER_MAX,
  BUDGET_PURPOSE_MAX,
  CreateAccountSchema,
  CreateBudgetItemSchema,
  WON_MAX,
} from '@vada/contracts'
import { expect, test } from 'vitest'
import { withContract } from './use-form-check'

const budgetItem = (purpose: string, amount: unknown) =>
  CreateBudgetItemSchema.safeParse({ purpose, amount })

test('칸 확인이 넘긴 빈 자리(undefined)는 계약의 문제를 덮지 않는다', () => {
  expect(withContract({ amount: undefined }, budgetItem('식비', WON_MAX + 1))).toEqual({
    amount: '더 작은 값을 입력해 주세요',
  })
})

test('칸 확인의 글이 있으면 그 글이 먼저다', () => {
  const own = { amount: '금액을 입력해 주세요' }
  expect(withContract(own, budgetItem('식비', WON_MAX + 1))).toEqual(own)
})

test('글자 칸의 상한은 글자 수 문제이고, 숫자 칸의 상한만 값 문제다', () => {
  const account = CreateAccountSchema.safeParse({
    name: '동아리 통장',
    bank: '우리은행',
    accountNumber: '1'.repeat(ACCOUNT_NUMBER_MAX + 1),
    holder: '김회계',
    type: 'main',
  })
  expect(withContract({}, account)).toEqual({ accountNumber: '더 짧게 입력해 주세요' })
  expect(withContract({}, budgetItem('가'.repeat(BUDGET_PURPOSE_MAX + 1), WON_MAX + 1))).toEqual({
    purpose: '더 짧게 입력해 주세요',
    amount: '더 작은 값을 입력해 주세요',
  })
})

test('칸마다 준 글은 refine의 문제에 쓰이고, 숫자 칸의 값·형식 문제는 숫자 글 그대로다', () => {
  const messages = { purpose: '이름을 확인해 주세요', amount: '합계가 너무 커요' }
  expect(withContract({}, budgetItem('가'.repeat(BUDGET_PURPOSE_MAX + 1), 'x'), messages)).toEqual({
    purpose: '이름을 확인해 주세요',
    amount: '숫자를 입력해 주세요',
  })
})
