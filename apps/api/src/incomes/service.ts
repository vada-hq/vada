import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, isNull, sql, type SQL } from 'drizzle-orm'
import { alias, type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { codePoints, INCOME_DESCRIPTION_MAX, koreanOf, type CreateIncomeRequest, type EventFeeIncome, type IncomeAction, type IncomeDetail,
  type IncomeSummary, type UpdateIncomeRequest, type VoidIncomeRequest } from '@vada/contracts'
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
const sources = alias(budgetPeriods, 'income_sources')

// 상세·변경 응답과 예산 화면의 수입 내역이 같은 칸을 쓴다. 받은 날·기록이 최근인 순이다.
export async function incomeSummaries(db: Reader, organizationId: string, where: SQL | undefined, limit: number): Promise<IncomeSummary[]> {
  const rows = await db.select({ income: incomes, lineName: lines.name, recorderName: recorders.name, voiderName: voiders.name,
    sourceName: sources.name }).from(incomes)
    .leftJoin(lines, and(eq(lines.id, incomes.budgetLineId), eq(lines.organizationId, incomes.organizationId)))
    .innerJoin(recorders, eq(recorders.id, incomes.recordedBy))
    .leftJoin(voiders, eq(voiders.id, incomes.voidedBy))
    .leftJoin(sources, and(eq(sources.id, incomes.carriedFromPeriodId), eq(sources.organizationId, incomes.organizationId)))
    .where(and(eq(incomes.organizationId, organizationId), where))
    .orderBy(desc(incomes.receivedOn), desc(incomes.createdAt), desc(incomes.id)).limit(limit)
  return rows.map(({ income, ...row }) => ({
    id: income.id, budgetLine: income.budgetLineId && row.lineName ? { id: income.budgetLineId, name: row.lineName } : null,
    description: income.description, amount: income.amount, receivedOn: income.receivedOn, note: income.note,
    recordedBy: { id: income.recordedBy, name: row.recorderName },
    voided: income.voidedAt && income.voidedBy && income.voidReason
      ? { by: { id: income.voidedBy, name: row.voiderName ?? '' }, at: income.voidedAt.toISOString(), reason: income.voidReason } : null,
    carriedFrom: income.carriedFromPeriodId ? { id: income.carriedFromPeriodId, name: row.sourceName ?? '' } : null,
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
// 마감(FOR UPDATE)과도 겹치지 않으므로, 잠근 뒤 본 마감 여부는 이 거래가 끝날 때까지 그대로다.
async function lockPeriod(tx: Transaction, scope: IncomeScope, periodId: string) {
  const [period] = await tx.select({ startsOn: budgetPeriods.startsOn, endsOn: budgetPeriods.endsOn, closedAt: budgetPeriods.closedAt })
    .from(budgetPeriods).where(and(eq(budgetPeriods.organizationId, scope.organizationId), eq(budgetPeriods.id, periodId))).for('share')
  if (!period) throw new ApiError('NOT_FOUND', 404)
  if (period.closedAt) throw new ApiError('PERIOD_CLOSED', 409)
  return period
}
// 수입 행을 잠가 버전과 상태를 본다. 이월금은 앞 기간 마감을 다시 열어야만 바뀐다.
async function lockIncome(tx: Transaction, scope: IncomeScope, periodId: string, incomeId: string, version: number) {
  const [row] = await tx.select().from(incomes)
    .where(and(eq(incomes.organizationId, scope.organizationId), eq(incomes.periodId, periodId), eq(incomes.id, incomeId))).for('update')
  if (!row) throw new ApiError('NOT_FOUND', 404)
  if (row.carriedFromPeriodId) throw new ApiError('CARRYOVER_INCOME', 409)
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

// 마감한 기간의 남은 돈을 다음 기간 시작일의 수입 한 건으로 넘긴다. 수입 항목이 다음 기간의 수입 줄인지는 부르는 쪽이 확인한다.
export async function insertCarryover(tx: Transaction, scope: IncomeScope, input: { from: { id: string; name: string };
  to: { id: string; startsOn: string }; amount: number; budgetLineId: string | null }) {
  const id = randomUUID()
  await tx.insert(incomes).values({ id, organizationId: scope.organizationId, periodId: input.to.id, budgetLineId: input.budgetLineId,
    description: `${input.from.name} 이월금`, amount: input.amount, receivedOn: input.to.startsOn, note: null, recordedBy: scope.userId,
    carriedFromPeriodId: input.from.id })
  await record(tx, scope, id, 'created')
}
// 마감을 다시 열면 그 기간이 넘긴 이월금을 취소한다.
export async function voidCarryover(tx: Transaction, scope: IncomeScope, from: { id: string; name: string }) {
  await voidWhere(tx, scope, eq(incomes.carriedFromPeriodId, from.id), `${from.name} 마감을 다시 열었어요`)
}
// 앱이 넣은 수입(이월금·참가비 수입)을 원래 기록을 다시 열 때 취소한다.
async function voidWhere(tx: Transaction, scope: IncomeScope, which: SQL, reason: string) {
  const voided = await tx.update(incomes).set({ voidedAt: sql`now()`, voidedBy: scope.userId, voidReason: reason, version: sql`${incomes.version} + 1` })
    .where(and(eq(incomes.organizationId, scope.organizationId), which, isNull(incomes.voidedAt)))
    .returning({ id: incomes.id })
  for (const row of voided) await record(tx, scope, row.id, 'voided', { reason })
}

// 그 기간의 수입 줄(편성 순서). 이월금·참가비 수입 항목을 고를 때 쓴다.
export async function incomeLinesOf(db: Reader, organizationId: string, periodId: string) {
  const rows = await db.select({ id: budgetLines.id, name: budgetLines.name }).from(budgetLines)
    .where(and(eq(budgetLines.organizationId, organizationId), eq(budgetLines.periodId, periodId), eq(budgetLines.kind, 'income')))
    .orderBy(asc(budgetLines.position), asc(budgetLines.id))
  return rows.map(line => ({ id: line.id, name: line.name! }))
}
const FEE_SUFFIX = ' 참가비'
// 참가비 수입의 내용. 수입 내용 상한을 넘으면 행사 이름 뒤를 줄이고 "…"를 붙인다. 글자는 DB처럼 코드 포인트로 센다.
export function feeIncomeDescription(eventName: string) {
  const room = INCOME_DESCRIPTION_MAX - codePoints(FEE_SUFFIX)
  const chars = [...eventName]
  return `${chars.length > room ? `${chars.slice(0, room - 1).join('')}…` : eventName}${FEE_SUFFIX}`
}
// 참가비 수입의 받은 날: 마지막으로 입금을 확인한 한국 날짜. 기간 밖이면 가까운 쪽 끝날이다(수입 기록 대화상자의 기본값과 같다).
export function feeIncomeDay(lastPaidAt: Date, period: { startsOn: string; endsOn: string }) {
  const day = koreanOf(lastPaidAt).slice(0, 10)
  return day < period.startsOn ? period.startsOn : day > period.endsOn ? period.endsOn : day
}
// 정산한 행사의 받은 참가비를 그 행사가 든 기간의 수입 한 건으로 넣는다. 수입 항목이 그 기간의 수입 줄인지는 부르는 쪽이 확인한다.
export async function insertFeeIncome(tx: Transaction, scope: IncomeScope, input: { event: { id: string; name: string };
  period: { id: string; startsOn: string; endsOn: string }; amount: number; count: number; lastPaidAt: Date; budgetLineId: string | null }) {
  const id = randomUUID()
  await tx.insert(incomes).values({ id, organizationId: scope.organizationId, periodId: input.period.id, budgetLineId: input.budgetLineId,
    description: feeIncomeDescription(input.event.name), amount: input.amount, receivedOn: feeIncomeDay(input.lastPaidAt, input.period),
    note: `입금 확인 ${input.count}명`, recordedBy: scope.userId, eventId: input.event.id })
  await record(tx, scope, id, 'created')
}
// 행사 정산을 다시 열면 그 행사의 참가비 수입을 취소한다.
export async function voidFeeIncome(tx: Transaction, scope: IncomeScope, event: { id: string; name: string }) {
  await voidWhere(tx, scope, eq(incomes.eventId, event.id), `${event.name} 정산을 다시 열었어요`)
}
// 행사의 취소하지 않은 참가비 수입과 그 기간·수입 줄 이름
export async function feeIncomeOf(db: Reader, organizationId: string, eventId: string): Promise<EventFeeIncome | null> {
  const [row] = await db.select({ id: incomes.id, amount: incomes.amount, periodId: incomes.periodId, periodName: budgetPeriods.name,
    lineId: incomes.budgetLineId, lineName: lines.name }).from(incomes)
    .innerJoin(budgetPeriods, and(eq(budgetPeriods.id, incomes.periodId), eq(budgetPeriods.organizationId, incomes.organizationId)))
    .leftJoin(lines, and(eq(lines.id, incomes.budgetLineId), eq(lines.organizationId, incomes.organizationId)))
    .where(and(eq(incomes.organizationId, organizationId), eq(incomes.eventId, eventId), isNull(incomes.voidedAt)))
  if (!row) return null
  return { id: row.id, amount: row.amount, period: { id: row.periodId, name: row.periodName },
    line: row.lineId && row.lineName ? { id: row.lineId, name: row.lineName } : null }
}

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
