import { and, asc, eq, isNull } from 'drizzle-orm'
import type { CouncilRank, DepartmentRank, DepartmentRole } from '@vada/contracts'
import {
  cohort,
  councilMembership,
  department,
  departmentMembership,
  memberLogin,
} from '../db/schema.js'
import type { Db } from '../db/types.js'
import { currentCouncilMembership } from './current-cohort.js'

type ActorDepartment = {
  departmentId: string
  role: DepartmentRole | null
  rank: DepartmentRank | null
}
// 요청한 사람의 지금 소속. 권한(can)은 이것만 보고 정한다.
export type Actor = {
  memberId: string
  councilId: string
  cohortId: string
  membershipId: string
  councilRank: CouncilRank | null
  departments: ActorDepartment[]
}

// 요청마다 DB를 읽는다. 그래서 내보내면 세션이 남아 있어도 다음 요청부터 막힌다(바탕 spec '권한').
// 지금 소속은 currentCouncilMembership(current-cohort.ts) 조건에 맞는 학생회 소속이다. 없으면 null이다.
export async function actorOf(
  db: Pick<Db, 'select'>,
  userId: string,
  councilId: string,
  now: Date,
): Promise<Actor | null> {
  const [membership] = await db
    .select({
      memberId: memberLogin.memberId,
      membershipId: councilMembership.id,
      cohortId: councilMembership.cohortId,
      councilRank: councilMembership.councilRank,
    })
    .from(memberLogin)
    .innerJoin(councilMembership, eq(councilMembership.memberId, memberLogin.memberId))
    .innerJoin(cohort, eq(cohort.id, councilMembership.cohortId))
    .where(
      and(
        eq(memberLogin.userId, userId),
        eq(cohort.councilId, councilId),
        currentCouncilMembership(now),
      ),
    )
  if (!membership) return null
  return { ...membership, councilId, departments: await departmentsOf(db, membership) }
}

async function departmentsOf(
  db: Pick<Db, 'select'>,
  membership: { memberId: string; cohortId: string },
): Promise<ActorDepartment[]> {
  return db
    .select({
      departmentId: department.id,
      role: department.role,
      rank: departmentMembership.departmentRank,
    })
    .from(departmentMembership)
    .innerJoin(department, eq(department.id, departmentMembership.departmentId))
    .where(
      and(
        eq(departmentMembership.memberId, membership.memberId),
        eq(departmentMembership.cohortId, membership.cohortId),
        isNull(departmentMembership.endsAt),
      ),
    )
    .orderBy(asc(department.id))
}

// 로그인 없는 운영진(시연 데이터의 가상 운영진)을 운영진 번호로 연다. 요청 경로는 쓰지 않는다: 로그인한 사람은 actorOf만 쓴다.
export async function actorOfMember(
  db: Pick<Db, 'select'>,
  memberId: string,
  councilId: string,
  now: Date,
): Promise<Actor | null> {
  const [membership] = await db
    .select({
      memberId: councilMembership.memberId,
      membershipId: councilMembership.id,
      cohortId: councilMembership.cohortId,
      councilRank: councilMembership.councilRank,
    })
    .from(councilMembership)
    .innerJoin(cohort, eq(cohort.id, councilMembership.cohortId))
    .where(
      and(
        eq(councilMembership.memberId, memberId),
        eq(cohort.councilId, councilId),
        currentCouncilMembership(now),
      ),
    )
  if (!membership) return null
  return { ...membership, councilId, departments: await departmentsOf(db, membership) }
}
