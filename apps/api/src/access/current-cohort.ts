import { and, gte, isNull, lte } from 'drizzle-orm'
import { koreanDateOf } from '@vada/contracts'
import { cohort, councilMembership } from '../db/schema.js'

// "지금"의 뜻을 한 곳에 둔다. 기수는 기간이 오늘(한국 날짜)을 담을 때 지금 기수이고,
// 학생회 소속은 끝나지 않은 채 지금 기수에 있을 때 지금 소속이다. 접근 검사, 내 학생회 목록, 초대로 들어오기,
// 기수 기간 고치기, 시험 데이터가 모두 이것을 써서 서로 다른 답을 내지 않는다.

// cohort 표를 담은 조회에서 "기간이 오늘을 담는다"는 조건
export function cohortIsCurrent(now: Date) {
  const today = koreanDateOf(now)
  return and(lte(cohort.startsOn, today), gte(cohort.endsOn, today))
}

// 같은 규칙을 아직 DB에 없는 기간 값에 적용한다(기수를 만들거나 고치기 전에 본다).
export function periodIsCurrent(period: { startsOn: string; endsOn: string }, now: Date) {
  const today = koreanDateOf(now)
  return period.startsOn <= today && today <= period.endsOn
}

// 학생회 소속(councilMembership)과 그 기수(cohort)를 합친 조회에서 "지금 소속"을 뜻하는 조건
export function currentCouncilMembership(now: Date) {
  return and(isNull(councilMembership.endsAt), cohortIsCurrent(now))
}
