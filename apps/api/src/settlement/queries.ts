import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import type { EventSettlement, SettlementBudgetItem } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { completedEventIdsAmong, completionApprovalsOf } from '../events/completion.js'
import { eventRowOf } from '../events/queries.js'
import { eventStatusOf } from '../events/status.js'
import {
  budgetItem,
  deposit,
  expense,
  record,
  registration,
  registrationForm,
} from '../db/schema.js'
import { budgetItemsWithUsage } from '../budget/usage.js'
import { sumOf } from '../db/sums.js'
import type { Db } from '../db/types.js'
import { isSettled, remainingOf } from './remaining.js'

type Reader = Pick<Db, 'select'>

// 이 행사의 예산 항목(만든 순)과 항목마다 쓴 돈·남은 돈. 셈은 예산 탭과 같은 모듈이다(usage.ts).
async function budgetOf(db: Reader, actor: Actor, eventId: string) {
  const rows = await budgetItemsWithUsage(db, actor.councilId, eq(budgetItem.eventId, eventId), [
    asc(record.createdAt),
    asc(budgetItem.id),
  ])
  const items = rows.map(
    ({ id, type, purpose, amount, actual, committed, available }): SettlementBudgetItem => ({
      id,
      type,
      purpose,
      amount,
      actual,
      committed,
      available,
    }),
  )
  const totalOf = (type: string) =>
    items.filter(item => item.type === type).reduce((sum, item) => sum + item.amount, 0)
  return { expense: totalOf('expense'), income: totalOf('income'), items }
}

async function expenseTotalOf(db: Reader, actor: Actor, eventId: string) {
  const [row] = await db
    .select({ total: sumOf(expense.amount) })
    .from(expense)
    .innerJoin(record, eq(record.id, expense.id))
    .where(
      and(
        eq(record.councilId, actor.councilId),
        eq(expense.eventId, eventId),
        isNull(expense.cancelledAt),
      ),
    )
  return row?.total ?? 0
}

// 참가비: 취소하지 않은 입금 − 환불. 취소한 신청의 입금도 환불 전까지는 받은 돈이다.
async function feeOf(db: Reader, actor: Actor, eventId: string) {
  const [row] = await db
    .select({
      received: sumOf(deposit.amount),
      refunded: sumOf(deposit.refundAmount),
      count: sql<number>`count(*)`.mapWith(Number),
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
  return { net: (row?.received ?? 0) - (row?.refunded ?? 0), count: row?.count ?? 0 }
}

// 행사 하나의 정산. 학생회 밖 행사와 없는 행사는 404다(eventRowOf).
export async function settlementOf(
  db: Reader,
  actor: Actor,
  eventId: string,
  now: Date,
): Promise<EventSettlement> {
  const row = await eventRowOf(db, actor, eventId)
  const completed = (await completedEventIdsAmong(db, [eventId])).has(eventId)
  const scope = { councilId: actor.councilId, eventId }
  const budget = await budgetOf(db, actor, eventId)
  const spent = await expenseTotalOf(db, actor, eventId)
  const fee = await feeOf(db, actor, eventId)
  const income = budget.items
    .filter(item => item.type === 'income')
    .reduce((sum, item) => sum + item.actual, 0)
  const remaining = await remainingOf(db, scope)
  return {
    budget,
    actual: {
      expense: spent,
      fee: fee.net,
      income,
      depositCount: fee.count,
      refundPendingCount: remaining.find(item => item.kind === 'refund_pending')?.count ?? 0,
    },
    difference: budget.expense - spent,
    remaining,
    settled: isSettled(eventStatusOf(row.startsAt, row.endsAt, now, completed), remaining),
    completed,
    approvals: await completionApprovalsOf(db, eventId),
  }
}
