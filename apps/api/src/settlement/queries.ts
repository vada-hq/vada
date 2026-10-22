import { and, asc, eq, isNull, sql, type AnyColumn } from 'drizzle-orm'
import type { EventSettlement, SettlementBudgetItem } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { completedEventIdsAmong, completionApprovalsOf } from '../events/completion.js'
import { eventRowOf } from '../events/queries.js'
import {
  budgetItem,
  deposit,
  expense,
  income,
  lineItem,
  paymentLine,
  record,
  registration,
  registrationForm,
} from '../db/schema.js'
import type { Db } from '../db/types.js'
import { remainingOf } from './remaining.js'

type Reader = Pick<Db, 'select'>

// 합은 정수 원이다. numeric은 문자열로 와서 Number로 바꾼다(14자리라 안전하다).
const sumOf = (column: AnyColumn) => sql<number>`coalesce(sum(${column}), 0)`.mapWith(Number)

// 항목마다 쓴 돈(logical-model '예산 항목별로 쓴 돈'): 그 항목에 잡힌 품목의 결제 내역 금액과 직접 이은 지출. 취소한 지출은 뺀다.
// 수입 항목은 이은 수입 가운데 취소하지 않은 것이다.
const usedSql = sql<number>`(case ${budgetItem.type}
  when 'income' then (select coalesce(sum(${income.amount}), 0) from ${income}
    where ${income.budgetItemId} = ${budgetItem.id} and ${income.cancelledAt} is null)
  else (select coalesce(sum(${paymentLine.amount}), 0) from ${paymentLine}
      join ${lineItem} on ${lineItem.id} = ${paymentLine.lineItemId}
      join ${expense} on ${expense.id} = ${paymentLine.expenseId}
    where ${lineItem.budgetItemId} = ${budgetItem.id} and ${expense.cancelledAt} is null)
    + (select coalesce(sum(${expense.amount}), 0) from ${expense}
    where ${expense.budgetItemId} = ${budgetItem.id} and ${expense.cancelledAt} is null)
  end)`.mapWith(Number)

async function budgetOf(db: Reader, actor: Actor, eventId: string) {
  const rows = await db
    .select({
      id: budgetItem.id,
      type: budgetItem.type,
      purpose: budgetItem.purpose,
      amount: sumOf(budgetItem.amount),
      used: usedSql,
    })
    .from(budgetItem)
    .innerJoin(record, eq(record.id, budgetItem.id))
    .where(and(eq(record.councilId, actor.councilId), eq(budgetItem.eventId, eventId)))
    .groupBy(budgetItem.id, record.createdAt)
    .orderBy(asc(record.createdAt), asc(budgetItem.id))
  const items = rows.map(row => ({ ...row, type: row.type as SettlementBudgetItem['type'] }))
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
): Promise<EventSettlement> {
  await eventRowOf(db, actor, eventId)
  const scope = { councilId: actor.councilId, eventId }
  const budget = await budgetOf(db, actor, eventId)
  const spent = await expenseTotalOf(db, actor, eventId)
  const fee = await feeOf(db, actor, eventId)
  const remaining = await remainingOf(db, scope)
  return {
    budget,
    actual: {
      expense: spent,
      fee: fee.net,
      depositCount: fee.count,
      refundPendingCount: remaining.find(item => item.kind === 'refund_pending')?.count ?? 0,
    },
    difference: budget.expense - spent,
    remaining,
    settled: remaining.every(item => item.count === 0),
    completed: (await completedEventIdsAmong(db, [eventId])).has(eventId),
    approvals: await completionApprovalsOf(db, eventId),
  }
}
