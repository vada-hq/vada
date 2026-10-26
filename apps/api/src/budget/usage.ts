import { and, eq, isNull, sql, type SQL } from 'drizzle-orm'
import { alias, type AnyPgColumn } from 'drizzle-orm/pg-core'
import type { BudgetItemType, BudgetItemUsage } from '@vada/contracts'
import {
  budgetItem,
  event,
  expense,
  income,
  lineItem,
  paymentLine,
  record,
  request,
} from '../db/schema.js'
import type { Db } from '../db/types.js'
import { lastOutcomeOf } from '../purchases/last-outcome.js'

type Reader = Pick<Db, 'select'>

// 예산 셈(DEC-15, DEC-92, logical-model '예산 항목별로 쓴 돈'). 예산 항목마다 배정, 실제, 지출 예정(약정), 사용 가능을 준다.
// 예산 탭과 행사 '예산·정산'이 이 함수 하나를 읽어 같은 항목의 숫자가 두 곳에서 같다. 결재와 재정 첫 화면이 이 숫자를 쓸 때도 이것을 읽는다.
// 품목 상태는 마지막 결재 결과(lastOutcomeOf) 한 곳으로 센다. 요청 상태로 거르면 일부만 승인한 요청의 승인 품목이 빠져
// 같은 예산을 두 번 승인하게 된다. 품목·지출·수입이 다른 학생회의 예산 항목을 가리키는 것은 DB가 막지 않아 줄마다 학생회로 거른다.

const LINE_RECORD = 'usage_line_record'
const SPEND_RECORD = 'usage_spend_record'
const lineRecord = alias(record, LINE_RECORD)
const spendRecord = alias(record, SPEND_RECORD)

// 이 학생회의 취소하지 않은 지출에 든 그 품목의 결제 내역 합. 재정 첫 화면의 지출 예정 품목 수도 이것으로 남은 금액을 본다.
const paidFor = (line: AnyPgColumn, councilId: string) =>
  sql`(select coalesce(sum(${paymentLine.amount}), 0) from ${paymentLine}
    join ${expense} on ${expense.id} = ${paymentLine.expenseId}
    join ${record} ${sql.identifier(SPEND_RECORD)} on ${spendRecord.id} = ${expense.id}
    where ${and(
      eq(paymentLine.lineItemId, line),
      sql`${expense.cancelledAt} is null`,
      eq(spendRecord.councilId, councilId),
    )})`

// 지출 항목은 그 항목에 잡힌 품목의 결제 내역과 직접 이은 지출, 수입 항목은 이은 수입. 취소한 지출·수입은 뺀다.
const actualSql = (councilId: string) =>
  sql<number>`(case ${budgetItem.type}
  when 'income' then (select coalesce(sum(${income.amount}), 0) from ${income}
      join ${record} ${sql.identifier(SPEND_RECORD)} on ${spendRecord.id} = ${income.id}
    where ${income.budgetItemId} = ${budgetItem.id} and ${income.cancelledAt} is null
      and ${spendRecord.councilId} = ${councilId})
  else (select coalesce(sum(${paidFor(lineItem.id, councilId)}), 0) from ${lineItem}
      join ${record} ${sql.identifier(LINE_RECORD)} on ${lineRecord.id} = ${lineItem.id}
    where ${lineItem.budgetItemId} = ${budgetItem.id} and ${lineRecord.councilId} = ${councilId})
    + (select coalesce(sum(${expense.amount}), 0) from ${expense}
      join ${record} ${sql.identifier(SPEND_RECORD)} on ${spendRecord.id} = ${expense.id}
    where ${expense.budgetItemId} = ${budgetItem.id} and ${expense.cancelledAt} is null
      and ${spendRecord.councilId} = ${councilId})
  end)`.mapWith(Number)

// 약정 금액과 개요의 예정 건수가 같은 품목을 세도록 조건을 함께 쓴다. 요청과 품목의 record를 연결한 질의에서 쓴다.
export const committedLine = (councilId: string) =>
  and(
    isNull(request.cancelledAt),
    sql`${lastOutcomeOf(lineItem.id)} = 'approved'`,
    sql`coalesce(${lineItem.amount}, 0) > ${paidFor(lineItem.id, councilId)}`,
  )

// 약정: 남은 승인 금액이 양수인 품목만 더해 초과 결제해도 음수가 되지 않는다.
const committedSql = (councilId: string) =>
  sql<number>`(select coalesce(sum(greatest(coalesce(${lineItem.amount}, 0) - ${paidFor(lineItem.id, councilId)}, 0)), 0)
    from ${lineItem}
      join ${record} ${sql.identifier(LINE_RECORD)} on ${lineRecord.id} = ${lineItem.id}
      join ${request} on ${request.id} = ${lineItem.requestId}
    where ${lineItem.budgetItemId} = ${budgetItem.id} and ${lineRecord.councilId} = ${councilId}
      and ${committedLine(councilId)})`.mapWith(Number)

// 수입 항목에는 약정과 사용 가능이 없다(결재와 지출에서 고를 수 없다, DEC-45).
function usageOf(
  type: BudgetItemType,
  amount: number,
  counted: { actual: number; committed: number },
): BudgetItemUsage {
  const { actual, committed } = counted
  if (type === 'income') return { type, actual, committed: null, available: null }
  return { type, actual, committed, available: amount - actual - committed }
}

export type BudgetItemRow = {
  id: string
  purpose: string
  amount: number
  eventId: string | null
  eventName: string | null
  usage: BudgetItemUsage
}

// 이 학생회의 예산 항목 가운데 where에 맞는 것과 그 셈. 차례는 부르는 쪽이 준다(record는 항목의 기록이다).
export async function budgetItemsWithUsage(
  db: Reader,
  councilId: string,
  where: SQL | undefined,
  orderBy: SQL[],
): Promise<BudgetItemRow[]> {
  const rows = await db
    .select({
      id: budgetItem.id,
      type: budgetItem.type,
      purpose: budgetItem.purpose,
      amount: budgetItem.amount,
      eventId: budgetItem.eventId,
      eventName: event.name,
      actual: actualSql(councilId),
      committed: committedSql(councilId),
    })
    .from(budgetItem)
    .innerJoin(record, eq(record.id, budgetItem.id))
    .leftJoin(event, eq(event.id, budgetItem.eventId))
    .where(and(eq(record.councilId, councilId), where))
    .orderBy(...orderBy)
  return rows.map(({ type, amount, actual, committed, ...rest }) => {
    const won = Number(amount)
    return {
      ...rest,
      amount: won,
      usage: usageOf(type as BudgetItemType, won, { actual, committed }),
    }
  })
}
