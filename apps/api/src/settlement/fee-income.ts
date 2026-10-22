import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { koreanDateOf } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { periodIdOn } from '../budget/queries.js'
import { assertPeriodOpen } from '../closing/lock.js'
import { deposit, income, record, registration, registrationForm } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { eventEndDayOf } from '../events/end-day.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'

type Target = { id: string; name: string; startsAt: Date | null; endsAt: Date | null }

// 계좌를 정하지 않은 입금(참가비 0원 양식에 금액을 적어 확인한 것)도 한 묶음이다.
const NO_ACCOUNT = ''

// 이 행사의 입금 기록: 취소하지 않은 것과 그 계좌. 환불 대기가 남으면 완료되지 않으므로 여기서는 환불이 끝난 입금만 있다.
async function activeDepositsOf(tx: Tx, actor: Actor, eventId: string) {
  return tx
    .select({
      id: deposit.id,
      amount: deposit.amount,
      refundAmount: deposit.refundAmount,
      confirmedAt: deposit.confirmedAt,
      accountId: registrationForm.feeAccountId,
    })
    .from(deposit)
    .innerJoin(registration, eq(registration.id, deposit.registrationId))
    .innerJoin(registrationForm, eq(registrationForm.id, registration.formId))
    .innerJoin(record, eq(record.id, deposit.id))
    .where(
      and(
        eq(record.councilId, actor.councilId),
        eq(registrationForm.eventId, eventId),
        isNull(deposit.cancelledAt),
      ),
    )
}

// 받은 날: 그 계좌의 마지막 입금 확인일과 행사 끝 날짜(한국) 가운데 늦은 날이다(DEC-70이 DEC-68을 고쳤다).
// 사전 모집 행사의 참가비가 이미 공개한 앞 기간이 아니라 행사가 열린 기간의 수입이 된다.
function receivedDayOf(target: Target, rows: { confirmedAt: Date }[]) {
  const last = rows.reduce(
    (max, row) => (row.confirmedAt > max ? row.confirmedAt : max),
    rows[0]!.confirmedAt,
  )
  const lastDay = koreanDateOf(last)
  const endDay = eventEndDayOf(target)
  return endDay && endDay > lastDay ? endDay : lastDay
}

// 완료하는 거래에서 참가비 받는 계좌마다 수입 하나를 만들고 입금 기록마다 그 수입을 잇는다(DEC-68).
// 금액은 취소하지 않은 입금 − 환불이고 0이면 만들지 않는다. 받은 날은 receivedDayOf가 정하고, 그날이 든 회계 기간이 없으면 409다(완료되지 않는다).
export async function createFeeIncomes(tx: Tx, actor: Actor, target: Target) {
  const groups = new Map<string, Awaited<ReturnType<typeof activeDepositsOf>>>()
  for (const row of await activeDepositsOf(tx, actor, target.id)) {
    const key = row.accountId ?? NO_ACCOUNT
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  for (const [key, rows] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const net = rows.reduce(
      (sum, row) => sum + Number(row.amount) - Number(row.refundAmount ?? 0),
      0,
    )
    if (net <= 0) continue
    const day = receivedDayOf(target, rows)
    const fiscalPeriodId = await periodIdOn(tx, actor, day)
    // 그 기간을 공개했으면 완료가 막힌다(DEC-70). 재정부가 그 결산을 다시 열면 된다.
    await assertPeriodOpen(tx, actor, fiscalPeriodId)
    const incomeId = await createRecord(tx, {
      kind: 'income',
      councilId: actor.councilId,
      actor: actor.memberId,
      values: {
        fiscalPeriodId,
        source: 'participation_fee',
        amount: String(net),
        receivedOn: day,
        description: `${target.name} 참가비`,
        accountId: key === NO_ACCOUNT ? null : key,
      },
    })
    for (const row of rows)
      await updateRecord(tx, {
        kind: 'deposit',
        id: row.id,
        actor: actor.memberId,
        reason: null,
        changes: { incomeId },
      })
  }
}

// 완료 취소: 이 행사 입금 기록이 잇는, 취소하지 않은 참가비 수입을 같은 사유로 취소한다. 취소한 수입은 남는다.
export async function cancelFeeIncomes(tx: Tx, actor: Actor, eventId: string, reason: string) {
  const linked = await tx
    .selectDistinct({ id: income.id, periodId: income.fiscalPeriodId })
    .from(deposit)
    .innerJoin(registration, eq(registration.id, deposit.registrationId))
    .innerJoin(registrationForm, eq(registrationForm.id, registration.formId))
    .innerJoin(income, eq(income.id, deposit.incomeId))
    .innerJoin(record, eq(record.id, deposit.id))
    .where(
      and(
        eq(record.councilId, actor.councilId),
        eq(registrationForm.eventId, eventId),
        isNotNull(deposit.incomeId),
        isNull(income.cancelledAt),
      ),
    )
  const rows = [...linked].sort((a, b) => a.id.localeCompare(b.id))
  // 그 수입이 공개한 기간에 있으면 완료 취소가 막힌다(DEC-70). 하나라도 걸리면 아무것도 취소하지 않는다.
  for (const row of rows) await assertPeriodOpen(tx, actor, row.periodId)
  for (const { id } of rows)
    await updateRecord(tx, {
      kind: 'income',
      id,
      actor: actor.memberId,
      reason,
      changes: { cancelledAt: clockNow },
    })
}
