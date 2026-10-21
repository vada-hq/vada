import { and, eq, isNull } from 'drizzle-orm'
import type { Actor } from '../access/actor.js'
import { currentMembersAmong } from '../chat/current-members.js'
import { department, departmentMembership, record } from '../db/schema.js'
import type { Db } from '../db/types.js'

// 이 학생회 재정부의 지금 부서원(운영진 번호). 재정 역할은 부서에 달려 있고, 부서 소속과 학생회 소속이 둘 다 끝나지 않은 사람이다.
// 새 요청 알림의 받는 사람이다. 재정부가 비어 있으면 빈 목록이다.
export async function currentFinanceMembers(
  db: Pick<Db, 'select'>,
  actor: Actor,
  now: Date,
): Promise<string[]> {
  const rows = await db
    .select({ memberId: departmentMembership.memberId })
    .from(departmentMembership)
    .innerJoin(department, eq(department.id, departmentMembership.departmentId))
    .innerJoin(record, eq(record.id, department.id))
    .where(
      and(
        eq(record.councilId, actor.councilId),
        eq(department.role, 'finance'),
        eq(departmentMembership.cohortId, actor.cohortId),
        isNull(departmentMembership.endsAt),
      ),
    )
  const alive = await currentMembersAmong(
    db,
    actor.councilId,
    rows.map(row => row.memberId),
    now,
  )
  return [...new Set(rows.map(row => row.memberId))].filter(id => alive.has(id))
}
