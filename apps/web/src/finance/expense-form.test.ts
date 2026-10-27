import { expect, test } from 'vitest'
import { purchaseDetail } from '@/test-support/purchase-fixtures'
import {
  emptyExpense,
  expenseErrors,
  expenseOf,
  linkedRequestOf,
  needsAmountConfirm,
  toggleLine,
  withRequest,
  withRequestReason,
} from './expense-form'

const TODAY = '2026-10-26'
const item = (link: string | null = 'https://www.coupang.com/vp/products/123') => ({
  ...purchaseDetail().items[0]!,
  amount: 10000,
  link,
})

test('결제 수단은 빈칸이며 필수이고 결제일은 주어진 한국 날짜다', () => {
  const values = emptyExpense(TODAY)
  expect(values.method).toBe('')
  expect(values.paidOn).toBe(TODAY)
  expect(expenseErrors(values, TODAY).method).toBe('결제 수단을 골라 주세요')
})

test('요청 제목과 첫 결제 품목의 도메인을 채우고 사람이 고친 사용처를 보존한다', () => {
  const request = purchaseDetail()
  let values = withRequest(emptyExpense(TODAY), request)
  expect(values.description).toBe(request.title)
  values = toggleLine(values, item())
  expect(values.vendor).toBe('www.coupang.com')
  expect(values.lines[0]?.amount).toBe('10000')
  values = toggleLine({ ...values, vendor: '수정한 가게' }, { ...item(), id: 'i2' })
  expect(values.vendor).toBe('수정한 가게')
  expect(expenseOf(values).lines[0]).toEqual({ lineItemId: 'i1', amount: 10000 })
})

test.each([null, '', '잘못된 링크'])('판매처를 알 수 없는 링크(%s)는 빈칸이다', link => {
  expect(toggleLine(emptyExpense(TODAY), item(link)).vendor).toBe('')
})

test('요청을 바꾸거나 비우면 이전 품목과 자동 채운 사용처를 비운다', () => {
  const before = toggleLine(withRequest(emptyExpense(TODAY), purchaseDetail()), item())
  const after = withRequest(before, null)
  expect(after.requestId).toBeNull()
  expect(after.lines).toEqual([])
  expect(after.vendor).toBe('')
  expect(after.description).toBe('')
})

test('직접 쓴 사유가 요청 본문과 같아도 다른 요청의 본문으로 덮어쓰지 않는다', () => {
  const request = purchaseDetail('r1', { body: '직접 쓴 사유' })
  const entered = { ...emptyExpense(TODAY), reason: '직접 쓴 사유' }
  const selected = withRequestReason(withRequest(entered, request), request)
  const other = purchaseDetail('r2', { body: '다른 요청 내용' })
  expect(withRequestReason(withRequest(selected, other), other).reason).toBe(entered.reason)
})

test('총액과 관계없이 품목별 승인액의 1.2배 초과만 확인한다', () => {
  const values = toggleLine(emptyExpense(TODAY), item())
  const amount = (value: string) => ({ ...values, lines: [{ ...values.lines[0]!, amount: value }] })
  expect(needsAmountConfirm(amount('12000'))).toBe(false)
  expect(needsAmountConfirm(amount('12001'))).toBe(true)
  expect(needsAmountConfirm({ ...amount('12001'), mode: 'direct' })).toBe(false)
  expect(
    needsAmountConfirm({
      ...amount('12001'),
      lines: [...amount('12001').lines, { ...values.lines[0]!, lineItemId: 'i2', amount: '1' }],
    }),
  ).toBe(true)
})

test('연결된 요청 중 결제할 수 있는 것이 꼭 하나일 때만 그 요청이다', () => {
  const payable = [{ id: 'r1' }, { id: 'r2' }]
  expect(linkedRequestOf(payable, ['r1'])).toEqual({ id: 'r1' })
  // 취소한 요청(r9)은 결제할 수 없어 목록에 없으니 다시 낸 요청 하나만 남는다.
  expect(linkedRequestOf(payable, ['r9', 'r2'])).toEqual({ id: 'r2' })
  expect(linkedRequestOf(payable, [])).toBeNull()
  expect(linkedRequestOf(payable, ['r1', 'r2'])).toBeNull()
  expect(linkedRequestOf(payable, ['r9'])).toBeNull()
})
