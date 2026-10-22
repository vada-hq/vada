import { and, desc, eq, type SQL } from 'drizzle-orm'
import {
  INCOME_LIST_LIMIT,
  INCOME_AUTOMATIC_SOURCES,
  type IncomeAction,
  type IncomeDetail,
  type IncomeListQuery,
  type IncomeSource,
  type IncomeSummary,
  type IncomesResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { periodInCouncil } from '../budget/queries.js'
import { account, budgetItem, fiscalPeriod, income, member, record } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { incomeHistoryOf } from './history.js'
import { isIncomeLocked } from './lock.js'

type Reader = Pick<Db, 'select'>

// 수입 줄. 학생회 경계는 기록의 학생회 번호로 건다.
function incomeRows(db: Reader, actor: Actor, where: SQL, limit: number) {
  return db
    .select({
      id: income.id,
      source: income.source,
      amount: income.amount,
      receivedOn: income.receivedOn,
      description: income.description,
      periodId: fiscalPeriod.id,
      periodName: fiscalPeriod.name,
      budgetItemId: income.budgetItemId,
      purpose: budgetItem.purpose,
      accountId: income.accountId,
      accountName: account.name,
      createdById: record.createdBy,
      creatorName: member.name,
      cancelledAt: income.cancelledAt,
    })
    .from(income)
    .innerJoin(record, eq(record.id, income.id))
    .innerJoin(fiscalPeriod, eq(fiscalPeriod.id, income.fiscalPeriodId))
    .leftJoin(budgetItem, eq(budgetItem.id, income.budgetItemId))
    .leftJoin(account, eq(account.id, income.accountId))
    .leftJoin(member, eq(member.id, record.createdBy))
    .where(and(eq(record.councilId, actor.councilId), where))
    .orderBy(desc(income.receivedOn), desc(income.id))
    .limit(limit)
}
type Row = Awaited<ReturnType<typeof incomeRows>>[number]

// 참가비와 이월금은 서버가 만든다(수입 적기·취소 경로로는 만들지도 취소하지도 못한다).
export const isAutomaticSource = (source: string) =>
  (INCOME_AUTOMATIC_SOURCES as readonly string[]).includes(source)

function summaryOf(row: Row): IncomeSummary {
  return {
    id: row.id,
    source: row.source as IncomeSource,
    amount: Number(row.amount),
    receivedOn: row.receivedOn,
    description: row.description,
    budgetItem:
      row.budgetItemId && row.purpose ? { id: row.budgetItemId, purpose: row.purpose } : null,
    account: row.accountId && row.accountName ? { id: row.accountId, name: row.accountName } : null,
    createdBy:
      row.createdById && row.creatorName ? { id: row.createdById, name: row.creatorName } : null,
    cancelled: row.cancelledAt !== null,
  }
}

// 그 기간의 수입을 받은 날 최근 순으로(취소한 것과 참가비·이월금 포함). 한 개 더 읽어 넘쳤는지 안다.
// 다른 학생회의 기간은 없는 것과 같아 404다.
export async function incomeListOf(
  db: Reader,
  actor: Actor,
  query: IncomeListQuery,
): Promise<IncomesResponse> {
  const period = await periodInCouncil(db, actor, query.period)
  const rows = await incomeRows(
    db,
    actor,
    eq(income.fiscalPeriodId, period.id),
    INCOME_LIST_LIMIT + 1,
  )
  return {
    incomes: rows.slice(0, INCOME_LIST_LIMIT).map(summaryOf),
    truncated: rows.length > INCOME_LIST_LIMIT,
  }
}

// 이 학생회의 수입 하나. 다른 학생회의 수입은 없는 것과 같아 404다. 취소한 수입도 읽을 수 있다.
export async function incomeRowOf(db: Reader, actor: Actor, incomeId: string) {
  const [row] = await incomeRows(db, actor, eq(income.id, incomeId), 1)
  if (!row) throw new ApiError('NOT_FOUND')
  return row
}

// 취소는 재정부가, 취소하지 않은 수입 가운데 사람이 적은 것에 한다. 쓰기 경로(service.ts)도 이 조건을 쓴다.
export const canCancelIncome = (actor: Actor, facts: { cancelled: boolean; source: string }) =>
  !facts.cancelled && !isAutomaticSource(facts.source) && can(actor, 'finance.manage')

export async function incomeDetailOf(
  db: Reader,
  actor: Actor,
  incomeId: string,
): Promise<IncomeDetail> {
  const row = await incomeRowOf(db, actor, incomeId)
  const summary = summaryOf(row)
  // 완료한 행사의 수입 항목을 고른 수입과 공개한 기간의 수입은 잠겨 있어 취소 동작을 주지 않는다(DEC-68, DEC-70).
  const cancellable =
    canCancelIncome(actor, { cancelled: summary.cancelled, source: row.source }) &&
    !(await isIncomeLocked(db, actor, { budgetItemId: row.budgetItemId, periodId: row.periodId }))
  const actions: IncomeAction[] = cancellable ? ['income.cancel'] : []
  return {
    ...summary,
    period: { id: row.periodId, name: row.periodName },
    history: await incomeHistoryOf(db, incomeId),
    actions,
  }
}
