import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { CreateExpenseSchema, EXPENSE_METHODS } from '@vada/contracts'
import { createRateLimiter } from '../http/rate-limit.js'
import { errorOf, ITEM, MISSING, runPurchases, startPurchases } from '../test-support/purchases.js'

const FINANCE = 's-financeMember'
const emoji = (n: number) => '😀'.repeat(n)
const BASE = { vendor: 'a', description: 'b', amount: 1000, paidOn: '2026-10-25' }
const LINE = { lineItemId: MISSING, amount: 1000 }

test(
  '상한은 받고 상한+1(이모지 포함), 형식이 틀린 값, 모르는 키는 400이며 아무것도 생기지 않는다',
  runPurchases(async s => {
    const url = `/api/organizations/${s.council.councilId}/expenses`
    const expenses = () => s.count('SELECT count(*) AS n FROM expense')
    const ok = await s.api.post(
      url,
      {
        vendor: emoji(100),
        description: emoji(200),
        amount: 1_000_000_000,
        paidOn: '2026-10-25',
        reason: emoji(1000),
      },
      FINANCE,
    )
    assert.equal(ok.status, 201)
    const before = await expenses()
    const bad: [string, unknown][] = [
      ['사용처 없음', { ...BASE, vendor: undefined }],
      ['사용처 빈 문자열', { ...BASE, vendor: '' }],
      ['사용처 공백', { ...BASE, vendor: ' \n ' }],
      ['사용처 101자', { ...BASE, vendor: emoji(101) }],
      ['사용처 NUL', { ...BASE, vendor: 'a\u0000' }],
      ['사용처 홀로 서러게이트', { ...BASE, vendor: 'a\uD800' }],
      ['내역 없음', { ...BASE, description: undefined }],
      ['내역 201자', { ...BASE, description: emoji(201) }],
      ['사유 1001자', { ...BASE, reason: emoji(1001) }],
      ['사유 NUL', { ...BASE, reason: 'a\u0000' }],
      ['금액 없음', { ...BASE, amount: undefined }],
      ['금액 0', { ...BASE, amount: 0 }],
      ['금액 음수', { ...BASE, amount: -1 }],
      ['금액 10억 1', { ...BASE, amount: 1_000_000_001 }],
      ['금액 소수', { ...BASE, amount: 1.5 }],
      ['금액 글자', { ...BASE, amount: '1000' }],
      ['결제일 없음', { ...BASE, paidOn: undefined }],
      ['결제일 형식', { ...BASE, paidOn: '2026-13-01' }],
      ['결제일 시각', { ...BASE, paidOn: '2026-10-25T10:00' }],
      ['결제 수단 모름', { ...BASE, method: 'bitcoin' }],
      ['먼저 낸 사람 uuid 아님', { ...BASE, paidBy: 'x' }],
      ['부탁한 사람 uuid 아님', { ...BASE, requestedBy: 'x' }],
      ['예산 항목 uuid 아님', { ...BASE, budgetItemId: 'x' }],
      ['모르는 키', { ...BASE, extra: 1 }],
      ['결제 내역 합이 다름', { ...BASE, lines: [{ ...LINE, amount: 999 }] }],
      ['결제 내역 21줄', { ...BASE, amount: 21000, lines: Array.from({ length: 21 }, () => LINE) }],
      ['결제 내역과 예산 항목', { ...BASE, lines: [LINE], budgetItemId: MISSING }],
      ['결제 내역과 부탁한 사람', { ...BASE, lines: [LINE], requestedBy: MISSING }],
      ['결제 내역 금액 0', { ...BASE, lines: [{ ...LINE, amount: 0 }] }],
      ['결제 내역 품목 번호 아님', { ...BASE, lines: [{ ...LINE, lineItemId: 'x' }] }],
      ['결제 내역 모르는 키', { ...BASE, lines: [{ ...LINE, extra: 1 }] }],
      ['같은 품목 두 줄', { ...BASE, amount: 2000, lines: [LINE, LINE] }],
    ]
    for (const [label, body] of bad) {
      const response = await s.api.post(url, body, FINANCE)
      assert.equal(response.status, 400, label)
      assert.equal(await errorOf(response), 'INVALID_INPUT', label)
    }
    assert.equal(await expenses(), before)
  }),
)

test('결제 수단은 카드, 계좌 이체, 현금이다', () => {
  assert.deepEqual([...EXPENSE_METHODS], ['card', 'transfer', 'cash'])
  const command = { ...BASE, commandId: randomUUID() }
  assert.equal(CreateExpenseSchema.safeParse({ ...command, method: 'transfer' }).success, true)
  assert.equal(CreateExpenseSchema.safeParse(command).data?.method, 'card')
})

test('요청 내기와 지출 적기는 한도 하나를 같이 쓴다: 합쳐 21번째는 429이고 지출도 요청도 생기지 않는다', async () => {
  const s = await startPurchases({ limiter: createRateLimiter({ limit: 3, windowMs: 10_000 }) })
  try {
    const url = `/api/organizations/${s.council.councilId}/expenses`
    assert.equal((await s.create({ title: 'a', items: [ITEM] }, FINANCE)).status, 201)
    assert.equal((await s.api.post(url, BASE, FINANCE)).status, 201)
    assert.equal((await s.api.post(url, BASE, FINANCE)).status, 201)
    const limited = await s.api.post(url, BASE, FINANCE)
    assert.equal(limited.status, 429)
    assert.equal(await errorOf(limited), 'TOO_MANY_REQUESTS')
    assert.equal((await s.create({ title: 'b', items: [ITEM] }, FINANCE)).status, 429)
    assert.equal(await s.count('SELECT count(*) AS n FROM expense'), 2)
    assert.equal(await s.count('SELECT count(*) AS n FROM request'), 1)
    // 다른 계정은 따로 센다. 읽기는 세지 않는다.
    assert.equal((await s.api.post(url, BASE, 's-planningMember')).status, 403)
    assert.equal((await s.api.get(url, FINANCE)).status, 200)
  } finally {
    await s.close()
  }
})
