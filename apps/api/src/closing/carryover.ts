import { and, eq, isNull } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { fiscalPeriod, income, record } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { closingFiguresOf } from './figures.js'
import { isPeriodClosed } from './lock.js'
import { closingPeriodOf, type ClosingPeriod } from './period.js'

// 이월금 수입(DEC-70): 공개한 기간의 남은 돈이 다음 기간의 수입 하나가 된다. 0원도 만든다.
// 기간마다 취소하지 않은 이월금은 DB가 하나로 막는다(0011).

// 이 기간 바로 다음 기간(previous_period_id가 이 기간인 것). 없으면 null이다.
export async function nextPeriodOf(tx: Pick<Db, 'select'>, actor: Actor, periodId: string) {
  const [row] = await tx
    .select({ id: fiscalPeriod.id, startsOn: fiscalPeriod.startsOn })
    .from(fiscalPeriod)
    .where(
      and(eq(fiscalPeriod.previousPeriodId, periodId), eq(fiscalPeriod.councilId, actor.councilId)),
    )
  return row ?? null
}

function createCarryover(
  tx: Tx,
  actor: Actor,
  from: { name: string; remaining: number },
  to: { id: string; startsOn: string },
) {
  return createRecord(tx, {
    kind: 'income',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: {
      fiscalPeriodId: to.id,
      source: 'carryover',
      amount: String(from.remaining),
      receivedOn: to.startsOn,
      description: `${from.name} 이월금`,
    },
  })
}

// 공개 거래에서: 다음 기간이 이미 있으면 거기에 이월금을 만든다. 없으면 그 기간을 만들 때 생긴다(carryoverIntoNewPeriod).
export async function carryOverFrom(tx: Tx, actor: Actor, from: ClosingPeriod, remaining: number) {
  const next = await nextPeriodOf(tx, actor, from.id)
  if (next) await createCarryover(tx, actor, { name: from.name, remaining }, next)
}

// 기간을 만드는 거래에서: 이전 기간이 이미 공개됐으면 그 남은 돈을 새 기간의 이월금으로 만든다.
export async function carryoverIntoNewPeriod(
  tx: Tx,
  actor: Actor,
  to: { id: string; startsOn: string; previousPeriodId: string | null },
) {
  if (!to.previousPeriodId || !(await isPeriodClosed(tx, actor, to.previousPeriodId))) return
  const from = await closingPeriodOf(tx, actor, to.previousPeriodId)
  const { numbers } = await closingFiguresOf(tx, actor, from)
  await createCarryover(tx, actor, { name: from.name, remaining: numbers.remaining }, to)
}

// 다시 열기 거래에서: 다음 기간의 취소하지 않은 이월금을 같은 사유로 취소한다(취소한 수입은 남는다).
export async function cancelCarryover(tx: Tx, actor: Actor, nextPeriodId: string, reason: string) {
  const rows = await tx
    .select({ id: income.id })
    .from(income)
    .innerJoin(record, eq(record.id, income.id))
    .where(
      and(
        eq(record.councilId, actor.councilId),
        eq(income.fiscalPeriodId, nextPeriodId),
        eq(income.source, 'carryover'),
        isNull(income.cancelledAt),
      ),
    )
  for (const row of rows)
    await updateRecord(tx, {
      kind: 'income',
      id: row.id,
      actor: actor.memberId,
      reason,
      changes: { cancelledAt: clockNow },
    })
}
