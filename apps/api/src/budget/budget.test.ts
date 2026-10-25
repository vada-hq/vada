import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BudgetResponse } from '@vada/contracts'
import { createRecord } from '../records/records.js'
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
  '기간을 만들면 바로 앞 기간이 이전 기간으로 잡히고, 사이에 끼운 기간과 첫 기간은 비어 있다. 다른 학생회의 기간은 잡히지 않는다',
  runPurchases(async s => {
    const make = async (name: string, startsOn: string, endsOn: string, user = FINANCE) => {
      const url = user === FINANCE ? root(s) : `/api/organizations/${s.other.councilId}`
      assert.equal(
        (await s.api.post(`${url}/fiscal-periods`, { name, startsOn, endsOn }, user)).status,
        201,
      )
    }
    const previousOf = async () => {
      const { rows } = await s.pg.query<{ name: string; prev: string | null }>(
        'SELECT p.name, q.name AS prev FROM fiscal_period p LEFT JOIN fiscal_period q ON q.id = p.previous_period_id',
      )
      return Object.fromEntries(rows.map(row => [row.name, row.prev]))
    }
    await make('2025', '2025-01-01', '2025-12-31')
    // 다른 학생회의 기간이 내 앞 기간보다 늦게 끝나도 잡히지 않는다.
    await make('남의 2026', '2026-01-01', '2026-06-30', 'o-financeMember')
    await make('2027', '2027-01-01', '2027-12-31')
    // 사이에 끼운 기간은 비고, 뒤 기간의 이전 기간도 그대로다.
    await make('2026', '2026-01-01', '2026-12-31')
    await make('2028', '2028-01-01', '2028-12-31')
    assert.deepEqual(await previousOf(), {
      '2025': null,
      '남의 2026': null,
      '2027': '2025',
      '2026': null,
      '2028': '2027',
    })
  }),
)

test(
  '이전 기간은 가장 늦은 앞 기간만 본다. 그 기간에 이미 다음이 있으면 비운다',
  runPurchases(async s => {
    const make = async (name: string, year: number) =>
      assert.equal(
        (
          await s.api.post(
            `${root(s)}/fiscal-periods`,
            { name, startsOn: `${year}-01-01`, endsOn: `${year}-12-31` },
            FINANCE,
          )
        ).status,
        201,
      )
    const previousOf = async () => {
      const { rows } = await s.pg.query<{ name: string; prev: string | null }>(
        'SELECT p.name, q.name AS prev FROM fiscal_period p LEFT JOIN fiscal_period q ON q.id = p.previous_period_id',
      )
      return Object.fromEntries(rows.map(row => [row.name, row.prev]))
    }
    // 2025 -> 2024 -> 2027(2025에 이음) -> 2026은 비운다. 더 오래된 2024가 다음 없는 채여도 잡지 않는다.
    for (const [name, year] of [
      ['2025', 2025],
      ['2024', 2024],
      ['2027', 2027],
      ['2026', 2026],
    ] as const)
      await make(name, year)
    assert.deepEqual(await previousOf(), {
      '2025': null,
      '2024': null,
      '2027': '2025',
      '2026': null,
    })
  }),
)

test(
  '2027 -> 2025 -> 2026 순서로 만들면 2026은 2025에 이어진다',
  runPurchases(async s => {
    for (const year of [2027, 2025, 2026])
      await s.api.post(
        `${root(s)}/fiscal-periods`,
        { name: `${year}`, startsOn: `${year}-01-01`, endsOn: `${year}-12-31` },
        FINANCE,
      )
    const { rows } = await s.pg.query<{ name: string; prev: string | null }>(
      'SELECT p.name, q.name AS prev FROM fiscal_period p LEFT JOIN fiscal_period q ON q.id = p.previous_period_id',
    )
    assert.deepEqual(Object.fromEntries(rows.map(row => [row.name, row.prev])), {
      '2027': null,
      '2025': null,
      '2026': '2025',
    })
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
    const response = await makeItem(s, { purpose: '소모품', amount: 1 })
    assert.equal(response.status, 201)
    const view = await viewOf(response)
    assert.deepEqual(
      view.items.map(item => [item.purpose, item.amount]),
      [
        ['소모품', 1],
        ['행사', 500000],
      ],
    )
    for (const item of view.items) assert.equal(await s.versions(item.id), 1)
    const read = await viewOf(await s.api.get(`${root(s)}/budget`, 's-plain'))
    assert.deepEqual(read.items, view.items)
  }),
)

test(
  '항목 입력: 상한은 받고 상한+1, 0원, 음수, 소수, 문자, 모르는 키는 400이다',
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
      ['금액 0원', { purpose: 'a', amount: 0 }],
      ['금액 음수', { purpose: 'a', amount: -1 }],
      ['금액 소수', { purpose: 'a', amount: 1.5 }],
      ['금액 글자', { purpose: 'a', amount: '1' }],
      ['금액 10억+1', { purpose: 'a', amount: 1_000_000_001 }],
      ['모르는 키', { purpose: 'a', amount: 1, kind: 'income' }],
      ['모르는 종류', { purpose: 'a', amount: 1, type: 'other' }],
      ['행사 번호 아님', { purpose: 'a', amount: 1, eventId: 'x' }],
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

test(
  '다른 학생회에 오늘이 든 기간이 있어도 내 학생회의 예산은 비어 있고 항목도 더하지 못한다',
  runPurchases(async s => {
    const theirs = `/api/organizations/${s.other.councilId}`
    assert.equal(
      (await s.api.post(`${theirs}/fiscal-periods`, PERIOD, 'o-financeMember')).status,
      201,
    )
    await s.api.post(`${theirs}/budget-items`, { purpose: '남의 것', amount: 5 }, 'o-financeMember')
    const mine = await viewOf(await s.api.get(`${root(s)}/budget`, FINANCE))
    assert.equal(mine.period, null)
    assert.deepEqual(mine.items, [])
    assert.equal(await errorOf(await makeItem(s, { purpose: 'a', amount: 1 })), 'NO_FISCAL_PERIOD')
    const seen = await viewOf(await s.api.get(`${theirs}/budget`, 'o-financeMember'))
    assert.equal(seen.items.length, 1)
  }),
)

test(
  '수입 항목은 종류와 함께 예산 목록에 보인다',
  runPurchases(async s => {
    const view = await viewOf(await makePeriod(s))
    await makeItem(s, { purpose: '지출', amount: 1 })
    const budgetId = (
      await s.pg.query<{ id: string }>('SELECT id FROM budget WHERE fiscal_period_id = $1', [
        view.period!.id,
      ])
    ).rows[0]!.id
    await s.db.transaction(tx =>
      createRecord(tx, {
        kind: 'budget_item',
        councilId: s.council.councilId,
        actor: null,
        values: { budgetId, type: 'income', purpose: '수입', amount: '9' },
      }),
    )
    const read = await viewOf(await s.api.get(`${root(s)}/budget`, FINANCE))
    assert.deepEqual(
      read.items.map(item => [item.purpose, item.type]),
      [
        ['수입', 'income'],
        ['지출', 'expense'],
      ],
    )
  }),
)

test(
  '기간을 주면 그 기간의 예산을 준다. 끝난 기간도 되고, 다른 학생회 기간은 404, 틀린 번호와 모르는 키는 400이다',
  runPurchases(async s => {
    const PAST = { name: '2026 1학기', startsOn: '2026-03-01', endsOn: '2026-08-31' }
    const inPast = new Date('2026-05-01T03:00:00Z')
    const today = new Date('2026-10-25T03:00:00Z')
    const theirs = `/api/organizations/${s.other.councilId}`
    s.setNow(inPast)
    const past = (await viewOf(await makePeriod(s, PAST))).period!
    await makeItem(s, { purpose: '1학기 학생회비', amount: 7, type: 'income' })
    const otherView = await s.api.post(`${theirs}/fiscal-periods`, PAST, 'o-financeMember')
    const other = (await viewOf(otherView)).period!
    const theirItem = { purpose: '남의 것', amount: 5, type: 'income' }
    await s.api.post(`${theirs}/budget-items`, theirItem, 'o-financeMember')
    s.setNow(today)
    const current = (await viewOf(await makePeriod(s))).period!
    await makeItem(s, { purpose: '2학기 학생회비', amount: 9, type: 'income' })
    const read = (query: string, user = 's-plain') => s.api.get(`${root(s)}/budget${query}`, user)
    const view = await viewOf(await read(`?period=${past.id}`))
    assert.deepEqual(
      [view.period?.id, view.items.map(item => item.purpose)],
      [past.id, ['1학기 학생회비']],
    )
    const upper = await viewOf(await read(`?period=${current.id.toUpperCase()}`))
    assert.deepEqual(
      upper.items.map(item => item.purpose),
      ['2학기 학생회비'],
    )
    assert.equal((await viewOf(await read(''))).period?.id, current.id)
    const theirRead = await read(`?period=${other.id}`, FINANCE)
    assert.equal(theirRead.status, 404)
    assert.equal(await errorOf(theirRead), 'NOT_FOUND')
    const bad = ['?period=x', '?period=', `?period=${past.id}&period=${past.id}`, '?extra=1']
    for (const query of bad) {
      const response = await read(query)
      assert.equal(response.status, 400, query)
      assert.equal(await errorOf(response), 'INVALID_INPUT', query)
    }
    assert.equal((await read(`?period=${past.id}`, 'o-president')).status, 403)
    assert.equal((await s.api.get(`${root(s)}/budget?period=${past.id}`)).status, 401)
  }),
)
