import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { events, eventStaffMembers, members } from '../db/schema.ts'
import { NotFound } from '../errors.ts'

export interface StaffPerson {
  id: string
  name: string
  major: string
  grade: string
}

/** 사람 한 줄. **없는 것을 빈 글로 대신하지 않는다**(조직도가 쓰는 규칙과 같다). */
export function staffPerson(row: {
  id: string
  name: string
  major: string | null
  grade: string | null
}): StaffPerson {
  return {
    id: row.id,
    name: row.name,
    major: row.major ?? '학부 미등록',
    grade: row.grade ?? '학년 미등록',
  }
}

/** 이 학생회의 그 행사인가. **남의 학생회 행사는 여기서도 없는 것이다.** */
export async function eventOf(db: Db, orgId: string, eventId: string): Promise<void> {
  const rows = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.orgId, orgId), eq(events.id, eventId)))
    .limit(1)
  if (rows.length === 0) throw new NotFound('그 행사를 찾지 못했습니다')
}

/**
 * 행사 조직에 든 사람들. **이름·학과·학년은 구성원 표가 든다.**
 *
 * 이어 붙인 표도 자기 학생회를 확인한다 — 표가 그것을 막지만(복합 외래 키) 여기도
 * 함께 건다. 벽은 두 겹이 낫다.
 */
export function eventStaffRows(db: Db, orgId: string, eventId: string) {
  return db
    .select({
      id: eventStaffMembers.id,
      memberId: eventStaffMembers.memberId,
      staffDepartmentId: eventStaffMembers.staffDepartmentId,
      isEventLeader: eventStaffMembers.isEventLeader,
      isDepartmentLeader: eventStaffMembers.isDepartmentLeader,
      roleTitle: eventStaffMembers.roleTitle,
      name: members.name,
      major: members.major,
      grade: members.grade,
    })
    .from(eventStaffMembers)
    .innerJoin(
      members,
      and(eq(eventStaffMembers.memberId, members.id), eq(members.orgId, orgId)),
    )
    .where(and(eq(eventStaffMembers.orgId, orgId), eq(eventStaffMembers.eventId, eventId)))
    .orderBy(asc(members.name))
}
