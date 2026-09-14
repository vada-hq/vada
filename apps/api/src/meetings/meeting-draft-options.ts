import { and, asc, eq, ilike, or } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, events, members } from '../db/schema.ts'
import { stillHere } from '../org/membership.ts'
import { orNote, type MeetingQuery } from './meetings.ts'

export interface MemberCandidate {
  memberId: string
  name: string
  departmentNote: string
}

/**
 * 참가자로 넣을 수 있는 사람들(OPS-MEET-02·04B의 검색).
 *
 * **이름으로도 부서로도 찾는다** — 화면의 칸 이름이 '이름 또는 부서로 구성원 검색'이다.
 *
 * **`alreadyAdded`는 오지 않는다.** '이미 넣었는가'는 어느 회의의 초안인지를 알아야
 * 답할 수 있는데 이 자리가 받는 인자는 검색어뿐이다. 지어낸 답을 주는 대신 보내지
 * 않는다 — 카탈로그도 이 조각을 optional로 적었고, 고른 사람은 화면의 초안이 든다.
 */
export async function memberCandidates(
  db: Db,
  orgId: string,
  asked: MeetingQuery,
): Promise<MemberCandidate[]> {
  const wanted = (asked.query ?? '').trim()
  const rows = await db
    .select({
      memberId: members.id,
      name: members.name,
      department: departments.name,
    })
    .from(members)
    .leftJoin(
      departments,
      and(eq(members.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .where(
      and(
        eq(members.orgId, orgId),
        stillHere,
        wanted === ''
          ? undefined
          : or(ilike(members.name, `%${wanted}%`), ilike(departments.name, `%${wanted}%`)),
      ),
    )
    .orderBy(asc(members.name))

  return rows.map((row) => ({
    memberId: row.memberId,
    name: row.name,
    departmentNote: orNote(row.department, '부서 미배정'),
  }))
}

/**
 * 회의를 걸 수 있는 행사.
 *
 * **거르지 않는다.** 어느 행사에 회의를 걸 수 있는지를 명세가 말하지 않았다 —
 * 끝난 행사를 빼는 규칙은 행사 목록의 것이고, 그것을 여기 옮기면 지어낸 규칙이 된다.
 */
export async function linkableEventOptions(
  db: Db,
  orgId: string,
): Promise<Array<{ value: string; label: string }>> {
  const rows = await db
    .select({ id: events.id, title: events.title, startAt: events.startAt })
    .from(events)
    .where(eq(events.orgId, orgId))
  return rows
    // 이른 행사가 먼저, 일시가 없으면 뒤로. 회의 목록이 줄 세우는 규칙과 같다.
    .map((row) => ({ ...row, scheduledAt: row.startAt, status: '' }))
    .sort(byEventTime)
    .map((row) => ({ value: row.id, label: row.title }))
}

function byEventTime(
  left: { scheduledAt: Date | null; title: string },
  right: { scheduledAt: Date | null; title: string },
): number {
  const key = (row: { scheduledAt: Date | null; title: string }) =>
    `${row.scheduledAt === null ? '9' : '0'}${row.scheduledAt?.toISOString() ?? ''}${row.title}`
  return key(left).localeCompare(key(right))
}
