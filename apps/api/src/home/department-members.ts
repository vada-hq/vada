import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { headDepartmentIds } from '../access/permissions.js'
import { councilMembership, department, departmentMembership, member } from '../db/schema.js'
import type { Db } from '../db/types.js'

// 직급이 있는 부서의 현재 구성원. 부서 이동·기수 교체·학생회 탈퇴를 읽을 때마다 반영한다.
export function departmentMembersOf(db: Pick<Db, 'select'>, actor: Actor) {
  const ids = headDepartmentIds(actor)
  if (!ids.length) return Promise.resolve([])
  return db
    .select({ memberId: member.id, departmentId: department.id })
    .from(departmentMembership)
    .innerJoin(department, eq(department.id, departmentMembership.departmentId))
    .innerJoin(member, eq(member.id, departmentMembership.memberId))
    .innerJoin(
      councilMembership,
      and(
        eq(councilMembership.memberId, member.id),
        eq(councilMembership.cohortId, actor.cohortId),
      ),
    )
    .where(
      and(
        eq(department.councilId, actor.councilId),
        inArray(department.id, ids),
        eq(departmentMembership.cohortId, actor.cohortId),
        isNull(departmentMembership.endsAt),
        isNull(councilMembership.endsAt),
        isNull(member.leftAt),
      ),
    )
}

export type DepartmentMember = Awaited<ReturnType<typeof departmentMembersOf>>[number]
