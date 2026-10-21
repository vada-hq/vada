import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isStrictObject } from './input.js'
import {
  CancelPurchaseRequestSchema,
  CreatePurchaseRequestSchema,
  PurchaseRequestListQuerySchema,
} from './purchases.js'
import { purchaseRequestFromPath, purchaseRequestTag, purchaseRequestUrl } from './push.js'

const item = { name: '마커', quantity: 1 }

test('요청 본문 스키마는 모두 z.strictObject이다', () => {
  for (const schema of [
    CreatePurchaseRequestSchema,
    CancelPurchaseRequestSchema,
    PurchaseRequestListQuerySchema,
  ])
    assert.equal(isStrictObject(schema), true)
})

test('CreatePurchaseRequestSchema: 비운 칸은 null이고 링크는 http와 https만 받는다', () => {
  const parsed = CreatePurchaseRequestSchema.parse({ title: ' a ', items: [item] })
  assert.deepEqual(parsed, {
    title: 'a',
    body: null,
    neededBy: null,
    items: [{ name: '마커', quantity: 1, link: null, options: null }],
  })
  for (const link of ['http://a.example/x', 'https://a.example/x'])
    assert.equal(
      CreatePurchaseRequestSchema.safeParse({ title: 'a', items: [{ ...item, link }] }).success,
      true,
      link,
    )
  for (const link of [
    'javascript:alert(1)',
    'data:text/html,a',
    'ftp://a.example',
    'a.example',
    '',
  ])
    assert.equal(
      CreatePurchaseRequestSchema.safeParse({ title: 'a', items: [{ ...item, link }] }).success,
      false,
      link,
    )
})

test('구매 요청 주소 한 쌍: 만든 주소를 그대로 읽고 다른 모양은 읽지 않는다', () => {
  assert.deepEqual(purchaseRequestFromPath(purchaseRequestUrl('c-1', 'r-1')), {
    councilId: 'c-1',
    requestId: 'r-1',
  })
  assert.deepEqual(purchaseRequestFromPath('/purchases/c%201/r'), {
    councilId: 'c 1',
    requestId: 'r',
  })
  assert.equal(purchaseRequestTag('r-1'), 'request:r-1')
  for (const path of [
    '/',
    '/purchases',
    '/purchases/c',
    '/purchases/c/',
    '/purchases//r',
    '/purchases/c/r/x',
    '/tasks/c/r',
  ])
    assert.equal(purchaseRequestFromPath(path), null, path)
  assert.equal(purchaseRequestFromPath('/purchases/%E0%A4%A/r'), null)
})
