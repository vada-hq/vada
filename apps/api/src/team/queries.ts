import { and, asc, eq, isNull } from 'drizzle-orm'
import { defaultDepartmentColor, type TeamResponse } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { councilMembership, department, departmentMembership, member } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { joinedDisplayNameOf } from './display-name.js'

// 운영진과 부서 목록. 지금 기수의 끝나지 않은 소속만 보인다. 들어온 순서대로 놓고, 이메일은 넣지 않는다(바탕 spec G12).
export async function teamOf(db: Pick<Db, 'select'>, actor: Actor): Promise<TeamResponse> {
  const members = await db
    .select({
      id: member.id,
      name: joinedDisplayNameOf(member, actor.councilId),
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
    .select({
      id: department.id,
      name: department.name,
      role: department.role,
      color: department.color,
    })
    .from(department)
    .where(eq(department.councilId, actor.councilId))
    .orderBy(asc(department.id))
  return {
    members: members.map(row => ({
      id: row.id,
      name: row.name,
      councilRank: row.councilRank,
      joinedAt: row.joinedAt.toISOString(),
      departments: placements
        .filter(item => item.memberId === row.id)
        .map(item => ({ id: item.departmentId, rank: item.rank })),
    })),
    departments: departments.map(row => ({
      ...row,
      color: row.color ?? defaultDepartmentColor(row.id),
      memberCount: placements.filter(item => item.departmentId === row.id).length,
    })),
  }
}
