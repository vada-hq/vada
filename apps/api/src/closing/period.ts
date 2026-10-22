import { and, eq, gte, lt } from 'drizzle-orm'
import { DAY_MS, dateFromKorean } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { budget, expense, fiscalPeriod } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'

type Reader = Pick<Db, 'select'>

export type ClosingPeriod = {
  id: string
  name: string
  startsOn: string
  endsOn: string
  // 예산이 없는 기간은 없지만(기간을 만들 때 같이 만든다) 읽기는 없어도 비어 보일 뿐 실패하지 않는다.
  budgetId: string | null
  previousPeriodId: string | null
}

// 한국 날짜 [시작일 0시, 끝일 다음 날 0시). 한국 날짜가 기간 안인 순간만 든다(±1초 경계).
export function koreanDayRange(startsOn: string, endsOn: string) {
  return {
    from: dateFromKorean(`${startsOn}T00:00`),
    until: new Date(dateFromKorean(`${endsOn}T00:00`).getTime() + DAY_MS),
  }
}

// 결제 시각의 한국 날짜가 기간 안인 지출(현금주의, 기능 009 '정한 것').
export function paidWithin(period: Pick<ClosingPeriod, 'startsOn' | 'endsOn'>) {
  const { from, until } = koreanDayRange(period.startsOn, period.endsOn)
  return and(gte(expense.paidAt, from), lt(expense.paidAt, until))
}

// 이 학생회의 회계 기간 하나. 다른 학생회의 기간은 없는 것과 같아 404다.
export async function closingPeriodOf(
  db: Reader,
  actor: Actor,
  periodId: string,
): Promise<ClosingPeriod> {
  const [row] = await db
    .select({
      id: fiscalPeriod.id,
      name: fiscalPeriod.name,
      startsOn: fiscalPeriod.startsOn,
      endsOn: fiscalPeriod.endsOn,
      previousPeriodId: fiscalPeriod.previousPeriodId,
      budgetId: budget.id,
    })
    .from(fiscalPeriod)
    .leftJoin(budget, eq(budget.fiscalPeriodId, fiscalPeriod.id))
    .where(and(eq(fiscalPeriod.id, periodId), eq(fiscalPeriod.councilId, actor.councilId)))
  if (!row) throw new ApiError('NOT_FOUND')
  return row
}
