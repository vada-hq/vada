import { and, eq, gt, isNull, lte, notExists, sql, type SQL } from 'drizzle-orm'
import { alias, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { koreanDateOf } from '@vada/contracts'
import { cohort, councilMembership } from '../db/schema.js'

// "지금"의 뜻을 한 곳에 둔다(DEC-57). 지금 기수는 그 학생회에서 시작일이 오늘(한국 날짜) 이전(같은 날 포함)인 기수 중
// 시작일이 가장 늦은 것이다. 끝 날짜는 표시와 보고에만 쓰고 접근을 정하지 않는다: 학기 말 결산과 인수인계 때 잠그지 않는다.
// 학생회 소속은 끝나지 않은 채 지금 기수에 있을 때 지금 소속이다. 접근 검사, 내 학생회 목록, 초대로 들어오기,
// 업무 선택지, 시험 데이터가 모두 이것을 써서 서로 다른 답을 내지 않는다.
// 한 학생회의 기수 기간은 겹치지 않으므로(EXCLUDE 제약) 시작일이 같은 기수는 없고 지금 기수는 많아야 하나다.

const LATER = 'later_cohort'
const laterCohort = alias(cohort, LATER)

// target 기수가 그날(한국 날짜)의 기수라는 조건: 그날까지 시작했고, 같은 학생회에 그날까지 그보다 늦게 시작한 기수가 없다.
// target은 cohort 표나 그 별칭이다. 기록(공지)의 기수는 보낸 날로 같은 규칙을 쓴다(DEC-57 '결과').
export function cohortOfDay(
  target: { councilId: AnyPgColumn; startsOn: AnyPgColumn },
  day: string | SQL,
) {
  return and(
    lte(target.startsOn, day),
    notExists(
      sql`(select 1 from ${cohort} ${sql.identifier(LATER)} where ${and(
        eq(laterCohort.councilId, target.councilId),
        gt(laterCohort.startsOn, target.startsOn),
        lte(laterCohort.startsOn, day),
      )})`,
    ),
  )
}

// cohort 표를 담은 조회에서 "지금 기수"라는 조건
export function cohortIsCurrent(now: Date) {
  return cohortOfDay(cohort, koreanDateOf(now))
}

// 아직 DB에 없는 기간 값이 시작했는가(기수를 만들거나 고치기 전에 본다). 시작 전 기수만 있으면 아무도 학생회를 열 수 없다.
export function periodHasStarted(period: { startsOn: string }, now: Date) {
  return period.startsOn <= koreanDateOf(now)
}

// 학생회 소속(councilMembership)과 그 기수(cohort)를 합친 조회에서 "지금 소속"을 뜻하는 조건
export function currentCouncilMembership(now: Date) {
  return and(isNull(councilMembership.endsAt), cohortIsCurrent(now))
}
