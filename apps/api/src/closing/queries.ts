import { and, desc, eq, isNotNull } from 'drizzle-orm'
import {
  CLOSING_EXPORT_MAX_BYTES,
  CLOSING_EXPORT_MAX_PHOTOS,
  CLOSING_EXPORT_MAX_ROWS,
  koreanDateOf,
  type Closing,
  type ClosingAction,
  type ClosingStatus,
  type FiscalPeriodsResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { accountClosing, fiscalPeriod, record } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { expenseChecksOf } from './checks.js'
import { closingNumbersOf } from './numbers.js'
import { closingPeriodOf, type ClosingPeriod } from './period.js'
import { feePendingOf } from './pending.js'
import {
  accountRowsOf,
  budgetItemsOf,
  expenseCountOf,
  expenseRowsOf,
  incomeRowsOf,
  photoTotalsOf,
} from './totals.js'

type Reader = Pick<Db, 'select'>

// 기간마다 공개한 때. 결산 기록이 없거나 공개 전이면 없다. 기록은 기간마다 하나지만 여럿이어도 공개한 것이 있으면 공개로 본다.
async function publishedAtOf(db: Reader, actor: Actor): Promise<Map<string, Date>> {
  const rows = await db
    .select({ periodId: accountClosing.fiscalPeriodId, at: accountClosing.publishedAt })
    .from(accountClosing)
    .innerJoin(record, eq(record.id, accountClosing.id))
    .where(and(eq(record.councilId, actor.councilId), isNotNull(accountClosing.publishedAt)))
  const published = new Map<string, Date>()
  for (const row of rows) if (row.at) published.set(row.periodId, row.at)
  return published
}

const statusOf = (publishedAt: Date | null | undefined): ClosingStatus =>
  publishedAt ? 'published' : 'draft'

// 이 학생회의 회계 기간 목록(시작이 늦은 순)과 결산 상태. 모든 운영진이 본다.
export async function fiscalPeriodsOf(
  db: Reader,
  actor: Actor,
  now: Date,
): Promise<FiscalPeriodsResponse> {
  const today = koreanDateOf(now)
  const rows = await db
    .select({
      id: fiscalPeriod.id,
      name: fiscalPeriod.name,
      startsOn: fiscalPeriod.startsOn,
      endsOn: fiscalPeriod.endsOn,
      previousPeriodId: fiscalPeriod.previousPeriodId,
    })
    .from(fiscalPeriod)
    .where(eq(fiscalPeriod.councilId, actor.councilId))
    .orderBy(desc(fiscalPeriod.startsOn), desc(fiscalPeriod.id))
  const published = await publishedAtOf(db, actor)
  return {
    periods: rows.map(row => ({
      ...row,
      current: row.startsOn <= today && today <= row.endsOn,
      status: statusOf(published.get(row.id)),
      publishedAt: published.get(row.id)?.toISOString() ?? null,
    })),
  }
}

// 보이는 동작. 공개와 다시 열기는 재정부만이고, 공개용 내보내기는 공개한 뒤 모든 운영진이, 감사용은 재정부만이 받는다.
// 공개할 수 있는 조건(끝난 기간, 이전 기간, 남은 돈, 행사 완료)은 공개 쓰기가 본다.
function actionsOf(actor: Actor, status: ClosingStatus): ClosingAction[] {
  const finance = can(actor, 'finance.manage')
  const published = status === 'published'
  const actions: ClosingAction[] = []
  if (finance) actions.push(published ? 'closing.reopen' : 'closing.publish')
  if (finance || published) actions.push('closing.export_public')
  if (finance) actions.push('closing.export_audit')
  return actions
}

async function exportInfoOf(db: Reader, actor: Actor, period: ClosingPeriod, incomeCount: number) {
  const photos = await photoTotalsOf(db, actor, period)
  const expenseCount = await expenseCountOf(db, actor, period)
  return {
    expenseCount,
    incomeCount,
    photoCount: photos.count,
    photoBytes: photos.bytes,
    tooLarge:
      expenseCount > CLOSING_EXPORT_MAX_ROWS ||
      incomeCount > CLOSING_EXPORT_MAX_ROWS ||
      photos.count > CLOSING_EXPORT_MAX_PHOTOS ||
      photos.bytes > CLOSING_EXPORT_MAX_BYTES,
  }
}

// 결산서 하나. 공개 전에는 재정부만 본다(403). 한 읽기 거래에서 모두 만든다.
export async function closingOf(db: Reader, actor: Actor, periodId: string): Promise<Closing> {
  const period = await closingPeriodOf(db, actor, periodId)
  const publishedAt = (await publishedAtOf(db, actor)).get(period.id) ?? null
  const status = statusOf(publishedAt)
  if (status === 'draft' && !can(actor, 'finance.manage')) throw new ApiError('FORBIDDEN')
  const incomes = await incomeRowsOf(db, actor, period)
  const numbers = closingNumbersOf({
    items: await budgetItemsOf(db, period),
    incomes,
    expenses: await expenseRowsOf(db, actor, period),
    accounts: await accountRowsOf(db, actor),
  })
  return {
    period: { id: period.id, name: period.name, startsOn: period.startsOn, endsOn: period.endsOn },
    status,
    publishedAt: publishedAt?.toISOString() ?? null,
    ...numbers,
    checks: await expenseChecksOf(db, actor, period),
    feePending: await feePendingOf(db, actor, period),
    exportInfo: await exportInfoOf(
      db,
      actor,
      period,
      incomes.reduce((all, row) => all + row.count, 0),
    ),
    actions: actionsOf(actor, status),
  }
}
