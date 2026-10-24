import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { koreanDateOf, type ErrorCode } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { findPeriodIdOn, periodIdOn } from '../budget/queries.js'
import { deposit, income, record, registration, registrationForm } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { eventEndDayOf } from '../events/end-day.js'
import { isPeriodClosed } from '../policy/locks.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'

type Reader = Pick<Db, 'select'>
type Target = {
  id: string
  name: string
  startsAt: Date | null
  endsAt: Date | null
  // 완료하는 시각. 끝 날짜 전에 완료하면 받은 날이 미래가 되지 않게 한다.
  now: Date
}

// 계좌를 정하지 않은 입금(참가비 0원 양식에 금액을 적어 확인한 것)도 한 묶음이다.
const NO_ACCOUNT = ''

type DepositRow = Awaited<ReturnType<typeof activeDepositsOf>>[number]

// 이 행사의 입금 기록: 취소하지 않은 것과 그 계좌. 환불 대기가 남으면 완료되지 않으므로 여기서는 환불이 끝난 입금만 있다.
async function activeDepositsOf(tx: Reader, actor: Actor, eventId: string) {
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

// 받은 날: 그 계좌의 마지막 입금 확인일과 '행사 끝 날짜와 완료한 날(한국) 가운데 이른 날' 가운데 늦은 날이다(DEC-70이 DEC-68을 고쳤다).
// 사전 모집 행사의 참가비가 이미 공개한 앞 기간이 아니라 행사가 열린 기간의 수입이 된다.
function receivedDayOf(target: Target, rows: { confirmedAt: Date }[]) {
  const last = rows.reduce(
    (max, row) => (row.confirmedAt > max ? row.confirmedAt : max),
    rows[0]!.confirmedAt,
  )
  const lastDay = koreanDateOf(last)
  const endDay = eventEndDayOf(target)
  if (!endDay) return lastDay
  const today = koreanDateOf(target.now)
  const counted = endDay < today ? endDay : today
  return counted > lastDay ? counted : lastDay
}

// 참가비 수입 계획: 참가비 받는 계좌마다 수입 하나(계좌 번호 순). 금액은 취소하지 않은 입금 − 환불이고 0 이하이면 만들지 않는다.
// 완료 판정(events/policy.ts의 facts)과 수입 만들기가 같은 계획을 쓴다(계좌마다 받은 날이 같다).
export async function feePlanOf(db: Reader, actor: Actor, target: Target) {
  const groups = new Map<string, DepositRow[]>()
  for (const row of await activeDepositsOf(db, actor, target.id)) {
    const key = row.accountId ?? NO_ACCOUNT
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  const plan: { key: string; rows: DepositRow[]; net: number; day: string }[] = []
  for (const [key, rows] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const net = rows.reduce(
      (sum, row) => sum + Number(row.amount) - Number(row.refundAmount ?? 0),
      0,
    )
    if (net > 0) plan.push({ key, rows, net, day: receivedDayOf(target, rows) })
  }
  return plan
}

// 계획의 받은 날마다 회계 기간이 있고 공개되지 않았는지. 쓰기가 만나는 순서대로 첫 문제를 준다: 기간 없음(NO_FISCAL_PERIOD) 또는 공개(PERIOD_CLOSED).
export async function feePeriodProblemOf(
  db: Reader,
  actor: Actor,
  plan: readonly { day: string }[],
): Promise<Extract<ErrorCode, 'NO_FISCAL_PERIOD' | 'PERIOD_CLOSED'> | null> {
  for (const { day } of plan) {
    const periodId = await findPeriodIdOn(db, actor, day)
    if (!periodId) return 'NO_FISCAL_PERIOD'
    if (await isPeriodClosed(db, actor, periodId)) return 'PERIOD_CLOSED'
  }
  return null
}

// 완료하는 거래에서 계획대로 수입 하나씩을 만들고 입금 기록마다 그 수입을 잇는다(DEC-68). 완료 판정이 기간 없음·공개를 먼저 걸러 이미 통과했다.
export async function createFeeIncomes(tx: Tx, actor: Actor, target: Target) {
  for (const { key, rows, net, day } of await feePlanOf(tx, actor, target)) {
    const fiscalPeriodId = await periodIdOn(tx, actor, day)
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

// 완료 취소가 취소할 참가비 수입의 기간들: 이 행사 입금 기록이 잇는, 취소하지 않은 참가비 수입
async function linkedFeeIncomesOf(db: Reader, actor: Actor, eventId: string) {
  const linked = await db
    .select({ id: income.id, periodId: income.fiscalPeriodId })
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
    .groupBy(income.id, income.fiscalPeriodId)
  return [...linked].sort((a, b) => a.id.localeCompare(b.id))
}

// 완료 취소가 막히는가: 그 수입이 공개한 기간에 있으면 막힌다(DEC-70).
export async function feeIncomesLockedOf(db: Reader, actor: Actor, eventId: string) {
  for (const row of await linkedFeeIncomesOf(db, actor, eventId))
    if (await isPeriodClosed(db, actor, row.periodId)) return true
  return false
}

// 완료 취소: 이 행사의 참가비 수입을 같은 사유로 취소한다. 취소한 수입은 남는다. 기간이 공개됐는지는 완료 취소 판정이 먼저 본다.
export async function cancelFeeIncomes(tx: Tx, actor: Actor, eventId: string, reason: string) {
  for (const { id } of await linkedFeeIncomesOf(tx, actor, eventId))
    await updateRecord(tx, {
      kind: 'income',
      id,
      actor: actor.memberId,
      reason,
      changes: { cancelledAt: clockNow },
    })
}
