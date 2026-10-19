import { and, asc, eq, gte, isNull, lte } from 'drizzle-orm'
import { koreanOf, type CouncilRank, type DepartmentRank, type DepartmentRole } from '@vada/contracts'
import { cohort, councilMembership, department, departmentMembership, memberLogin } from '../db/schema.js'
import type { Db } from '../records/records.js'

export type ActorDepartment = { departmentId: string; role: DepartmentRole | null; rank: DepartmentRank | null }
// 요청한 사람의 지금 소속. 권한(can)은 이것만 보고 정한다.
export type Actor = {
  memberId: string
  councilId: string
  cohortId: string
  membershipId: string
  councilRank: CouncilRank | null
  departments: ActorDepartment[]
}

// 한국 날짜(YYYY-MM-DD). 서버 시간대(Render는 UTC)와 상관없이 같은 날을 쓴다.
export const koreanDate = (now: Date) => koreanOf(now).slice(0, 10)

// 학생회 소속(councilMembership)과 그 기수(cohort)를 합친 조회에서 "지금 소속"을 뜻하는 조건 하나. 끝 시각이 비어 있고, 오늘(한국 날짜)이 기수 기간 안이다.
// 내 학생회 목록(councils/queries.ts)과 접근 검사(actorOf)가 이것을 같이 써서, 목록에 보이는데 열리지 않거나 그 반대인 일이 없다.
export function currentCouncilMembership(now: Date) {
  const today = koreanDate(now)
  return and(isNull(councilMembership.endsAt), lte(cohort.startsOn, today), gte(cohort.endsOn, today))
}

// 요청마다 DB를 읽는다. 그래서 내보내면 세션이 남아 있어도 다음 요청부터 막힌다(바탕 spec '권한').
// 지금 소속은 currentCouncilMembership 조건에 맞는 학생회 소속이다. 없으면 null이다.
export async function actorOf(db: Pick<Db, 'select'>, userId: string, councilId: string, now: Date): Promise<Actor | null> {
  const [membership] = await db.select({ memberId: memberLogin.memberId, membershipId: councilMembership.id, cohortId: councilMembership.cohortId,
    councilRank: councilMembership.councilRank })
    .from(memberLogin)
    .innerJoin(councilMembership, eq(councilMembership.memberId, memberLogin.memberId))
    .innerJoin(cohort, eq(cohort.id, councilMembership.cohortId))
    .where(and(eq(memberLogin.userId, userId), eq(cohort.councilId, councilId), currentCouncilMembership(now)))
  if (!membership) return null
  const departments = await db.select({ departmentId: department.id, role: department.role, rank: departmentMembership.departmentRank })
    .from(departmentMembership)
    .innerJoin(department, eq(department.id, departmentMembership.departmentId))
    .where(and(eq(departmentMembership.memberId, membership.memberId), eq(departmentMembership.cohortId, membership.cohortId),
      isNull(departmentMembership.endsAt)))
    .orderBy(asc(department.id))
  return { ...membership, councilId, departments }
}
