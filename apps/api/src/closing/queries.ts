import { and, desc, eq, isNotNull } from 'drizzle-orm'
import {
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
import { exportInfoOf } from './export-info.js'
import { closingFiguresOf } from './figures.js'
import { publishGateOf, reopenGateOf } from './gates.js'
import { closingPeriodOf, type ClosingPeriod } from './period.js'
import { feePendingOf } from './pending.js'

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

// 보이는 동작. 공개와 다시 열기는 재정부만이고 되는 때만 준다(막는 판단은 gates.ts 하나다). 공개용 내보내기는 공개한 뒤 모든 운영진이, 감사용은 재정부만이 받는다.
async function actionsOf(
  db: Reader,
  actor: Actor,
  period: ClosingPeriod,
  facts: { status: ClosingStatus; now: Date },
): Promise<ClosingAction[]> {
  const finance = can(actor, 'finance.manage')
  const published = facts.status === 'published'
  const actions: ClosingAction[] = []
  if (finance && published && !(await reopenGateOf(db, actor, period)))
    actions.push('closing.reopen')
  if (finance && !published && !(await publishGateOf(db, actor, period, facts.now)).blocker)
    actions.push('closing.publish')
  if (finance || published) actions.push('closing.export_public')
  if (finance) actions.push('closing.export_audit')
  return actions
}

// 결산서 하나. 공개 전에는 재정부만 본다(403). 한 읽기 거래에서 모두 만든다.
export async function closingOf(
  db: Reader,
  actor: Actor,
  periodId: string,
  now: Date,
): Promise<Closing> {
  const period = await closingPeriodOf(db, actor, periodId)
  const publishedAt = (await publishedAtOf(db, actor)).get(period.id) ?? null
  const status = statusOf(publishedAt)
  if (status === 'draft' && !can(actor, 'closing.view_draft')) throw new ApiError('FORBIDDEN')
  const { incomes, numbers } = await closingFiguresOf(db, actor, period)
  return {
    period: { id: period.id, name: period.name, startsOn: period.startsOn, endsOn: period.endsOn },
    status,
    publishedAt: publishedAt?.toISOString() ?? null,
    ...numbers,
    checks: await expenseChecksOf(db, actor, period),
    feePending: await feePendingOf(db, actor, period),
    exportInfo: await exportInfoOf(db, actor, period, {
      incomeCount: incomes.reduce((all, row) => all + row.count, 0),
      // 파일 저장소가 있는지는 라우트가 안다. 응답을 내보내는 라우트가 채운다(routes.ts).
      bundleAvailable: false,
    }),
    actions: await actionsOf(db, actor, period, { status, now }),
  }
}
