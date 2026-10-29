import { expect, test } from 'vitest'
import type { PurchaseItemBrief, PurchaseRequestSummary } from '@vada/contracts'
import { purchaseSummary } from '@/test-support/purchase-fixtures'
import { cardsOf, columnOf, countsOf, requestStateOf, stacksOf } from './purchase-board'

const item = (extra: Partial<PurchaseItemBrief>): PurchaseItemBrief => ({
  id: 'i',
  name: '품목',
  quantity: 1,
  estimate: null,
  amount: null,
  status: 'pending',
  paid: false,
  shipped: false,
  ...extra,
})
const progress = { decided: true, paid: false, partlyPaid: false, hasShipment: false }

test('품목의 열은 결재 결과, 결제, 송장으로 정하고 취소한 요청의 대기 품목은 확인 필요다', () => {
  const at = (
    extra: Partial<PurchaseItemBrief>,
    request: PurchaseRequestSummary = purchaseSummary('r'),
  ) => columnOf({ item: item(extra), request })
  expect(at({})).toBe('review')
  expect(at({}, purchaseSummary('c', { status: 'cancelled' }))).toBe('attention')
  expect(at({ status: 'rejected' })).toBe('attention')
  expect(at({ status: 'cancelled', paid: true })).toBe('attention')
  expect(at({ status: 'approved' })).toBe('ready')
  expect(at({ status: 'approved', shipped: true })).toBe('progress')
  expect(at({ status: 'approved', shipped: true, paid: true })).toBe('done')
})

test('같은 열의 같은 요청 품목은 한 묶음이고, 수는 열마다 센다', () => {
  const a = purchaseSummary('a', { itemBriefs: [item({ id: '1' }), item({ id: '2' })] })
  const b = purchaseSummary('b', { itemBriefs: [item({ id: '3', status: 'approved' })] })
  const cards = cardsOf([a, b])
  expect(stacksOf(cards).map(stack => stack.map(card => card.item.id))).toEqual([['1', '2'], ['3']])
  expect(countsOf(cards)).toMatchObject({ review: 2, ready: 1, done: 0 })
})

test('요청의 지금 상태는 결재·송장·결제 진행으로 정한다', () => {
  expect(requestStateOf(purchaseSummary('a'))).toBe('pending')
  expect(requestStateOf(purchaseSummary('b', { status: 'rejected' }))).toBe('closed')
  expect(requestStateOf(purchaseSummary('c', { status: 'approved', progress }))).toBe('approved')
  const shipped = { ...progress, hasShipment: true }
  expect(requestStateOf(purchaseSummary('d', { status: 'approved', progress: shipped }))).toBe(
    'buying',
  )
  const paid = { ...progress, paid: true }
  expect(requestStateOf(purchaseSummary('e', { status: 'partial', progress: paid }))).toBe('done')
})
