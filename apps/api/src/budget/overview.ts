import { and, asc, desc, eq, exists, inArray, isNull, notExists, or, sql } from 'drizzle-orm'
import {
  FINANCE_RECENT_EXPENSES,
  koreanDateOf,
  type EventRef,
  type FinanceOverview,
  type FinanceOverviewEvent,
  type FinanceOverviewItem,
  type FinanceOverviewResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { paidWithin } from '../closing/period.js'
import { budgetItem, event, expense, lineItem, paymentLine, record, request } from '../db/schema.js'
import { countAll, sumOf } from '../db/sums.js'
import type { Db } from '../db/types.js'
import { allOpenEventsOf } from '../events/queries.js'
import { currentPeriodOf, pickedPeriodOf } from './queries.js'
import { budgetItemsWithUsage, committedLine, type BudgetItemRow } from './usage.js'

type Reader = Pick<Db, 'select'>
type Period = NonNullable<Awaited<ReturnType<typeof currentPeriodOf>>>

// 재정 첫 화면(개요)의 셈(DEC-92). 홈의 재정 요약도 이 함수를 쓸 예정이다(DEC-95, 아직 연결하지 않음).
// 실제 지출은 예산 셈(usage.ts)과 같은 기준이다: 예산 항목에 든 지출은 결제일과 상관없이 그 항목의 기간에 든다.
// 결제일로 거르면 기간 끝에 승인하고 다음 기간에 결제한 품목이 약정에서 빠지는데 실제에도 들지 않아 사용 가능이 부풀고,
// 예산 탭·결재 화면의 같은 항목과 숫자가 달라진다. 예산 항목이 없는 지출만 고를 항목이 없어 결제일(한국 날짜)로 기간에 든다.
// 결산서(closing/)는 기간의 현금 보고라 결제일로 세고, 다른 기간 항목의 지출은 '다른 기간 항목' 줄로 따로 보인다.

const thisBudget = (budgetId: string) => eq(budgetItem.budgetId, budgetId)

// 결제 내역이 없는 지출(요청을 거치지 않았다)
const noLines = (db: Reader) =>
  notExists(
    db
      .select({ one: sql`1` })
      .from(paymentLine)
      .where(eq(paymentLine.expenseId, expense.id)),
  )

// 이 개요에 드는 이 학생회의 취소하지 않은 지출: 이 기간 항목에 직접 이었거나, 결제 내역의 품목이 이 기간 항목이거나, 항목 없이 기간 안에 결제했다.
function countedExpense(db: Reader, councilId: string, period: Period) {
  const items = db.select({ id: budgetItem.id }).from(budgetItem).where(thisBudget(period.budgetId))
  const linesHere = db
    .select({ one: sql`1` })
    .from(paymentLine)
    .innerJoin(lineItem, eq(lineItem.id, paymentLine.lineItemId))
    .innerJoin(budgetItem, eq(budgetItem.id, lineItem.budgetItemId))
    .where(and(eq(paymentLine.expenseId, expense.id), thisBudget(period.budgetId)))
  return and(
    eq(record.councilId, councilId),
    isNull(expense.cancelledAt),
    or(
      inArray(expense.budgetItemId, items),
      exists(linesHere),
      and(isNull(expense.budgetItemId), noLines(db), paidWithin(period)),
    ),
  )
}

async function noItemTotalOf(db: Reader, councilId: string, period: Period) {
  const [row] = await db
    .select({ amount: sumOf(expense.amount) })
    .from(expense)
    .innerJoin(record, eq(record.id, expense.id))
    .where(
      and(
        eq(record.councilId, councilId),
        isNull(expense.cancelledAt),
        isNull(expense.budgetItemId),
        noLines(db),
        paidWithin(period),
      ),
    )
  return row?.amount ?? 0
}

async function paidCountOf(db: Reader, councilId: string, period: Period) {
  const [row] = await db
    .select({ count: countAll })
    .from(expense)
    .innerJoin(record, eq(record.id, expense.id))
    .where(countedExpense(db, councilId, period))
  return row?.count ?? 0
}

async function recentOf(db: Reader, councilId: string, period: Period) {
  const rows = await db
    .select({
      id: expense.id,
      paidAt: expense.paidAt,
      description: expense.description,
      vendor: expense.vendor,
      amount: expense.amount,
      eventId: event.id,
      eventName: event.name,
    })
    .from(expense)
    .innerJoin(record, eq(record.id, expense.id))
    .leftJoin(event, eq(event.id, expense.eventId))
    .where(countedExpense(db, councilId, period))
    .orderBy(desc(expense.paidAt), desc(expense.id))
    .limit(FINANCE_RECENT_EXPENSES)
  return rows.map(({ paidAt, amount, eventId, eventName, ...rest }) => ({
    ...rest,
    paidOn: koreanDateOf(paidAt),
    amount: Number(amount),
    event: eventId && eventName ? { id: eventId, name: eventName } : null,
  }))
}

// 지출 예정에 든 품목 수: 취소하지 않은 요청에서 마지막 결재가 승인이고 결제가 승인 금액에 못 미친 품목(usage.ts 약정과 같은 조건).
async function committedCountOf(db: Reader, councilId: string, period: Period) {
  const [row] = await db
    .select({ count: countAll })
    .from(lineItem)
    .innerJoin(record, eq(record.id, lineItem.id))
    .innerJoin(request, eq(request.id, lineItem.requestId))
    .innerJoin(budgetItem, eq(budgetItem.id, lineItem.budgetItemId))
    .where(
      and(thisBudget(period.budgetId), eq(record.councilId, councilId), committedLine(councilId)),
    )
  return row?.count ?? 0
}

function expenseItemsOf(rows: BudgetItemRow[]): FinanceOverviewItem[] {
  return rows.flatMap(({ id, purpose, amount, eventId, eventName, usage }) =>
    usage.type === 'expense'
      ? [
          {
            id,
            purpose,
            amount,
            ...usage,
            event: eventId && eventName ? { id: eventId, name: eventName } : null,
          },
        ]
      : [],
  )
}

// 행사마다 그 행사를 고른 지출 항목의 합. 행사 이름순이다.
function eventsOf(items: FinanceOverviewItem[]): FinanceOverviewEvent[] {
  const byEvent = new Map<string, FinanceOverviewEvent>()
  for (const item of items) {
    if (!item.event) continue
    const held = byEvent.get(item.event.id) ?? {
      event: item.event,
      amount: 0,
      actual: 0,
      committed: 0,
      available: 0,
    }
    byEvent.set(item.event.id, {
      event: held.event,
      amount: held.amount + item.amount,
      actual: held.actual + item.actual,
      committed: held.committed + item.committed,
      available: held.available + item.available,
    })
  }
  return [...byEvent.values()].sort((a, b) => a.event.name.localeCompare(b.event.name, 'ko'))
}

// 예산 미입력 행사: 받은 완료 전 행사 가운데 이 기간의 지출 예산 항목이 없는 것
const missingEventsOf = (open: EventRef[], events: FinanceOverviewEvent[]) =>
  open
    .filter(row => !events.some(item => item.event.id === row.id))
    .map(({ id, name }) => ({ id, name }))

const sum = (values: number[]) => values.reduce((all, value) => all + value, 0)

// 기간 하나의 개요. 기간은 이 학생회 것이어야 한다(부르는 쪽이 고른다).
async function overviewOfPeriod(
  db: Reader,
  councilId: string,
  period: Period,
  open: EventRef[],
): Promise<FinanceOverview> {
  const rows = await budgetItemsWithUsage(db, councilId, thisBudget(period.budgetId), [
    asc(budgetItem.purpose),
    asc(budgetItem.id),
  ])
  const incomes = rows.filter(row => row.usage.type === 'income')
  const items = expenseItemsOf(rows)
  const noItem = await noItemTotalOf(db, councilId, period)
  const events = eventsOf(items)
  const total = sum(incomes.map(row => row.amount))
  const actual = sum(items.map(item => item.actual)) + noItem
  const committed = sum(items.map(item => item.committed))
  const { id, name, startsOn, endsOn } = period
  return {
    period: { id, name, startsOn, endsOn },
    total,
    sources: incomes.map(row => row.purpose),
    actual,
    committed,
    available: total - actual - committed,
    paidCount: await paidCountOf(db, councilId, period),
    committedCount: await committedCountOf(db, councilId, period),
    events,
    missingEvents: missingEventsOf(open, events),
    items,
    noItem,
    recent: await recentOf(db, councilId, period),
  }
}

function includesToday(period: Period, now: Date) {
  const today = koreanDateOf(now)
  return period.startsOn <= today && today <= period.endsOn
}

// 오늘이 든 기간의 개요. 완료 전 행사를 이미 읽은 홈이 다시 읽지 않게 받는다. 기간이 없으면 null이다.
export async function currentOverviewOf(db: Reader, actor: Actor, now: Date, open: EventRef[]) {
  const period = await currentPeriodOf(db, actor, now)
  return period ? overviewOfPeriod(db, actor.councilId, period, open) : null
}

// 고른 기간(다른 학생회 것이면 404)이나 오늘이 든 기간의 개요. 기간이 없으면 null이다.
export async function financeOverviewOf(
  db: Reader,
  actor: Actor,
  now: Date,
  periodId?: string,
): Promise<FinanceOverviewResponse> {
  const period = await pickedPeriodOf(db, actor, now, periodId)
  if (!period) return { overview: null }
  const open = includesToday(period, now) ? await allOpenEventsOf(db, actor, now) : []
  return { overview: await overviewOfPeriod(db, actor.councilId, period, open) }
}
