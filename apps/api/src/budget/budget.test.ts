import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BudgetResponse } from '@vada/contracts'
import { errorOf, runPurchases, type PurchaseKit } from '../test-support/purchases.js'

const emoji = (n: number) => '😀'.repeat(n)
const PERIOD = { name: '2026 2학기', startsOn: '2026-09-01', endsOn: '2026-12-31' }
const FINANCE = 's-financeMember'

const root = (s: PurchaseKit) => `/api/organizations/${s.council.councilId}`
const viewOf = async (response: Response) => (await response.json()) as BudgetResponse
const makePeriod = (s: PurchaseKit, body: unknown = PERIOD, user = FINANCE) =>
  s.api.post(`${root(s)}/fiscal-periods`, body, user)
const makeItem = (s: PurchaseKit, body: unknown, user = FINANCE) =>
  s.api.post(`${root(s)}/budget-items`, body, user)

test(
  '기간이 없으면 period null과 지금 기수의 이름·날짜를 주고, 모든 운영진이 읽는다',
  runPurchases(async s => {
    for (const user of ['s-financeMember', 's-president', 's-planningMember', 's-plain']) {
      const response = await s.api.get(`${root(s)}/budget`, user)
      assert.equal(response.status, 200, user)
      assert.deepEqual(await viewOf(response), {
        period: null,
        items: [],
        suggested: { name: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' },
      })
    }
    assert.equal((await s.api.get(`${root(s)}/budget`, 's-ended')).status, 403)
    assert.equal((await s.api.get(`${root(s)}/budget`, 'o-president')).status, 403)
    assert.equal((await s.api.get(`${root(s)}/budget`)).status, 401)
    assert.equal((await s.api.get('/api/organizations/not-a-uuid/budget', FINANCE)).status, 403)
  }),
)

test(
  '재정부가 기간을 만들면 예산이 같이 생기고 판 1이다. 회장단과 부원은 403이다',
  runPurchases(async s => {
    for (const user of ['s-president', 's-vicePresident', 's-planningHead', 's-planningMember'])
      assert.equal((await makePeriod(s, PERIOD, user)).status, 403, user)
    assert.equal((await makePeriod(s, PERIOD, 's-ended')).status, 403)
    assert.equal((await makePeriod(s, PERIOD, 'o-financeMember')).status, 403)
    assert.equal((await s.api.post(`${root(s)}/fiscal-periods`, PERIOD)).status, 401)
    assert.equal(await s.count('SELECT count(*) AS n FROM fiscal_period'), 0)
    const response = await makePeriod(s, { ...PERIOD, name: `  ${PERIOD.name} ` })
    assert.equal(response.status, 201)
    const view = await viewOf(response)
    assert.deepEqual(
      [view.period?.name, view.period?.startsOn, view.period?.endsOn, view.items, view.suggested],
      [PERIOD.name, PERIOD.startsOn, PERIOD.endsOn, [], null],
    )
    assert.equal(await s.count('SELECT count(*) AS n FROM budget'), 1)
    assert.equal(await s.versions(view.period!.id), 1)
    const read = await viewOf(await s.api.get(`${root(s)}/budget`, 's-plain'))
    assert.equal(read.period?.id, view.period!.id)
  }),
)

test(
  '기간 입력: 상한은 받고 상한+1, 날짜 순서, 모르는 키, 빈 값은 400이며 아무것도 생기지 않는다',
  runPurchases(async s => {
    const bad: [string, unknown][] = [
      ['이름 없음', { startsOn: '2026-01-01', endsOn: '2026-06-30' }],
      ['빈 이름', { ...PERIOD, name: '' }],
      ['공백 이름', { ...PERIOD, name: ' \n ' }],
      ['이름 21자', { ...PERIOD, name: emoji(21) }],
      ['이름 NUL', { ...PERIOD, name: 'a\u0000' }],
      ['이름 서러게이트', { ...PERIOD, name: 'a\uD800' }],
      ['시작일 없음', { name: 'a', endsOn: '2026-06-30' }],
      ['끝일 없음', { name: 'a', startsOn: '2026-06-30' }],
      ['끝일이 앞', { name: 'a', startsOn: '2026-06-30', endsOn: '2026-06-29' }],
      ['끝일이 같음', { name: 'a', startsOn: '2026-06-30', endsOn: '2026-06-30' }],
      ['없는 날짜', { name: 'a', startsOn: '2026-02-30', endsOn: '2026-12-30' }],
      ['시각', { name: 'a', startsOn: '2026-01-01T00:00', endsOn: '2026-12-30' }],
      ['모르는 키', { ...PERIOD, extra: 1 }],
      ['이전 기간 키', { ...PERIOD, previousPeriodId: s.council.councilId }],
    ]
    for (const [label, body] of bad) {
      const response = await makePeriod(s, body)
      assert.equal(response.status, 400, label)
      assert.equal(await errorOf(response), 'INVALID_INPUT', label)
    }
    assert.equal(await s.count('SELECT count(*) AS n FROM fiscal_period'), 0)
    assert.equal((await makePeriod(s, { ...PERIOD, name: emoji(20) })).status, 201)
  }),
)

test(
  '같은 이름이나 겹치는 기간(양 끝 포함)은 409이고 붙어 있는 기간과 다른 학생회의 같은 기간은 된다',
  runPurchases(async s => {
    assert.equal((await makePeriod(s)).status, 201)
    const conflict = [
      ['같은 이름', { ...PERIOD, startsOn: '2027-01-01', endsOn: '2027-02-28' }],
      ['끝날이 맞닿음', { name: 'a', startsOn: '2026-12-31', endsOn: '2027-02-28' }],
      ['시작일이 맞닿음', { name: 'b', startsOn: '2026-06-01', endsOn: '2026-09-01' }],
      ['안에 들어감', { name: 'c', startsOn: '2026-10-01', endsOn: '2026-10-31' }],
      ['감쌈', { name: 'd', startsOn: '2026-01-01', endsOn: '2027-12-31' }],
    ] as const
    for (const [label, body] of conflict) {
      const response = await makePeriod(s, body)
      assert.equal(response.status, 409, label)
      assert.equal(await errorOf(response), 'FISCAL_PERIOD_CONFLICT', label)
    }
    assert.equal(await s.count('SELECT count(*) AS n FROM fiscal_period'), 1)
    assert.equal(
      (await makePeriod(s, { name: 'e', startsOn: '2027-01-01', endsOn: '2027-06-30' })).status,
      201,
    )
    assert.equal(
      (await makePeriod(s, { name: 'f', startsOn: '2026-03-01', endsOn: '2026-08-31' })).status,
      201,
    )
    const url = `/api/organizations/${s.other.councilId}/fiscal-periods`
    assert.equal((await s.api.post(url, PERIOD, 'o-financeMember')).status, 201)
  }),
)

test(
  '항목은 오늘이 든 기간에 더하고 목적순으로 보인다. 기간이 없으면 409이다',
  runPurchases(async s => {
    const none = await makeItem(s, { purpose: '소모품', amount: 1000 })
    assert.equal(none.status, 409)
    assert.equal(await errorOf(none), 'NO_FISCAL_PERIOD')
    await makePeriod(s)
    for (const user of ['s-president', 's-planningMember', 'o-financeMember'])
      assert.equal((await makeItem(s, { purpose: 'a', amount: 1 }, user)).status, 403, user)
    assert.equal(
      (await s.api.post(`${root(s)}/budget-items`, { purpose: 'a', amount: 1 })).status,
      401,
    )
    await makeItem(s, { purpose: ' 행사 ', amount: 500000 })
    const response = await makeItem(s, { purpose: '소모품', amount: 0 })
    assert.equal(response.status, 201)
    const view = await viewOf(response)
    assert.deepEqual(
      view.items.map(item => [item.purpose, item.amount]),
      [
        ['소모품', 0],
        ['행사', 500000],
      ],
    )
    for (const item of view.items) assert.equal(await s.versions(item.id), 1)
    const read = await viewOf(await s.api.get(`${root(s)}/budget`, 's-plain'))
    assert.deepEqual(read.items, view.items)
  }),
)

test(
  '항목 입력: 상한은 받고 상한+1, 음수, 소수, 문자, 모르는 키는 400이다',
  runPurchases(async s => {
    await makePeriod(s)
    const before = () => s.count('SELECT count(*) AS n FROM budget_item')
    const bad: [string, unknown][] = [
      ['목적 없음', { amount: 1 }],
      ['빈 목적', { purpose: '', amount: 1 }],
      ['공백 목적', { purpose: '  ', amount: 1 }],
      ['목적 101자', { purpose: emoji(101), amount: 1 }],
      ['목적 NUL', { purpose: 'a\u0000', amount: 1 }],
      ['목적 서러게이트', { purpose: 'a\uD800', amount: 1 }],
      ['금액 없음', { purpose: 'a' }],
      ['금액 음수', { purpose: 'a', amount: -1 }],
      ['금액 소수', { purpose: 'a', amount: 1.5 }],
      ['금액 글자', { purpose: 'a', amount: '1' }],
      ['금액 10억+1', { purpose: 'a', amount: 1_000_000_001 }],
      ['모르는 키', { purpose: 'a', amount: 1, type: 'income' }],
    ]
    for (const [label, body] of bad) {
      const response = await makeItem(s, body)
      assert.equal(response.status, 400, label)
      assert.equal(await errorOf(response), 'INVALID_INPUT', label)
    }
    assert.equal(await before(), 0)
    assert.equal((await makeItem(s, { purpose: emoji(100), amount: 1_000_000_000 })).status, 201)
  }),
)

test(
  '오늘(한국)이 든 기간은 한국 자정 ±1초로 갈린다',
  runPurchases(async s => {
    await makePeriod(s, { ...PERIOD, endsOn: '2026-11-30' })
    const at = async (iso: string) => {
      s.setNow(new Date(iso))
      return (await viewOf(await s.api.get(`${root(s)}/budget`, FINANCE))).period
    }
    assert.ok(await at('2026-11-30T14:59:59Z'))
    assert.equal(await at('2026-11-30T15:00:00Z'), null)
    assert.equal(await at('2026-08-31T14:59:59Z'), null)
    assert.ok(await at('2026-08-31T15:00:00Z'))
    s.setNow(new Date('2026-12-01T00:00:00Z'))
    const none = await makeItem(s, { purpose: 'a', amount: 1 })
    assert.equal(await errorOf(none), 'NO_FISCAL_PERIOD')
  }),
)
