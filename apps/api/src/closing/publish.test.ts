import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  closingPath,
  earn,
  errorOf,
  FINANCE,
  publish,
  readClosing,
  reopen,
  spend,
  twoPeriods,
  writesOf,
} from '../test-support/closing.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'

// 결산 공개와 다시 열기(기능 009 조각 4, DEC-70). 앞 기간 2026-03-01~08-31, 뒤 기간 2026-09-01~2026-11-30.

const DAY_AFTER_FIRST = new Date('2026-08-31T15:00:00Z')
const LAST_SECOND_OF_FIRST = new Date('2026-08-31T14:59:59Z')
const LATER = new Date('2026-12-01T00:00:00Z')

type Rows = Record<string, unknown>[]
type Closing = Awaited<ReturnType<typeof readClosing>>
const carryovers = async (t: SettlementKit) =>
  (
    await t.pg.query(
      `SELECT fiscal_period_id, amount::int AS amount, received_on::text AS on, description, account_id, budget_item_id, cancelled_at IS NOT NULL AS cancelled
       FROM income WHERE source = 'carryover' ORDER BY cancelled_at NULLS FIRST, id`,
    )
  ).rows as Rows
const closings = async (t: SettlementKit) =>
  (await t.pg.query('SELECT c.id, c.fiscal_period_id FROM account_closing c')).rows as {
    id: string
    fiscal_period_id: string
  }[]
const closingOfResponse = async (response: Response) =>
  ((await response.json()) as { closing: Closing }).closing

async function incomeAndExpense(t: SettlementKit, p: Awaited<ReturnType<typeof twoPeriods>>) {
  await earn(t, p.first, 100000, { receivedOn: '2026-05-10' })
  await spend(t, '2026-05-11T03:00:00Z', 30000)
  t.setNow(DAY_AFTER_FIRST)
}

// 앞 기간에 입금을 확인했고 완료하지 않은 행사 하나
async function pendingEvent(t: SettlementKit, startsAt: Date) {
  const event = await t.event({ startsAt })
  const registration = await t.registration(await t.form(event))
  await t.deposit(registration, { confirmedAt: new Date('2026-06-11T03:00:00Z') })
  return event
}

test(
  '공개: 재정부만, 결산 기록과 판 1, 다음 기간 이월금(남은 돈, 시작일, 내용)이 한 거래에 생기고 응답은 그 결산서다',
  withSettlement(async t => {
    const p = await twoPeriods(t)
    await incomeAndExpense(t, p)
    for (const user of ['s-president', 's-planningMember'])
      assert.equal((await publish(t, p.first, user)).status, 403, user)
    assert.equal((await t.api.post(`${closingPath(t, p.first)}/publish`, {})).status, 401)
    const unknownKey = await t.api.post(`${closingPath(t, p.first)}/publish`, { x: 1 }, FINANCE)
    assert.equal(unknownKey.status, 400)
    assert.equal((await closings(t)).length, 0)
    const response = await publish(t, p.first)
    assert.equal(response.status, 200)
    const closing = await closingOfResponse(response)
    assert.equal(closing.status, 'published')
    assert.equal(closing.remaining, 70000)
    assert.ok(closing.actions.includes('closing.reopen'))
    const [row] = await closings(t)
    assert.equal(row?.fiscal_period_id, p.first)
    const versions = await t.pg.query(
      'SELECT count(*)::int AS n FROM record_version WHERE record_id = $1',
      [row?.id],
    )
    assert.equal((versions.rows[0] as { n: number }).n, 1)
    assert.deepEqual(await carryovers(t), [
      {
        fiscal_period_id: p.next,
        amount: 70000,
        on: '2026-09-01',
        description: '2026-1 이월금',
        account_id: null,
        budget_item_id: null,
        cancelled: false,
      },
    ])
    // 뒤 기간 결산서가 그 이월금을 전기 이월금으로 본다
    const second = await readClosing(t, p.next)
    assert.equal(second.income.carryover, 70000)
    assert.equal(second.remaining, 70000)
    assert.equal(await errorOf(await publish(t, p.first)), 'CLOSING_PUBLISHED')
  }),
)

test(
  '공개 조건: 끝일 23:59:59는 PERIOD_NOT_ENDED이고 다음 날 0시부터 된다. 남은 돈이 0원이어도 0원 이월금이 생긴다',
  withSettlement(async t => {
    const p = await twoPeriods(t)
    t.setNow(LAST_SECOND_OF_FIRST)
    assert.equal(await errorOf(await publish(t, p.first)), 'PERIOD_NOT_ENDED')
    assert.equal(await errorOf(await publish(t, p.next)), 'PERIOD_NOT_ENDED')
    assert.equal((await closings(t)).length, 0)
    t.setNow(DAY_AFTER_FIRST)
    assert.equal((await publish(t, p.first)).status, 200)
    assert.deepEqual(
      (await carryovers(t)).map(row => [row.amount, row.cancelled]),
      [[0, false]],
    )
  }),
)

test(
  '공개 조건: 이전 기간 미공개, 남은 돈 음수, 완료하지 않은 행사의 입금은 409이고 아무것도 바뀌지 않는다',
  withSettlement(async t => {
    const p = await twoPeriods(t)
    t.setNow(LATER)
    const before = await writesOf(t)
    assert.equal(await errorOf(await publish(t, p.next)), 'PREVIOUS_PERIOD_OPEN')
    await spend(t, '2026-05-11T03:00:00Z', 5000)
    const afterSpend = await writesOf(t)
    assert.equal(await errorOf(await publish(t, p.first)), 'CLOSING_NEGATIVE')
    assert.equal(await writesOf(t), afterSpend)
    assert.notEqual(before, afterSpend)
    await earn(t, p.first, 100000, { receivedOn: '2026-05-10' })
    // 끝 날짜가 그 기간 안인 행사의 입금이 있는데 완료하지 않았다
    const event = await pendingEvent(t, new Date('2026-06-10T00:00:00Z'))
    const snapshot = await writesOf(t)
    assert.equal(await errorOf(await publish(t, p.first)), 'FEE_INCOME_PENDING')
    assert.equal(await writesOf(t), snapshot)
    // 날짜 미정 행사도 막는다
    await t.pg.query('UPDATE event SET starts_at = NULL, ends_at = NULL WHERE id = $1', [event])
    assert.equal(await errorOf(await publish(t, p.first)), 'FEE_INCOME_PENDING')
    // 끝 날짜가 뒤 기간인 행사의 입금은 선수금이라 막지 않는다
    await t.pg.query("UPDATE event SET starts_at = '2026-09-10T00:00:00Z' WHERE id = $1", [event])
    assert.equal((await publish(t, p.first)).status, 200)
  }),
)

test(
  '끝 날짜가 끝일 23:59:59인 행사는 막고 다음 날 0시인 행사는 막지 않는다',
  withSettlement(async t => {
    const p = await twoPeriods(t)
    t.setNow(new Date('2026-09-02T00:00:00Z'))
    await pendingEvent(t, LAST_SECOND_OF_FIRST)
    assert.equal(await errorOf(await publish(t, p.first)), 'FEE_INCOME_PENDING')
    await t.pg.query("UPDATE event SET starts_at = '2026-08-31T15:00:00Z'")
    assert.equal((await publish(t, p.first)).status, 200)
  }),
)

test(
  '다시 열기: 사유가 꼭 있고, 공개 전이면 409, 다음 기간이 공개됐으면 409. 열면 판과 이월금 취소에 사유가 남고 다시 공개하면 새 이월금이 생긴다',
  withSettlement(async t => {
    const p = await twoPeriods(t)
    await incomeAndExpense(t, p)
    assert.equal(await errorOf(await reopen(t, p.first)), 'CLOSING_NOT_PUBLISHED')
    await publish(t, p.first)
    assert.equal((await reopen(t, p.first, '지출 정정', 's-president')).status, 403)
    for (const body of [{}, { reason: '  ' }, { reason: 'x', extra: 1 }])
      assert.equal(
        (await t.api.post(`${closingPath(t, p.first)}/reopen`, body, FINANCE)).status,
        400,
      )
    assert.equal((await reopen(t, '00000000-0000-4000-8000-000000000000')).status, 404)
    const [row] = await closings(t)
    const response = await reopen(t, p.first, '지출 정정')
    assert.equal(response.status, 200)
    const closing = await closingOfResponse(response)
    assert.equal(closing.status, 'draft')
    assert.equal(closing.publishedAt, null)
    const versions = (
      await t.pg.query(
        'SELECT reason FROM record_version WHERE record_id = $1 ORDER BY version_no',
        [row?.id],
      )
    ).rows as { reason: string | null }[]
    assert.deepEqual(
      versions.map(version => version.reason),
      [null, '지출 정정'],
    )
    assert.deepEqual(
      (await carryovers(t)).map(item => item.cancelled),
      [true],
    )
    const cancelReason = await t.pg.query(
      `SELECT v.reason FROM record_version v JOIN income i ON i.id = v.record_id WHERE i.source = 'carryover' ORDER BY v.version_no DESC LIMIT 1`,
    )
    assert.equal((cancelReason.rows[0] as { reason: string }).reason, '지출 정정')
    // 다시 공개하면 사유 없이 되고 새 이월금이 생긴다(결산 기록은 하나다)
    assert.equal((await publish(t, p.first)).status, 200)
    assert.equal((await closings(t)).length, 1)
    assert.deepEqual(
      (await carryovers(t)).map(item => [item.amount, item.cancelled]),
      [
        [70000, false],
        [70000, true],
      ],
    )
    // 다음 기간이 공개되면 앞 기간을 다시 열 수 없고, 다음 기간부터 열면 된다
    t.setNow(LATER)
    assert.equal((await publish(t, p.next)).status, 200)
    assert.equal(await errorOf(await reopen(t, p.first)), 'NEXT_PERIOD_CLOSED')
    assert.equal((await reopen(t, p.next)).status, 200)
    assert.equal((await reopen(t, p.first)).status, 200)
  }),
)

test(
  '다음 기간을 나중에 만들면 그때 이월금이 생기고, 공개 전 기간 뒤에 만들면 생기지 않는다',
  withSettlement(async t => {
    const first = await t.make(t.council, 'fiscal_period', {
      name: '2026-1',
      startsOn: '2026-03-01',
      endsOn: '2026-08-31',
    })
    await t.make(t.council, 'budget', { fiscalPeriodId: first })
    await earn(t, first, 50000, { receivedOn: '2026-05-10' })
    t.setNow(DAY_AFTER_FIRST)
    assert.equal((await publish(t, first)).status, 200)
    assert.deepEqual(await carryovers(t), [])
    const periods = `/api/organizations/${t.council.councilId}/fiscal-periods`
    const created = await t.api.post(
      periods,
      { name: '2026-2', startsOn: '2026-09-01', endsOn: '2027-02-28' },
      FINANCE,
    )
    assert.equal(created.status, 201)
    assert.deepEqual(
      (await carryovers(t)).map(row => [row.amount, row.on, row.description]),
      [[50000, '2026-09-01', '2026-1 이월금']],
    )
    // 이전 기간이 공개되지 않은 채 만든 기간에는 이월금이 없다
    const third = await t.api.post(
      periods,
      { name: '2027-1', startsOn: '2027-03-01', endsOn: '2027-08-31' },
      FINANCE,
    )
    assert.equal(third.status, 201)
    assert.equal((await carryovers(t)).length, 1)
  }),
)

test(
  'actions: 공개는 되는 때만(끝나지 않음, 이전 기간 미공개, 남은 돈 음수, 미완료 행사 입금이면 없다), 다시 열기는 다음 기간이 공개되면 없다',
  withSettlement(async t => {
    const p = await twoPeriods(t)
    const actionsOf = async (periodId: string) => (await readClosing(t, periodId)).actions
    t.setNow(LAST_SECOND_OF_FIRST)
    assert.ok(!(await actionsOf(p.first)).includes('closing.publish'), '끝나지 않음')
    t.setNow(LATER)
    assert.ok(!(await actionsOf(p.next)).includes('closing.publish'), '이전 기간 미공개')
    await spend(t, '2026-05-11T03:00:00Z', 5000)
    assert.ok(!(await actionsOf(p.first)).includes('closing.publish'), '남은 돈 음수')
    await earn(t, p.first, 100000, { receivedOn: '2026-05-10' })
    const event = await pendingEvent(t, new Date('2026-06-10T00:00:00Z'))
    assert.ok(!(await actionsOf(p.first)).includes('closing.publish'), '미완료 행사 입금')
    await t.completion(event, 'completed', new Date('2026-06-12T00:00:00Z'))
    assert.ok((await actionsOf(p.first)).includes('closing.publish'))
    assert.ok(!(await actionsOf(p.first)).includes('closing.reopen'))
    assert.equal((await publish(t, p.first)).status, 200)
    assert.ok((await actionsOf(p.first)).includes('closing.reopen'))
    assert.ok(!(await actionsOf(p.first)).includes('closing.publish'))
    assert.equal((await publish(t, p.next)).status, 200)
    assert.ok(!(await actionsOf(p.first)).includes('closing.reopen'), '다음 기간 공개')
    assert.ok((await actionsOf(p.next)).includes('closing.reopen'))
  }),
)
