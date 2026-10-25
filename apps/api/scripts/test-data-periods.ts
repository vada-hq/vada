import { and, eq } from 'drizzle-orm'
import { lockCouncil } from '../src/access/authorize.js'
import { actorOf } from '../src/access/actor.js'
import { currentPeriodOf } from '../src/budget/queries.js'
import { createFiscalPeriod } from '../src/budget/service.js'
import { cohort, fiscalPeriod } from '../src/db/schema.js'
import type { Db } from '../src/db/types.js'
import { requireGoogleUser, testCouncilId } from './test-data.js'

// 끝난 기간(기능 009 리허설용). 이름과 끝일이 같으면 이미 있는 것으로 본다.
export const TEST_PAST_PERIOD_NAME = '시험 1학기'
const SEMESTER_DAYS = 180
const MS_PER_DAY = 86_400_000
const ISO_DATE_LENGTH = 'YYYY-MM-DD'.length

const shiftDay = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * MS_PER_DAY)
    .toISOString()
    .slice(0, ISO_DATE_LENGTH)

// 시험 학생회에 지금 기간과 그 바로 앞의 끝난 기간을 둔다. 지금 기간의 이름과 날짜는 지금 기수의 것이다.
// 이미 있으면 바꾸지 않고 'unchanged'를 돌려준다. 만들기와 이전 기간 잇기는 예산 서비스(createFiscalPeriod)가 한다(재정부 계정이어야 한다).
export async function seedTestPeriods(
  db: Db,
  userId: string,
  now: Date,
): Promise<'created' | 'unchanged'> {
  return db.transaction(async tx => {
    await requireGoogleUser(tx, userId)
    const councilId = await testCouncilId(tx)
    if (!councilId) throw new Error('Seed the test council first')
    await lockCouncil(tx, councilId)
    const actor = await actorOf(tx, userId, councilId, now)
    if (!actor) throw new Error('Test council has no current cohort')
    const current = await currentPeriodOf(tx, actor, now)
    const [cohortRow] = await tx
      .select({ name: cohort.name, startsOn: cohort.startsOn, endsOn: cohort.endsOn })
      .from(cohort)
      .where(eq(cohort.id, actor.cohortId))
    const base = current ?? cohortRow
    if (!base) throw new Error('Test council has no current cohort')
    const past = {
      name: TEST_PAST_PERIOD_NAME,
      startsOn: shiftDay(base.startsOn, -SEMESTER_DAYS - 1),
      endsOn: shiftDay(base.startsOn, -1),
    }
    const [found] = await tx
      .select({ endsOn: fiscalPeriod.endsOn })
      .from(fiscalPeriod)
      .where(and(eq(fiscalPeriod.councilId, councilId), eq(fiscalPeriod.name, past.name)))
    const hasPast = found?.endsOn === past.endsOn
    if (current) {
      if (hasPast) return 'unchanged'
      throw new Error('Current period exists without the test past period')
    }
    // 끝난 기간을 먼저 만들어야 지금 기간이 그것을 이전 기간으로 잇는다.
    if (!hasPast) await createFiscalPeriod(tx, actor, past)
    await createFiscalPeriod(tx, actor, {
      name: base.name,
      startsOn: base.startsOn,
      endsOn: base.endsOn,
    })
    return 'created'
  })
}
