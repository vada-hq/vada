import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { koreanDateOf, type EvidenceType, type ExpenseMethod } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import {
  account,
  budgetItem,
  event,
  evidence,
  expense,
  file,
  income,
  lineItem,
  member,
  paymentLine,
  record,
} from '../db/schema.js'
import type { Db } from '../db/types.js'
import { paidWithin, type ClosingPeriod } from './period.js'
import { displayNameOf } from '../team/display-name.js'

type Reader = Pick<Db, 'select'>

// 내보내기에 담는 줄. 사람 이름과 계좌 정보는 감사용에만 쓰이지만 여기서는 모두 읽는다(걸러 내는 곳은 workbook.ts 한 곳이다).
export type ExportIncome = {
  receivedOn: string
  source: string
  amount: number
  description: string | null
  item: string | null
  account: string | null
  recorder: string | null
}

export type ExportExpense = {
  id: string
  // 증빙번호: 결제일·적은 순 1부터. 취소한 지출은 번호를 쓰지 않는다.
  number: number
  paidOn: string
  vendor: string
  description: string
  amount: number
  method: ExpenseMethod
  items: string[]
  account: string | null
  event: string | null
  reason: string | null
  reimbursedOn: string | null
  evidenceCount: number
  payer: string | null
  requester: string | null
  recorder: string | null
}

export type ExportAccount = {
  id: string
  name: string
  bank: string
  accountNumber: string
  holder: string
  closed: boolean
}

export type ExportPhoto = { number: number; seq: number; type: EvidenceType; key: string }

const payer = alias(member, 'payer')
const requester = alias(member, 'requester')
const incomeRecorder = alias(member, 'income_recorder')
const expenseRecorder = alias(member, 'expense_recorder')
const incomeRecord = alias(record, 'income_record')
const expenseRecord = alias(record, 'expense_record')

export async function incomeRowsForExport(
  db: Reader,
  actor: Actor,
  period: ClosingPeriod,
): Promise<ExportIncome[]> {
  const rows = await db
    .select({
      receivedOn: income.receivedOn,
      source: income.source,
      amount: income.amount,
      description: income.description,
      item: budgetItem.purpose,
      account: account.name,
      recorder: displayNameOf(incomeRecorder, incomeRecord.councilId),
    })
    .from(income)
    .innerJoin(incomeRecord, eq(incomeRecord.id, income.id))
    .leftJoin(incomeRecorder, eq(incomeRecorder.id, incomeRecord.createdBy))
    .leftJoin(budgetItem, eq(budgetItem.id, income.budgetItemId))
    .leftJoin(account, eq(account.id, income.accountId))
    .where(
      and(
        eq(incomeRecord.councilId, actor.councilId),
        eq(income.fiscalPeriodId, period.id),
        isNull(income.cancelledAt),
      ),
    )
    .orderBy(asc(income.receivedOn), asc(incomeRecord.createdAt), asc(income.id))
  return rows.map(row => ({ ...row, amount: Number(row.amount) }))
}

const evidenceCount = sql<number>`(select count(*) from ${evidence} where ${evidence.expenseId} = ${expense.id})`

// 결제 내역이 있는 지출은 내역 품목의 예산 항목, 없으면 지출에 고른 예산 항목이다(결산서 계산과 같은 기준).
async function lineItemsOf(db: Reader, ids: string[]) {
  const byExpense = new Map<string, string[]>()
  if (ids.length === 0) return byExpense
  const rows = await db
    .select({ expenseId: paymentLine.expenseId, purpose: budgetItem.purpose })
    .from(paymentLine)
    .innerJoin(lineItem, eq(lineItem.id, paymentLine.lineItemId))
    .leftJoin(budgetItem, eq(budgetItem.id, lineItem.budgetItemId))
    .where(inArray(paymentLine.expenseId, ids))
    .orderBy(asc(budgetItem.purpose))
  for (const row of rows) {
    const held = byExpense.get(row.expenseId) ?? []
    if (row.purpose && !held.includes(row.purpose)) held.push(row.purpose)
    byExpense.set(row.expenseId, held)
  }
  return byExpense
}

const expenseColumns = {
  id: expense.id,
  paidAt: expense.paidAt,
  vendor: expense.vendor,
  description: expense.description,
  amount: expense.amount,
  method: expense.method,
  item: budgetItem.purpose,
  account: account.name,
  event: event.name,
  reason: expense.reason,
  reimbursedAt: expense.reimbursedAt,
  evidenceCount: evidenceCount.mapWith(Number),
  payer: displayNameOf(payer, expenseRecord.councilId),
  requester: displayNameOf(requester, expenseRecord.councilId),
  recorder: displayNameOf(expenseRecorder, expenseRecord.councilId),
}

export async function expenseRowsForExport(
  db: Reader,
  actor: Actor,
  period: ClosingPeriod,
): Promise<ExportExpense[]> {
  const rows = await db
    .select(expenseColumns)
    .from(expense)
    .innerJoin(expenseRecord, eq(expenseRecord.id, expense.id))
    .leftJoin(expenseRecorder, eq(expenseRecorder.id, expenseRecord.createdBy))
    .leftJoin(payer, eq(payer.id, expense.paidBy))
    .leftJoin(requester, eq(requester.id, expense.requestedBy))
    .leftJoin(budgetItem, eq(budgetItem.id, expense.budgetItemId))
    .leftJoin(account, eq(account.id, expense.accountId))
    .leftJoin(event, eq(event.id, expense.eventId))
    .where(
      and(
        eq(expenseRecord.councilId, actor.councilId),
        isNull(expense.cancelledAt),
        paidWithin(period),
      ),
    )
    .orderBy(asc(expense.paidAt), asc(expenseRecord.createdAt), asc(expense.id))
  const lines = await lineItemsOf(
    db,
    rows.map(row => row.id),
  )
  return rows.map(({ paidAt, reimbursedAt, item, amount, ...row }, index) => ({
    ...row,
    amount: Number(amount),
    method: row.method as ExpenseMethod,
    number: index + 1,
    paidOn: koreanDateOf(paidAt),
    reimbursedOn: reimbursedAt ? koreanDateOf(reimbursedAt) : null,
    items: lines.get(row.id) ?? (item ? [item] : []),
  }))
}

// 닫은 계좌도 든다. 은행·번호·예금주는 감사용 파일에만 쓴다.
export async function accountRowsForExport(db: Reader, actor: Actor): Promise<ExportAccount[]> {
  const rows = await db
    .select({
      id: account.id,
      name: account.name,
      bank: account.bank,
      accountNumber: account.accountNumber,
      holder: account.holder,
      closedOn: account.closedOn,
    })
    .from(account)
    .innerJoin(record, eq(record.id, account.id))
    .where(eq(account.councilId, actor.councilId))
    .orderBy(asc(record.createdAt), asc(account.id))
  return rows.map(({ closedOn, ...row }) => ({ ...row, closed: closedOn !== null }))
}

// 증빙 사진: 지출의 증빙번호와 그 지출 안의 순번(붙인 순). 저장소 키는 묶음 안에서만 쓰고 이름에는 넣지 않는다.
export async function photoRowsForExport(
  db: Reader,
  expenses: readonly ExportExpense[],
): Promise<ExportPhoto[]> {
  if (expenses.length === 0) return []
  const numbers = new Map(expenses.map(row => [row.id, row.number]))
  const rows = await db
    .select({
      expenseId: evidence.expenseId,
      type: evidence.type,
      key: file.storageKey,
    })
    .from(file)
    .innerJoin(record, eq(record.id, file.id))
    .innerJoin(evidence, eq(evidence.id, file.attachedToId))
    .where(
      inArray(
        evidence.expenseId,
        expenses.map(row => row.id),
      ),
    )
    .orderBy(asc(record.createdAt), asc(file.id))
  const seqs = new Map<string, number>()
  return rows.flatMap(row => {
    const number = numbers.get(row.expenseId)
    // 증빙 파일은 비우지 않지만 저장소 위치는 비울 수 있는 칸이다(지운 메시지의 사진, DEC-54).
    if (number === undefined || row.key === null) return []
    const seq = (seqs.get(row.expenseId) ?? 0) + 1
    seqs.set(row.expenseId, seq)
    return [{ number, seq, type: row.type as EvidenceType, key: row.key }]
  })
}
