import assert from 'node:assert/strict'
import { test } from 'node:test'
import { withSettlement } from '../test-support/settlement.js'

const FINANCE = 's-financeMember'
const BASE = { source: 'fee', amount: 300000, receivedOn: '2026-10-25' }
const EMOJI_200 = '😀'.repeat(200)

const without = (key: string) => Object.fromEntries(Object.entries(BASE).filter(([k]) => k !== key))

test(
  '수입 입력: 상한은 받고 상한+1(이모지 포함), 형식이 틀린 값, 모르는 키, 자동 출처는 400이며 아무것도 생기지 않는다',
  withSettlement(async t => {
    await t.budgetOf()
    const url = `/api/organizations/${t.council.councilId}/incomes`
    const count = async () =>
      Number(((await t.pg.query('SELECT count(*) AS n FROM income')).rows[0] as { n: string }).n)
    const rejected: [string, unknown][] = [
      ['출처 없음', without('source')],
      ['금액 없음', without('amount')],
      ['받은 날 없음', without('receivedOn')],
      ['빈 본문', {}],
      ['참가비 출처', { ...BASE, source: 'participation_fee' }],
      ['이월금 출처', { ...BASE, source: 'carryover' }],
      ['모르는 출처', { ...BASE, source: 'gift' }],
      ['금액 0', { ...BASE, amount: 0 }],
      ['금액 음수', { ...BASE, amount: -1 }],
      ['금액 소수', { ...BASE, amount: 10.5 }],
      ['금액 글자', { ...BASE, amount: '1000' }],
      ['금액 10억+1', { ...BASE, amount: 1_000_000_001 }],
      ['날짜 형식', { ...BASE, receivedOn: '2026-1-5' }],
      ['없는 날짜', { ...BASE, receivedOn: '2026-02-30' }],
      ['내용 빈 문자열', { ...BASE, description: '' }],
      ['내용 공백만', { ...BASE, description: '   ' }],
      ['내용 200+1(이모지)', { ...BASE, description: `${EMOJI_200}😀` }],
      ['내용 NUL', { ...BASE, description: 'a\u0000' }],
      ['내용 홀로 서러게이트', { ...BASE, description: 'a\uD800' }],
      ['항목 번호 형식', { ...BASE, budgetItemId: 'abc' }],
      ['계좌 번호 형식', { ...BASE, accountId: 'abc' }],
      ['모르는 키', { ...BASE, fiscalPeriodId: t.council.councilId }],
    ]
    for (const [name, body] of rejected) {
      const response = await t.api.post(url, body, FINANCE)
      assert.equal(response.status, 400, name)
      assert.deepEqual(await response.json(), { error: 'INVALID_INPUT' }, name)
    }
    assert.equal(await count(), 0)
    const edge = await t.api.post(
      url,
      { ...BASE, amount: 1_000_000_000, description: EMOJI_200 },
      FINANCE,
    )
    assert.equal(edge.status, 201)
    assert.equal((await t.api.post(url, { ...BASE, amount: 1 }, FINANCE)).status, 201)
    assert.equal(await count(), 2)
  }),
)

test(
  '수입 취소 입력: 사유가 없거나 공백이거나 상한+1이거나 모르는 키가 있으면 400이다',
  withSettlement(async t => {
    const { period } = await t.budgetOf()
    const id = await t.make(t.council, 'income', {
      fiscalPeriodId: period,
      source: 'fee',
      amount: '1000',
      receivedOn: '2026-10-01',
    })
    const url = `/api/organizations/${t.council.councilId}/incomes/${id}/cancel`
    for (const body of [
      {},
      { reason: '' },
      { reason: '   ' },
      { reason: '😀'.repeat(501) },
      { reason: 'a\u0000' },
      { reason: 'a\uD800' },
      { reason: '잘못 적음', extra: 1 },
    ])
      assert.equal(
        (await t.api.post(url, body, FINANCE)).status,
        400,
        JSON.stringify(body).length.toString(),
      )
    const row = await t.pg.query('SELECT cancelled_at FROM income WHERE id = $1', [id])
    assert.equal((row.rows[0] as { cancelled_at: unknown }).cancelled_at, null)
  }),
)
