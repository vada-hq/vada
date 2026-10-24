import { and, asc, eq, isNull, ne } from 'drizzle-orm'
import type { TeamResponse } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { councilMembership, department, departmentMembership, member } from '../db/schema.js'
import type { Db } from '../db/types.js'

function memberResponse(
  row: {
    id: string
    name: string
    schoolName: string | null
    collegeName: string | null
    majorName: string | null
    grade: number | null
    councilRank: 'president' | 'vice_president' | null
    joinedAt: Date
  },
  placements: { memberId: string; departmentId: string; rank: 'head' | 'vice_head' | null }[],
) {
  return {
    id: row.id,
    name: row.name,
    profile: {
      schoolName: row.schoolName,
      collegeName: row.collegeName,
      majorName: row.majorName,
      grade: row.grade,
    },
    councilRank: row.councilRank,
    joinedAt: row.joinedAt.toISOString(),
    departments: placements
      .filter(item => item.memberId === row.id)
      .map(item => ({ id: item.departmentId, rank: item.rank })),
  }
}

// 운영진과 부서 목록. 지금 기수의 끝나지 않은 소속만 보인다. 들어온 순서대로 놓고, 이메일은 넣지 않는다(바탕 spec G12).
export async function teamOf(db: Pick<Db, 'select'>, actor: Actor): Promise<TeamResponse> {
  const members = await db
    .select({
      id: member.id,
      name: member.name,
      schoolName: member.schoolName,
      collegeName: member.collegeName,
      majorName: member.majorName,
      grade: member.grade,
      councilRank: councilMembership.councilRank,
      joinedAt: councilMembership.startsAt,
    })
    .from(councilMembership)
    .innerJoin(member, eq(member.id, councilMembership.memberId))
    .where(and(eq(councilMembership.cohortId, actor.cohortId), isNull(councilMembership.endsAt)))
    .orderBy(asc(councilMembership.startsAt), asc(member.id))
  const placements = await db
    .select({
      memberId: departmentMembership.memberId,
      departmentId: departmentMembership.departmentId,
      rank: departmentMembership.departmentRank,
    })
    .from(departmentMembership)
    .where(
      and(eq(departmentMembership.cohortId, actor.cohortId), isNull(departmentMembership.endsAt)),
    )
    .orderBy(asc(departmentMembership.departmentId))
  const departments = await db
    .select({ id: department.id, name: department.name, role: department.role })
    .from(department)
    .where(
      and(eq(department.councilId, actor.councilId), ne(department.name, '회장단')),
    )
    .orderBy(asc(department.id))
  return {
    members: members.map(row => memberResponse(row, placements)),
    departments: departments.map(row => ({
      ...row,
      memberCount: placements.filter(item => item.departmentId === row.id).length,
    })),
  }
}
