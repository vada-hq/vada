import { and, count, eq, isNull, notExists } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { councilMembership, departmentMembership } from '../db/schema.js'
import type { Db } from '../db/types.js'

type Reader = Pick<Db, 'select'>

// 미배정 운영진(DEC-87): 이 학생회 지금 기수의 끝나지 않은 학생회 소속이 있고, 학생회 직급이 없고, 그 기수에 열린 부서 소속이 없다.
// 기수(actor.cohortId)가 학생회를 가른다. 다른 학생회에서 부서가 있는 사람도 이 기수에 부서가 없으면 센다.
export async function unassignedMembersOf(db: Reader, actor: Actor): Promise<number> {
  const placed = db
    .select({ id: departmentMembership.id })
    .from(departmentMembership)
    .where(
      and(
        eq(departmentMembership.memberId, councilMembership.memberId),
        eq(departmentMembership.cohortId, actor.cohortId),
        isNull(departmentMembership.endsAt),
      ),
    )
  const [row] = await db
    .select({ total: count() })
    .from(councilMembership)
    .where(
      and(
        eq(councilMembership.cohortId, actor.cohortId),
        isNull(councilMembership.endsAt),
        isNull(councilMembership.councilRank),
        notExists(placed),
      ),
    )
  return row?.total ?? 0
}
