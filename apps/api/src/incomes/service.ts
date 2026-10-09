import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm'
import { alias, type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type { CreateIncomeRequest, IncomeAction, IncomeDetail, IncomeSummary, UpdateIncomeRequest, VoidIncomeRequest } from '@vada/contracts'
import { budgetLines, budgetPeriods, incomeEvents, incomes, users } from '../db/schema.js'
import { ApiError } from '../http/errors.js'
import { requireFinance } from '../purchases/review.js'

type Db = PgDatabase<PgQueryResultHKT>
export type IncomeDatabase = Pick<Db, 'select' | 'insert' | 'update' | 'transaction'>
type Reader = Pick<Db, 'select'>
type Transaction = Parameters<Parameters<IncomeDatabase['transaction']>[0]>[0]
export interface IncomeScope { organizationId: string; userId: string }
const recorders = alias(users, 'income_recorders')
const voiders = alias(users, 'income_voiders')
const actors = alias(users, 'income_actors')
const lines = alias(budgetLines, 'income_budget_lines')

// 상세·변경 응답과 예산 화면의 수입 내역이 같은 칸을 쓴다. 받은 날·기록이 최근인 순이다.
export async function incomeSummaries(db: Reader, organizationId: string, where: SQL | undefined, limit: number): Promise<IncomeSummary[]> {
  const rows = await db.select({ income: incomes, lineName: lines.name, recorderName: recorders.name, voiderName: voiders.name }).from(incomes)
    .leftJoin(lines, and(eq(lines.id, incomes.budgetLineId), eq(lines.organizationId, incomes.organizationId)))
    .innerJoin(recorders, eq(recorders.id, incomes.recordedBy))
    .leftJoin(voiders, eq(voiders.id, incomes.voidedBy))
    .where(and(eq(incomes.organizationId, organizationId), where))
    .orderBy(desc(incomes.receivedOn), desc(incomes.createdAt), desc(incomes.id)).limit(limit)
  return rows.map(({ income, ...row }) => ({
    id: income.id, budgetLine: income.budgetLineId && row.lineName ? { id: income.budgetLineId, name: row.lineName } : null,
    description: income.description, amount: income.amount, receivedOn: income.receivedOn, note: income.note,
    recordedBy: { id: income.recordedBy, name: row.recorderName },
    voided: income.voidedAt && income.voidedBy && income.voidReason
      ? { by: { id: income.voidedBy, name: row.voiderName ?? '' }, at: income.voidedAt.toISOString(), reason: income.voidReason } : null,
    version: income.version, createdAt: income.createdAt.toISOString(), updatedAt: income.updatedAt.toISOString(),
  }))
}

// 이 학생회·이 기간의 수입이다. 다른 기간 경로로는 찾지 않는다.
async function detailOf(db: Reader, scope: IncomeScope, periodId: string, incomeId: string): Promise<IncomeDetail> {
  const [summary] = await incomeSummaries(db, scope.organizationId, and(eq(incomes.periodId, periodId), eq(incomes.id, incomeId)), 1)
  if (!summary) throw new ApiError('NOT_FOUND', 404)
  const history = await db.select({ entry: incomeEvents, actorName: actors.name }).from(incomeEvents)
    .innerJoin(actors, eq(actors.id, incomeEvents.actorId))
    .where(and(eq(incomeEvents.organizationId, scope.organizationId), eq(incomeEvents.incomeId, incomeId)))
    .orderBy(asc(incomeEvents.createdAt), asc(incomeEvents.id))
  return { ...summary, history: history.map(({ entry, actorName }) => ({ id: entry.id, action: entry.action,
    actor: { id: entry.actorId, name: actorName }, changes: entry.changes, createdAt: entry.createdAt.toISOString() })) }
}

// 기간 행을 FOR SHARE로 잠근다. 편성 수정(FOR UPDATE)의 줄 지우기·날짜 바꾸기 확인과 수입 변경이 겹치지 않게 한다.
async function lockPeriod(tx: Transaction, scope: IncomeScope, periodId: string) {
  const [period] = await tx.select({ startsOn: budgetPeriods.startsOn, endsOn: budgetPeriods.endsOn }).from(budgetPeriods)
    .where(and(eq(budgetPeriods.organizationId, scope.organizationId), eq(budgetPeriods.id, periodId))).for('share')
  if (!period) throw new ApiError('NOT_FOUND', 404)
  return period
}
// 수입 행을 잠가 버전과 상태를 본다.
async function lockIncome(tx: Transaction, scope: IncomeScope, periodId: string, incomeId: string, version: number) {
  const [row] = await tx.select().from(incomes)
    .where(and(eq(incomes.organizationId, scope.organizationId), eq(incomes.periodId, periodId), eq(incomes.id, incomeId))).for('update')
  if (!row) throw new ApiError('NOT_FOUND', 404)
  if (row.version !== version) throw new ApiError('VERSION_CONFLICT', 409)
  if (row.voidedAt) throw new ApiError('INVALID_STATE', 409)
  return row
}
// 받은 날은 기간 안이고, 수입 항목은 그 기간의 수입 줄이어야 한다. 고른 줄의 이름을 돌려준다.
async function checkFields(tx: Transaction, scope: IncomeScope, periodId: string, period: { startsOn: string; endsOn: string },
  input: CreateIncomeRequest) {
  if (input.receivedOn < period.startsOn || input.receivedOn > period.endsOn) throw new ApiError('DATE_OUTSIDE_PERIOD', 409)
  if (input.budgetLineId === null) return null
  const [line] = await tx.select({ name: budgetLines.name, kind: budgetLines.kind, periodId: budgetLines.periodId }).from(budgetLines)
    .where(and(eq(budgetLines.organizationId, scope.organizationId), eq(budgetLines.id, input.budgetLineId)))
  if (!line || line.kind !== 'income' || line.periodId !== periodId) throw new ApiError('BUDGET_LINE_INVALID', 409)
  return line.name
}
async function lineName(db: Reader, lineId: string | null) {
  if (lineId === null) return null
  const [line] = await db.select({ name: budgetLines.name }).from(budgetLines).where(eq(budgetLines.id, lineId))
  return line?.name ?? null
}
async function record(tx: Transaction, scope: IncomeScope, incomeId: string, action: IncomeAction, changes: Record<string, unknown> = {}) {
  await tx.insert(incomeEvents).values({ id: randomUUID(), organizationId: scope.organizationId, incomeId, actorId: scope.userId, action, changes })
}
const fieldsOf = (input: CreateIncomeRequest) => ({ description: input.description, amount: input.amount, receivedOn: input.receivedOn,
  budgetLineId: input.budgetLineId, note: input.note })

// 실제 수입. 기록·수정·취소는 재정 권한자만 하고, 수입은 기간 하나에 속한다.
export function createIncomeService(db: IncomeDatabase) {
  return {
    get: (scope: IncomeScope, periodId: string, incomeId: string) => detailOf(db, scope, periodId, incomeId),
    async create(scope: IncomeScope, periodId: string, input: CreateIncomeRequest): Promise<IncomeDetail> {
      return db.transaction(async tx => {
        await requireFinance(tx, scope, true)
        const period = await lockPeriod(tx, scope, periodId)
        await checkFields(tx, scope, periodId, period, input)
        const id = randomUUID()
        await tx.insert(incomes).values({ id, organizationId: scope.organizationId, periodId, ...fieldsOf(input), recordedBy: scope.userId })
        await record(tx, scope, id, 'created')
        return detailOf(tx, scope, periodId, id)
      })
    },
    // 모든 칸을 받는다. 바뀐 칸만 이전·이후 값으로 남기고, 바뀐 것이 없으면 그대로 돌려준다.
    async update(scope: IncomeScope, periodId: string, incomeId: string, input: UpdateIncomeRequest): Promise<IncomeDetail> {
      return db.transaction(async tx => {
        await requireFinance(tx, scope, true)
        const period = await lockPeriod(tx, scope, periodId)
        const row = await lockIncome(tx, scope, periodId, incomeId, input.version)
        const nextLine = await checkFields(tx, scope, periodId, period, input)
        const changes: Record<string, unknown> = {}
        const plain = { description: input.description, amount: input.amount, receivedOn: input.receivedOn, note: input.note }
        for (const key of Object.keys(plain) as (keyof typeof plain)[]) {
          if (row[key] !== plain[key]) changes[key] = { from: row[key], to: plain[key] }
        }
        if (row.budgetLineId !== input.budgetLineId) changes.budgetLine = { from: await lineName(tx, row.budgetLineId), to: nextLine }
        if (!Object.keys(changes).length) return detailOf(tx, scope, periodId, incomeId)
        await tx.update(incomes).set({ ...fieldsOf(input), version: sql`${incomes.version} + 1` }).where(eq(incomes.id, incomeId))
        await record(tx, scope, incomeId, 'updated', changes)
        return detailOf(tx, scope, periodId, incomeId)
      })
    },
    // 지우지 않고 취소로 남긴다. 취소한 수입은 합계에서 빠진다.
    async void(scope: IncomeScope, periodId: string, incomeId: string, input: VoidIncomeRequest): Promise<IncomeDetail> {
      return db.transaction(async tx => {
        await requireFinance(tx, scope, true)
        await lockPeriod(tx, scope, periodId)
        await lockIncome(tx, scope, periodId, incomeId, input.version)
        await tx.update(incomes).set({ voidedAt: sql`now()`, voidedBy: scope.userId, voidReason: input.reason, version: sql`${incomes.version} + 1` })
          .where(eq(incomes.id, incomeId))
        await record(tx, scope, incomeId, 'voided', { reason: input.reason })
        return detailOf(tx, scope, periodId, incomeId)
      })
    },
  }
}
