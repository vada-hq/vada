import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BudgetResponse, PurchaseRequestDetail } from '@vada/contracts'
import { createRecord } from '../records/records.js'
import {
  detailOf,
  endpointOf,
  errorOf,
  MISSING,
  runPurchases,
  type PurchaseKit,
} from '../test-support/purchases.js'

const FINANCE = 's-financeMember'
const emoji = (n: number) => '😀'.repeat(n)

// 기간과 지출 항목 둘을 두고, 품목 둘짜리 요청을 낸다. 알림 기록은 비워 결재가 만든 것만 남게 한다.
async function prepare(s: PurchaseKit, user = 's-planningMember', endsOn = '2026-12-31') {
  const root = `/api/organizations/${s.council.councilId}`
  await s.api.post(
    `${root}/fiscal-periods`,
    { name: `2학기 ${endsOn}`, startsOn: '2026-09-01', endsOn },
    FINANCE,
  )
  // 한 시험에서 여러 번 부르면 두 번째부터는 기간과 같은 이름의 항목이 이미 있어 막힌다(같은 이름 막기, DEC-92). 있는 것을 읽어 쓴다.
  await s.api.post(`${root}/budget-items`, { purpose: '소모품', amount: 100000 }, FINANCE)
  await s.api.post(`${root}/budget-items`, { purpose: '행사', amount: 200000 }, FINANCE)
  const view = (await (await s.api.get(`${root}/budget`, FINANCE)).json()) as BudgetResponse
  const request = await s.made(
    {
      title: '마커와 자석',
      items: [
        { name: '마커', quantity: 3 },
        { name: '자석', quantity: 2 },
      ],
    },
    user,
  )
  s.calls.length = 0
  const [first, second] = request.items
  return { request, items: view.items, first: first!.id, second: second!.id }
}
type Prepared = Awaited<ReturnType<typeof prepare>>

const approve = (p: Prepared, id: string, extra: object = {}) => ({
  lineItemId: id,
  outcome: 'approved',
  amount: 15000,
  budgetItemId: p.items[0]!.id,
  ...extra,
})
const reject = (id: string, reason = '너무 비싸요') => ({
  lineItemId: id,
  outcome: 'rejected',
  reason,
})
const decide = (s: PurchaseKit, p: Prepared, decisions: unknown, user = FINANCE) =>
  s.api.post(`${s.base}/${p.request.id}/decisions`, { decisions }, user)
const approvals = (s: PurchaseKit) => s.count('SELECT count(*) AS n FROM approval')

test(
  '재정부가 품목마다 승인하고 반려한다: 금액과 예산 항목이 저장되고 결재 기록과 판이 생긴다',
  runPurchases(async s => {
    const p = await prepare(s)
    const response = await decide(s, p, [approve(p, p.first)])
    assert.equal(response.status, 200)
    const half = await detailOf(response)
    assert.equal(half.status, 'pending')
    const [one, two] = half.items
    assert.deepEqual(
      [one!.status, one!.amount, one!.budgetItem?.purpose, two!.status, two!.amount],
      ['approved', 15000, '소모품', 'pending', null],
    )
    assert.equal(await s.versions(p.first), 2)
    assert.equal(half.decisions.length, 1)
    assert.deepEqual(half.decisions[0]!.by?.name, 's financeMember')
    assert.equal(half.decisions[0]!.reason, null)
    const done = await detailOf(await decide(s, p, [reject(p.second, ' 사유 ')]))
    assert.equal(done.status, 'partial')
    assert.deepEqual(
      done.decisions.map(item => [item.outcome, item.reason]),
      [
        ['approved', null],
        ['rejected', '사유'],
      ],
    )
    assert.equal(await s.versions(p.second), 1)
    assert.deepEqual(done.actions, [])
  }),
)

test(
  '모두 승인은 한 번에 보낸 품목이 모두 되고, 모두 반려면 반려 상태다',
  runPurchases(async s => {
    const p = await prepare(s)
    const both = await detailOf(
      await decide(s, p, [
        approve(p, p.first),
        approve(p, p.second, { amount: 1, budgetItemId: p.items[1]!.id }),
      ]),
    )
    assert.equal(both.status, 'approved')
    assert.deepEqual(
      both.items.map(item => [item.amount, item.budgetItem?.purpose]),
      [
        [15000, '소모품'],
        [1, '행사'],
      ],
    )
    const q = await prepare(s)
    const none = await detailOf(await decide(s, q, [reject(q.first), reject(q.second)]))
    assert.equal(none.status, 'rejected')
  }),
)

test(
  '결과 알림: 마지막 대기 품목이 결재되면 요청한 사람에게 기록 하나와 알림 한 번, 대기가 남으면 없다',
  runPurchases(async s => {
    const p = await prepare(s)
    const before = await s.notices()
    await decide(s, p, [approve(p, p.first)])
    await s.settled()
    assert.equal(await s.notices(), before)
    assert.equal(s.calls.length, 0)
    await decide(s, p, [reject(p.second)])
    await s.settled()
    assert.equal(await s.notices(), before + 1)
    const [row] = (
      await s.pg.query<{ type: string; recipient_id: string; record_id: string }>(
        "SELECT type, recipient_id, record_id FROM notification WHERE type = 'changed'",
      )
    ).rows
    assert.deepEqual(
      [row!.type, row!.recipient_id, row!.record_id],
      ['changed', s.council.people.planningMember.memberId, p.request.id],
    )
    assert.equal(s.calls.length, 1)
    const [target, message] = s.calls[0]!
    assert.equal(target.endpoint, endpointOf('s-planningMember'))
    assert.deepEqual(message, {
      title: '구매 요청이 일부 승인됐어요',
      body: 's financeMember: 마커와 자석',
      url: `/purchases/${s.council.councilId}/${p.request.id}`,
      tag: `request:${p.request.id}`,
    })
  }),
)

test(
  '결과 문구는 승인, 반려, 일부 승인으로 갈리고 자기 요청의 결재는 알림이 없다',
  runPurchases(async s => {
    const titles: string[] = []
    for (const make of [
      (p: Prepared) => [approve(p, p.first), approve(p, p.second)],
      (p: Prepared) => [reject(p.first), reject(p.second)],
    ]) {
      const p = await prepare(s)
      await decide(s, p, make(p))
      await s.settled()
      titles.push(s.calls.at(-1)![1].title)
      s.calls.length = 0
    }
    assert.deepEqual(titles, ['구매 요청이 승인됐어요', '구매 요청이 반려됐어요'])
    const own = await prepare(s, FINANCE)
    const notices = await s.notices()
    await decide(s, own, [approve(own, own.first), approve(own, own.second)])
    await s.settled()
    assert.equal(s.calls.length, 0)
    assert.equal(await s.notices(), notices)
  }),
)

test(
  '재정부는 자기 요청도 결재하고, 요청한 사람이 이미 운영진이 아니면 알림이 없다',
  runPurchases(async s => {
    const own = await prepare(s, FINANCE)
    const done = await detailOf(await decide(s, own, [approve(own, own.first), reject(own.second)]))
    assert.equal(done.status, 'partial')
    const p = await prepare(s, 's-plain')
    await s.pg.query(
      'UPDATE council_membership SET ends_at = clock_timestamp() WHERE member_id = $1',
      [s.council.people.plain.memberId],
    )
    const notices = await s.notices()
    assert.equal((await decide(s, p, [approve(p, p.first), approve(p, p.second)])).status, 200)
    await s.settled()
    assert.equal(await s.notices(), notices)
    assert.equal(s.calls.length, 0)
  }),
)

test(
  '재정부가 아니면 403이고 로그인하지 않으면 401이며 기록이 생기지 않는다',
  runPurchases(async s => {
    const p = await prepare(s)
    for (const user of [
      's-president',
      's-vicePresident',
      's-planningHead',
      's-planningMember',
      's-plain',
    ])
      assert.equal((await decide(s, p, [reject(p.first)], user)).status, 403, user)
    assert.equal((await decide(s, p, [reject(p.first)], 's-ended')).status, 403)
    assert.equal((await decide(s, p, [reject(p.first)], 'o-financeMember')).status, 403)
    assert.equal(
      (await s.api.post(`${s.base}/${p.request.id}/decisions`, { decisions: [reject(p.first)] }))
        .status,
      401,
    )
    assert.equal(await approvals(s), 0)
    assert.equal(await s.versions(p.first), 1)
  }),
)

test(
  '없는 요청, 다른 학생회의 요청, 형식이 틀린 번호는 404이다',
  runPurchases(async s => {
    const p = await prepare(s)
    const url = (id: string) => `${s.base}/${id}/decisions`
    const body = { decisions: [reject(p.first)] }
    assert.equal((await s.api.post(url(MISSING), body, FINANCE)).status, 404)
    assert.equal((await s.api.post(url('not-a-uuid'), body, FINANCE)).status, 404)
    const theirs = `/api/organizations/${s.other.councilId}/purchase-requests/${p.request.id}/decisions`
    assert.equal((await s.api.post(theirs, body, 'o-financeMember')).status, 404)
    assert.equal(await approvals(s), 0)
  }),
)

test(
  '입력: 금액과 항목 없는 승인, 공백 사유, 상한+1, 중복, 모르는 키는 400이다',
  runPurchases(async s => {
    const p = await prepare(s)
    const base = approve(p, p.first)
    const bad: [string, unknown][] = [
      ['결재 없음', undefined],
      ['빈 목록', []],
      ['21줄', Array.from({ length: 21 }, () => base)],
      ['같은 품목 둘', [base, reject(p.first)]],
      ['금액 없음', [{ ...base, amount: undefined }]],
      ['금액 0', [approve(p, p.first, { amount: 0 })]],
      ['금액 음수', [approve(p, p.first, { amount: -1 })]],
      ['금액 소수', [approve(p, p.first, { amount: 1.5 })]],
      ['금액 10억+1', [approve(p, p.first, { amount: 1_000_000_001 })]],
      ['항목 없음', [{ ...base, budgetItemId: undefined }]],
      ['항목 번호 형식', [approve(p, p.first, { budgetItemId: 'x' })]],
      ['품목 번호 형식', [approve(p, 'x')]],
      ['반려 사유 없음', [{ lineItemId: p.first, outcome: 'rejected' }]],
      ['반려 사유 빈칸', [reject(p.first, '')]],
      ['반려 사유 공백만', [reject(p.first, '  \n ')]],
      ['반려 사유 501자', [reject(p.first, emoji(501))]],
      ['반려 사유 NUL', [reject(p.first, 'a\u0000')]],
      ['반려 사유 서러게이트', [reject(p.first, 'a\uD800')]],
      ['승인에 사유', [{ ...base, reason: '왜' }]],
      ['반려에 금액', [{ ...reject(p.first), amount: 1 }]],
      ['결과 모름', [{ ...base, outcome: 'audited' }]],
      ['모르는 키', [{ ...base, extra: 1 }]],
    ]
    for (const [label, decisions] of bad) {
      const response = await decide(s, p, decisions)
      assert.equal(response.status, 400, label)
      assert.equal(await errorOf(response), 'INVALID_INPUT', label)
    }
    assert.equal(
      (
        await s.api.post(
          `${s.base}/${p.request.id}/decisions`,
          { decisions: [base], x: 1 },
          FINANCE,
        )
      ).status,
      400,
    )
    assert.equal(await approvals(s), 0)
    assert.equal((await decide(s, p, [reject(p.first, emoji(500))])).status, 200)
  }),
)

test(
  '이미 결재한 품목은 409 LINE_ITEM_DECIDED이고 같이 보낸 품목도 결재되지 않는다',
  runPurchases(async s => {
    const p = await prepare(s)
    assert.equal((await decide(s, p, [reject(p.first)])).status, 200)
    const again = await decide(s, p, [approve(p, p.second), approve(p, p.first)])
    assert.equal(again.status, 409)
    assert.equal(await errorOf(again), 'LINE_ITEM_DECIDED')
    assert.equal(await approvals(s), 1)
    assert.equal(await s.versions(p.second), 1)
    s.calls.length = 0
    await s.settled()
    assert.equal(s.calls.length, 0)
  }),
)

test(
  '다른 요청의 품목은 409이고 그 요청의 품목은 결재되지 않는다',
  runPurchases(async s => {
    const p = await prepare(s)
    const q = await prepare(s)
    const response = await decide(s, p, [approve(p, p.first), approve(p, q.first)])
    assert.equal(response.status, 409)
    assert.equal(await errorOf(response), 'LINE_ITEM_DECIDED')
    assert.equal(await approvals(s), 0)
    assert.equal(await s.versions(q.first), 1)
  }),
)

test(
  '취소된 요청은 409 REQUEST_CLOSED이고 결재가 시작된 요청은 더 취소되지 않는다',
  runPurchases(async s => {
    const p = await prepare(s)
    await s.api.post(`${s.base}/${p.request.id}/cancel`, {}, 's-planningMember')
    const response = await decide(s, p, [approve(p, p.first)])
    assert.equal(response.status, 409)
    assert.equal(await errorOf(response), 'REQUEST_CLOSED')
    assert.equal(await approvals(s), 0)
    const q = await prepare(s)
    await decide(s, q, [reject(q.first)])
    const cancel = await s.api.post(`${s.base}/${q.request.id}/cancel`, {}, 's-planningMember')
    assert.equal(cancel.status, 409)
  }),
)

test(
  '예산 항목: 다른 학생회, 수입, 지금 기간 밖의 항목은 409 BUDGET_ITEM_INVALID이고 다른 품목도 결재되지 않는다',
  runPurchases(async s => {
    const p = await prepare(s)
    const make = (kind: 'budget_item', councilId: string, budgetId: string, type: string) =>
      s.db.transaction(tx =>
        createRecord(tx, {
          kind,
          councilId,
          actor: null,
          values: { budgetId, type, purpose: '남의 것', amount: '1' },
        }),
      )
    const periodOf = async (councilId: string, name: string, startsOn: string, endsOn: string) =>
      s.db.transaction(async tx => {
        const periodId = await createRecord(tx, {
          kind: 'fiscal_period',
          councilId,
          actor: null,
          values: { name, startsOn, endsOn },
        })
        return createRecord(tx, {
          kind: 'budget',
          councilId,
          actor: null,
          values: { fiscalPeriodId: periodId },
        })
      })
    const mine = (
      await s.pg.query<{ id: string }>(
        'SELECT budget.id FROM budget JOIN record ON record.id = budget.id WHERE record.council_id = $1',
        [s.council.councilId],
      )
    ).rows[0]!.id
    const other = await periodOf(s.other.councilId, '남의 기간', '2026-09-01', '2026-12-31')
    const later = await periodOf(s.council.councilId, '내년', '2027-09-01', '2027-12-31')
    const earlier = await periodOf(s.council.councilId, '작년', '2025-09-01', '2025-12-31')
    const bad = {
      '다른 학생회': await make('budget_item', s.other.councilId, other, 'expense'),
      '수입 항목': await make('budget_item', s.council.councilId, mine, 'income'),
      '다음 기간': await make('budget_item', s.council.councilId, later, 'expense'),
      '지난 기간': await make('budget_item', s.council.councilId, earlier, 'expense'),
      '없는 번호': MISSING,
    }
    for (const [label, budgetItemId] of Object.entries(bad)) {
      const response = await decide(s, p, [
        approve(p, p.first),
        approve(p, p.second, { budgetItemId }),
      ])
      assert.equal(response.status, 409, label)
      assert.equal(await errorOf(response), 'BUDGET_ITEM_INVALID', label)
    }
    assert.equal(await approvals(s), 0)
    assert.equal(await s.versions(p.first), 1)
    assert.equal(await s.versions(p.second), 1)
  }),
)

test(
  '같은 예산 항목을 여러 품목에 쓸 수 있다',
  runPurchases(async s => {
    const p = await prepare(s)
    const response = await decide(s, p, [approve(p, p.first), approve(p, p.second, { amount: 2 })])
    assert.equal(response.status, 200)
    const detail: PurchaseRequestDetail = await detailOf(response)
    assert.deepEqual(
      detail.items.map(item => item.budgetItem?.id),
      [p.items[0]!.id, p.items[0]!.id],
    )
  }),
)

test(
  '승인할 항목의 기간은 한국 자정 ±1초로 갈린다',
  runPurchases(async s => {
    const p = await prepare(s, 's-planningMember', '2026-11-30')
    s.setNow(new Date('2026-11-30T14:59:59Z'))
    assert.equal((await decide(s, p, [approve(p, p.first)])).status, 200)
    s.setNow(new Date('2026-11-30T15:00:00Z'))
    const late = await decide(s, p, [approve(p, p.second)])
    assert.equal(late.status, 409)
    assert.equal(await errorOf(late), 'BUDGET_ITEM_INVALID')
    assert.equal(await approvals(s), 1)
  }),
)
