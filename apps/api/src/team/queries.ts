import { and, asc, eq, isNull } from 'drizzle-orm'
import type { TeamResponse } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { councilMembership, department, departmentMembership, member } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { joinedDisplayNameOf } from './display-name.js'

// 한 번이라도 소속이 있었던 부서(끝난 소속, 지난 기수 포함). 쓴 부서는 '그만 쓰기', 쓰이지 않은 부서는 '없애기'다(DEC-91).
async function usedDepartments(db: Pick<Db, 'selectDistinct'>, councilId: string) {
  const rows = await db
    .selectDistinct({ id: departmentMembership.departmentId })
    .from(departmentMembership)
    .innerJoin(department, eq(department.id, departmentMembership.departmentId))
    .where(eq(department.councilId, councilId))
  return new Set(rows.map(row => row.id))
}

// 운영진과 부서 목록. 지금 기수의 끝나지 않은 소속만 보인다. 들어온 순서대로 놓고, 이메일은 넣지 않는다(바탕 spec G12).
export async function teamOf(
  db: Pick<Db, 'select' | 'selectDistinct'>,
  actor: Actor,
): Promise<TeamResponse> {
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
  // 그만 쓴 부서는 목록과 고르는 칸에서 빠진다(DEC-91). 기록과 지난 기간 보기는 그 기록에서 부서를 직접 읽는다.
  const departments = await db
    .select({ id: department.id, name: department.name, role: department.role })
    .from(department)
    .where(and(eq(department.councilId, actor.councilId), isNull(department.retiredAt)))
    .orderBy(asc(department.id))
  const used = await usedDepartments(db, actor.councilId)
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
      memberCount: placements.filter(item => item.departmentId === row.id).length,
      used: used.has(row.id),
    })),
  }
}
