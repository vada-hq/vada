import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isStrictObject } from './input.js'
import { EXPENSE_DESCRIPTION_MAX, EXPENSE_ITEMS_MAX, EXPENSE_NOTE_MAX, EXPENSE_VENDOR_MAX, EXPENSE_VOID_REASON_MAX, RECEIPT_FILE_NAME_MAX,
  RECEIPT_SIZE_MAX, CreateExpenseSchema, CreateReceiptUploadSchema, ReceiptActionSchema, UpdateExpenseSchema, VoidExpenseSchema } from './expenses.js'

// 테스트 파일에 제어 문자를 그대로 쓰지 않는다.
const nul = String.fromCharCode(0)
const lone = String.fromCharCode(0xd800)
const emoji = '😀'
const valid = { eventId: 'e', vendor: '쿠팡', description: '체육대회 물품', amount: 137500, paidOn: '2026-10-09', method: 'council_card',
  payerMembershipId: 'mf', note: null, itemIds: ['i1', 'i2'], budgetLineId: null }
const without = (key: string) => Object.fromEntries(Object.entries(valid).filter(([name]) => name !== key))

test('지출 칸: 앞뒤 공백을 지우고, 상시 운영(행사 없음)·품목 없음·0원도 받는다', () => {
  assert.deepEqual(CreateExpenseSchema.parse({ ...valid, vendor: ' 쿠팡 ', note: ' 영수증 늦게 옴 ' }), { ...valid, note: '영수증 늦게 옴' })
  assert.equal(CreateExpenseSchema.safeParse({ ...valid, eventId: null, itemIds: [] }).success, true)
  assert.equal(CreateExpenseSchema.safeParse({ ...valid, amount: 0, paidOn: '2000-01-01' }).success, true)
})

test('지출 칸: 빠진 값·빈 값·상한+1·제어 문자·범위 밖 값·모르는 키는 거절한다', () => {
  const bodies: unknown[] = [
    without('vendor'), without('description'), without('amount'), without('paidOn'), without('method'), without('payerMembershipId'),
    without('itemIds'), without('eventId'), without('note'), without('budgetLineId'),
    { ...valid, vendor: '' }, { ...valid, vendor: '   ' }, { ...valid, vendor: emoji.repeat(EXPENSE_VENDOR_MAX + 1) },
    { ...valid, vendor: `쿠팡${nul}` }, { ...valid, vendor: `쿠팡${lone}` },
    { ...valid, description: ' ' }, { ...valid, description: emoji.repeat(EXPENSE_DESCRIPTION_MAX + 1) },
    { ...valid, note: '' }, { ...valid, note: emoji.repeat(EXPENSE_NOTE_MAX + 1) },
    { ...valid, amount: -1 }, { ...valid, amount: 1.5 }, { ...valid, amount: 2147483648 }, { ...valid, amount: '1000' },
    { ...valid, paidOn: '2026-02-30' }, { ...valid, paidOn: '1999-12-31' }, { ...valid, paidOn: '3000-01-01' }, { ...valid, paidOn: '2026-1-1' },
    { ...valid, method: 'card' }, { ...valid, payerMembershipId: '' }, { ...valid, payerMembershipId: 'm'.repeat(65) },
    { ...valid, eventId: '' }, { ...valid, eventId: `e${nul}` },
    { ...valid, itemIds: ['i1', 'i1'] }, { ...valid, itemIds: Array.from({ length: EXPENSE_ITEMS_MAX + 1 }, (_, n) => `i${n}`) },
    { ...valid, itemIds: [nul] }, { ...valid, extra: 1 },
  ]
  for (const body of bodies) assert.equal(CreateExpenseSchema.safeParse(body).success, false, JSON.stringify(body))
})

test('수정·취소: 버전이 필요하고, 취소 사유는 비울 수 없다', () => {
  assert.equal(UpdateExpenseSchema.safeParse({ ...valid, version: 2 }).success, true)
  for (const body of [valid, { ...valid, version: 0 }, { ...valid, version: '2' }]) {
    assert.equal(UpdateExpenseSchema.safeParse(body).success, false, JSON.stringify(body))
  }
  assert.deepEqual(VoidExpenseSchema.parse({ version: 3, reason: ' 중복 기록 ' }), { version: 3, reason: '중복 기록' })
  for (const body of [{ version: 3 }, { version: 3, reason: ' ' }, { version: 3, reason: emoji.repeat(EXPENSE_VOID_REASON_MAX + 1) },
    { version: 3, reason: `a${nul}` }, { reason: '중복' }, { version: 3, reason: '중복', extra: 1 }]) {
    assert.equal(VoidExpenseSchema.safeParse(body).success, false, JSON.stringify(body))
  }
})

test('영수증 올리기: 형식·크기·종류를 정해진 값으로만 받고, 확인·삭제 본문은 빈 객체다', () => {
  const upload = { fileName: '영수증.jpg', contentType: 'image/jpeg', size: 1234, kind: 'receipt' }
  assert.equal(CreateReceiptUploadSchema.safeParse(upload).success, true)
  assert.equal(CreateReceiptUploadSchema.safeParse({ ...upload, contentType: 'application/pdf', size: RECEIPT_SIZE_MAX, kind: 'tax_invoice' }).success, true)
  for (const change of [{ fileName: '' }, { fileName: emoji.repeat(RECEIPT_FILE_NAME_MAX + 1) }, { fileName: `a${nul}.jpg` },
    { contentType: 'image/gif' }, { contentType: '' }, { size: 0 }, { size: RECEIPT_SIZE_MAX + 1 }, { size: 1.5 }, { kind: 'invoice' }, { extra: 1 }]) {
    assert.equal(CreateReceiptUploadSchema.safeParse({ ...upload, ...change }).success, false, JSON.stringify(change))
  }
  assert.equal(ReceiptActionSchema.safeParse({}).success, true)
  assert.equal(ReceiptActionSchema.safeParse({ receiptId: 'r' }).success, false)
  for (const schema of [CreateExpenseSchema, UpdateExpenseSchema, VoidExpenseSchema, CreateReceiptUploadSchema, ReceiptActionSchema]) {
    assert.equal(isStrictObject(schema), true)
  }
})

test('운영 항목: 상시 운영 지출만 고를 수 있다', () => {
  assert.equal(CreateExpenseSchema.safeParse({ ...valid, eventId: null, itemIds: [], budgetLineId: 'l1' }).success, true)
  assert.equal(CreateExpenseSchema.safeParse({ ...valid, budgetLineId: 'l1' }).success, false)
  assert.equal(UpdateExpenseSchema.safeParse({ ...valid, version: 1, budgetLineId: 'l1' }).success, false)
  assert.equal(CreateExpenseSchema.safeParse({ ...valid, eventId: null, itemIds: [], budgetLineId: '' }).success, false)
})
