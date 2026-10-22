import assert from 'node:assert/strict'
import { test } from 'node:test'
import { errorOf, twoPeriods } from '../test-support/closing.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'

// 참가비 수입의 받은 날은 마지막 입금 확인일과 행사 끝 날짜(한국) 가운데 늦은 날이다(DEC-70이 DEC-68을 고쳤다).

const complete = (t: SettlementKit, event: string) =>
  t.api.post(
    `/api/organizations/${t.council.councilId}/events/${event}/complete`,
    {},
    's-president',
  )
const feeIncomes = async (t: SettlementKit) =>
  (
    await t.pg.query(
      `SELECT received_on::text AS on, fiscal_period_id FROM income WHERE source = 'participation_fee' ORDER BY id`,
    )
  ).rows as { on: string; fiscal_period_id: string }[]

// 사전 모집: 입금은 앞 기간(8월), 행사는 뒤 기간(9월 10일 시작, 11일 끝)
async function preRegistered(
  t: SettlementKit,
  endsAt: Date | null = new Date('2026-09-11T06:00:00Z'),
) {
  const p = await twoPeriods(t)
  const event = await t.event({ startsAt: new Date('2026-09-10T00:00:00Z'), endsAt })
  const registration = await t.registration(await t.form(event))
  await t.deposit(registration, { confirmedAt: new Date('2026-08-20T03:00:00Z') })
  t.setNow(new Date('2026-09-12T00:00:00Z'))
  return { ...p, event }
}

test(
  '사전 모집 행사: 받은 날이 마지막 입금 확인일이 아니라 행사 끝 날짜라 행사가 열린 기간의 수입이 된다',
  withSettlement(async t => {
    const p = await preRegistered(t)
    assert.equal((await complete(t, p.event)).status, 200)
    assert.deepEqual(await feeIncomes(t), [{ on: '2026-09-11', fiscal_period_id: p.next }])
  }),
)

test(
  '끝 시각이 없으면 시작 시각의 한국 날짜를 쓰고, 입금이 더 늦으면 입금 확인일을 쓴다',
  withSettlement(async t => {
    const p = await preRegistered(t, null)
    assert.equal((await complete(t, p.event)).status, 200)
    assert.deepEqual(await feeIncomes(t), [{ on: '2026-09-10', fiscal_period_id: p.next }])
    const later = await t.event({ startsAt: new Date('2026-09-10T00:00:00Z') })
    const registration = await t.registration(await t.form(later))
    await t.deposit(registration, { confirmedAt: new Date('2026-09-15T03:00:00Z') })
    t.setNow(new Date('2026-09-16T00:00:00Z'))
    assert.equal((await complete(t, later)).status, 200)
    assert.equal((await feeIncomes(t))[1]?.on, '2026-09-15')
  }),
)

test(
  '그 날이 든 기간이 공개됐으면 완료는 409 PERIOD_CLOSED이고, 앞 기간만 공개했으면 사전 모집 행사의 완료는 막히지 않는다',
  withSettlement(async t => {
    const p = await preRegistered(t)
    await t.make(t.council, 'account_closing', {
      fiscalPeriodId: p.first,
      publishedAt: new Date('2026-09-01T03:00:00Z'),
    })
    assert.equal((await complete(t, p.event)).status, 200)
    await t.make(t.council, 'account_closing', {
      fiscalPeriodId: p.next,
      publishedAt: new Date('2026-09-12T00:00:00Z'),
    })
    const other = await t.event({ startsAt: new Date('2026-09-10T00:00:00Z') })
    const registration = await t.registration(await t.form(other))
    await t.deposit(registration, { confirmedAt: new Date('2026-09-11T03:00:00Z') })
    const response = await complete(t, other)
    assert.equal(await errorOf(response), 'PERIOD_CLOSED')
    assert.equal((await feeIncomes(t)).length, 1)
  }),
)
