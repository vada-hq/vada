import { and, eq, inArray } from 'drizzle-orm'
import { currentCouncilMembership } from '../access/current-cohort.js'
import { cohort, councilMembership } from '../db/schema.js'
import type { Db } from '../db/types.js'

// 이 중 지금 이 학생회의 운영진인 사람. 1:1의 참여 줄은 학생회를 떠난 뒤에도 남고 기록 모듈은 끝난 소속에게도 알림 기록을 허용하므로,
// 상대가 지금도 운영진인지는 참여 줄과 따로 여기서 본다.
export async function currentMembersAmong(
  db: Pick<Db, 'select'>,
  councilId: string,
  memberIds: readonly string[],
  now: Date,
) {
  if (!memberIds.length) return new Set<string>()
  const rows = await db
    .select({ memberId: councilMembership.memberId })
    .from(councilMembership)
    .innerJoin(cohort, eq(cohort.id, councilMembership.cohortId))
    .where(
      and(
        eq(cohort.councilId, councilId),
        inArray(councilMembership.memberId, [...memberIds]),
        currentCouncilMembership(now),
      ),
    )
  return new Set(rows.map(row => row.memberId))
}
