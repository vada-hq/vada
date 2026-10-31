import { randomUUID } from 'node:crypto'
import type { BudgetResponse, ExpenseResponse, IncomeResponse } from '@vada/contracts'
import { semesterOf } from '@vada/contracts'
import { create, sees, write } from '../rehearsal-kit.js'
import type { BudgetItemEntry, DirectExpenseEntry, FinanceContent } from './content/types.js'
import {
  budgetId,
  budgetKey,
  departmentId,
  eventId,
  found,
  org,
  seesPermission,
  who,
  type ShowcaseCtx,
} from './kit.js'

// 재정 바탕(회계 기간, 계좌, 예산 항목, 수입)과 요청 없는 지출, 증빙.

// 회계 기간: 돌리는 날이 든 학기(화면의 기본값과 같다).
export async function periodStep(ctx: ShowcaseCtx, finance: FinanceContent) {
  const person = who(ctx, finance.by)
  await seesPermission(ctx, person, 'finance.manage')
  await create<BudgetResponse>(
    person,
    `${org(ctx)}/fiscal-periods`,
    semesterOf(ctx.cal.dayOf('D0')),
    '회계 기간 만들기',
  )
}

export async function accountStep(ctx: ShowcaseCtx, finance: FinanceContent) {
  const { account } = finance
  const created = await create<{ account: { id: string } }>(
    who(ctx, finance.by),
    `${org(ctx)}/accounts`,
    {
      name: account.name,
      bank: account.bank,
      holder: account.holder,
      accountNumber: account.number,
      type: account.type,
    },
    '계좌 만들기',
  )
  ctx.w.accountId = created.account.id
}

// 예산 항목 만들기 본문. 담당 부서(item.department)는 아직 받는 칸이 없어 보내지 않는다.
// 담당 부서는 부장 홈 '우리 부서가 맡은 예산' 줄의 근거다.
function budgetItemBody(ctx: ShowcaseCtx, item: BudgetItemEntry) {
  return {
    purpose: item.purpose,
    amount: item.amount,
    type: item.type,
    eventId: item.event ? eventId(ctx, item.event) : null,
    departmentId: item.department ? departmentId(ctx, item.department) : null,
  }
}

export async function budgetItemStep(ctx: ShowcaseCtx, by: string, item: BudgetItemEntry) {
  const budget = await create<BudgetResponse>(
    who(ctx, by),
    `${org(ctx)}/budget-items`,
    budgetItemBody(ctx, item),
    '예산 항목',
  )
  const eventIdOf = item.event ? eventId(ctx, item.event) : null
  const made = budget.items.find(
    row => row.purpose === item.purpose && (row.event?.id ?? null) === eventIdOf,
  )
  if (!made) throw new Error(`예산 항목 '${item.purpose}'이 응답에 없다`)
  ctx.w.budget.set(budgetKey(item), made.id)
}

export async function incomeStep(
  ctx: ShowcaseCtx,
  by: string,
  income: FinanceContent['incomes'][number],
) {
  await create<IncomeResponse>(
    who(ctx, by),
    `${org(ctx)}/incomes`,
    {
      commandId: randomUUID(),
      source: income.source,
      amount: income.amount,
      receivedOn: ctx.cal.dayOf(income.receivedOn),
      budgetItemId: income.budget ? budgetId(ctx, income.budget) : null,
      accountId: income.toAccount ? ctx.w.accountId : null,
    },
    '수입 적기',
  )
}

// 지출 적기의 공통 칸. 요청의 결제(lines)와 요청 없는 지출이 같이 쓴다.
export function expenseFields(
  ctx: ShowcaseCtx,
  entry: Omit<DirectExpenseEntry, 'amount' | 'event' | 'budget'>,
) {
  return {
    commandId: randomUUID(),
    vendor: entry.vendor,
    description: ctx.cal.text(entry.description),
    paidOn: ctx.cal.dayOf(entry.paidOn),
    method: entry.method,
    reason: entry.reason,
    accountId: entry.fromAccount ? ctx.w.accountId : null,
    sourceMessageId: entry.fromMessage ? found(ctx.w.messages, entry.fromMessage, '메시지') : null,
  }
}

// 요청 없는 지출. 적은 지출의 번호를 돌려준다(증빙을 붙일 때 쓴다).
export async function directExpenseStep(ctx: ShowcaseCtx, entry: DirectExpenseEntry) {
  const person = who(ctx, entry.by)
  await seesPermission(ctx, person, 'finance.manage')
  const created = await create<ExpenseResponse>(
    person,
    `${org(ctx)}/expenses`,
    {
      ...expenseFields(ctx, entry),
      amount: entry.amount,
      budgetItemId: entry.budget ? budgetId(ctx, entry.budget) : null,
      eventId: entry.event ? eventId(ctx, entry.event) : null,
    },
    '지출 적기',
  )
  return created.expense.id
}

// 증빙 하나(영수증): 올리기 주소를 받고, 저장소에 올린 뒤 붙인다.
export async function evidenceStep(ctx: ShowcaseCtx, by: string, expenseId: string) {
  const person = who(ctx, by)
  const path = `${org(ctx)}/expenses/${expenseId}`
  await sees<ExpenseResponse>(person, path, body => body.expense.actions, 'expense.attach_evidence')
  const upload = await write<{ key: string }>(person, `${path}/uploads`, {}, '증빙 올리기')
  await ctx.uploadEvidence(upload.key)
  await create<ExpenseResponse>(person, `${path}/evidence`, { key: upload.key }, '증빙 붙이기')
}
