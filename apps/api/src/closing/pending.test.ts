import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clockNow } from '../records/records.js'
import { readClosing } from '../test-support/closing.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'

// 결산서의 완료하지 않은 행사 입금과 내보내기 정보(기능 009 조각 3). 기간은 2026-09-01~2027-02-28이다.

// 행사 하나와 그 입금 하나. 입금 확인 시각과 행사 끝을 그대로 준다.
async function eventWithDeposit(
  t: SettlementKit,
  event: Record<string, unknown>,
  deposit: Record<string, unknown>,
) {
  const id = await t.event(event)
  const registration = await t.registration(await t.form(id))
  await t.deposit(registration, deposit)
  return id
}
const at = (value: string) => new Date(value)

test(
  '행사 끝 날짜(한국)가 끝일 23:59:59이거나 날짜 미정이면 공개를 막는 줄, 다음 날 0시이면 정보 줄이다',
  withSettlement(async t => {
    const { period } = await t.budgetOf()
    const confirmedAt = at('2026-12-01T00:00:00Z')
    await eventWithDeposit(t, { name: 'ㄱ안', endsAt: at('2027-02-28T14:59:59Z') }, { confirmedAt })
    await eventWithDeposit(t, { name: 'ㄴ미정', startsAt: null, endsAt: null }, { confirmedAt })
    // 끝 시각이 없으면 시작 시각으로 본다
    await eventWithDeposit(
      t,
      { name: 'ㄷ시작', startsAt: at('2027-02-28T14:59:59Z'), endsAt: null },
      { confirmedAt, amount: '1000' },
    )
    await eventWithDeposit(t, { name: 'ㅁ뒤', endsAt: at('2027-02-28T15:00:00Z') }, { confirmedAt })
    await eventWithDeposit(
      t,
      { name: 'ㅂ뒤', startsAt: at('2027-02-28T15:00:00Z'), endsAt: null },
      { confirmedAt, amount: '700' },
    )
    const { feePending } = await readClosing(t, period)
    assert.deepEqual(
      feePending.blocking.map(item => [item.event.name, item.depositCount, item.amount]),
      [
        ['ㄱ안', 1, 5000],
        ['ㄴ미정', 1, 5000],
        ['ㄷ시작', 1, 1000],
      ],
    )
    assert.deepEqual(feePending.nextPeriod, { eventCount: 2, depositCount: 2, amount: 5700 })
  }),
)

test(
  '입금 확인일(한국)이 끝일 이하인 입금만 센다: 끝일 23:59:59는 들고 +1초는 빠진다. 취소한 입금은 뺀다',
  withSettlement(async t => {
    const { period } = await t.budgetOf()
    const ev = await t.event({ name: '축제' })
    const f = await t.form(ev)
    await t.deposit(await t.registration(f), { confirmedAt: at('2027-02-28T14:59:59Z') })
    await t.deposit(await t.registration(f), { confirmedAt: at('2027-02-28T15:00:00Z') })
    await t.deposit(await t.registration(f), {
      confirmedAt: at('2026-12-01T00:00:00Z'),
      cancelledAt: clockNow,
    })
    const { feePending } = await readClosing(t, period)
    assert.deepEqual(
      feePending.blocking.map(item => [item.depositCount, item.amount]),
      [[1, 5000]],
    )
    assert.equal(feePending.nextPeriod.depositCount, 0)
  }),
)

test(
  '완료한 행사는 세지 않고, 완료를 취소하면 다시 센다. 환불은 입금에서 뺀다. 다른 학생회 행사는 들지 않는다',
  withSettlement(async t => {
    const { period } = await t.budgetOf()
    const ev = await eventWithDeposit(
      t,
      { name: '축제' },
      { confirmedAt: at('2026-12-01T00:00:00Z'), refundedAt: clockNow, refundAmount: '2000' },
    )
    await t.completion(ev, 'completed', at('2026-12-02T00:00:00Z'))
    assert.equal((await readClosing(t, period)).feePending.blocking.length, 0)
    await t.completion(ev, 'completion_cancelled', at('2026-12-03T00:00:00Z'), '정정')
    const { feePending } = await readClosing(t, period)
    assert.deepEqual(
      feePending.blocking.map(item => [item.event.id, item.amount]),
      [[ev, 3000]],
    )
    // 다른 학생회의 행사와 입금
    const otherEvent = await t.event({ name: '다른 행사' }, t.other)
    const form = await t.form(otherEvent, t.other)
    const registration = await t.registration(form, {}, t.other)
    await t.make(t.other, 'deposit', {
      registrationId: registration,
      amount: '9000',
      confirmedAt: at('2026-12-01T00:00:00Z'),
    })
    assert.equal((await readClosing(t, period)).feePending.blocking.length, 1)
  }),
)

test(
  '내보내기 정보: 취소하지 않은 지출의 증빙 사진 수와 크기, 건수, 상한 넘음',
  withSettlement(async t => {
    const { period } = await t.budgetOf()
    const photo = async (expenseId: string, sizeBytes: number) => {
      const evidence = await t.evidence(expenseId)
      await t.make(t.council, 'file', {
        name: 'evidence.jpg',
        mediaType: 'image/jpeg',
        sizeBytes,
        storageKey: `k-${evidence}`,
        attachedToId: evidence,
      })
    }
    const kept = await t.expense({ paidAt: at('2026-10-20T00:00:00Z') })
    await photo(kept, 1500)
    await photo(kept, 500)
    const cancelled = await t.expense({ paidAt: at('2026-10-20T00:00:00Z'), cancelledAt: clockNow })
    await photo(cancelled, 99999)
    const outside = await t.expense({ paidAt: at('2027-03-01T00:00:00Z') })
    await photo(outside, 77777)
    await t.make(t.council, 'income', {
      fiscalPeriodId: period,
      source: 'fee',
      amount: '1',
      receivedOn: '2026-10-21',
    })
    const small = (await readClosing(t, period)).exportInfo
    assert.deepEqual(small, {
      expenseCount: 1,
      incomeCount: 1,
      photoCount: 2,
      photoBytes: 2000,
      workbookTooLarge: false,
      bundleTooLarge: false,
      bundleAvailable: true,
    })
    await photo(kept, 1_000_000_000)
    const big = (await readClosing(t, period)).exportInfo
    assert.deepEqual([big.workbookTooLarge, big.bundleTooLarge], [false, true])
  }),
)
