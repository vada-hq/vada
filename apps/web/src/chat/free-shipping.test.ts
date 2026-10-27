import { expect, test } from 'vitest'
import { freeForEveryone } from './free-shipping'

test.each([
  '무료배송',
  '무료 배송',
  '배송비 무료',
  '무료배송 ∙ 오늘출발',
  '오늘출발 · 무료배송',
  '무료배송 | 내일 도착',
  '무료배송 · 무료반품 · 새벽도착',
  '무료배송 · 내일(화) 도착 보장',
  '무료배송 · 모레(목) 도착 예정',
  '무료배송 · 10/30 도착 예정',
])('누구에게나 무료인 배송 문구: %s', shipping => {
  expect(freeForEveryone(shipping)).toBe(true)
})

test.each([
  null,
  '',
  '와우는 · 무료배송 · 무료반품 · 새벽도착',
  'WOW 회원 무료배송',
  '19,800원 이상 무료배송',
  '19,800원 이상 구매 시 · 무료배송',
  '조건부 무료배송',
  '무료배송 (일부 지역 제외)',
  '무료배송 · 일부 지역 제외',
  '첫 구매 고객 한정 · 무료배송',
  '무료배송 | 2만원부터',
  '무료배송 · 로켓배송',
  '무료배송 · 오늘출발 · 묶음배송 불가',
  '배송비 3,000원',
  '로켓배송',
])('조건이 붙었거나 무료인지 모르는 배송 문구: %s', shipping => {
  expect(freeForEveryone(shipping)).toBe(false)
})
