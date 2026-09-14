import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, eventStaffDepartments, members } from '../db/schema.ts'
import { NotFound } from '../errors.ts'
import { stillHere } from '../org/membership.ts'
import {
  eventOf,
  eventStaffRows,
  staffPerson,
  type StaffPerson,
} from './staff-data.ts'

export interface LeaderCandidate {
  value: string
  label: string
  description: string
  /** 고를 수 없는가 — 이미 그 자리인 사람. 계약이 이 자리를 두었다(선택). */
  disabled?: boolean
}

/**
 * 이 학생회의 구성원을 고를 수 있는 값으로. **세 후보 목록이 같은 규칙을 쓴다.**
 *
 * 디자인이 펼친 목록을 그리지 않았으므로(계약이 그렇게 적었다) 누구까지인지는 서버가
 * 정하는데, 좁힐 근거가 명세에 없어 **이 학생회의 구성원 전부**다 — 좁히는 규칙을
 * 지어내면 고를 수 있어야 할 사람이 조용히 사라진다. 곁의 글은 기본 조직의 부서다.
 * 같은 이름이 둘일 때 그것만이 둘을 가른다.
 */
async function memberChoices(db: Db, orgId: string): Promise<LeaderCandidate[]> {
  const rows = await db
    .select({ id: members.id, name: members.name, department: departments.name })
    .from(members)
    // 이어 붙인 표도 자기 학생회를 확인한다.
    .leftJoin(
      departments,
      and(eq(members.departmentId, departments.id), eq(departments.orgId, orgId)),
    )
    .where(and(eq(members.orgId, orgId), stillHere))

  return rows
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((row) => ({
      value: row.id,
      label: row.name,
      description: row.department ?? '부서 미배정',
    }))
}

/** 행사 책임자가 될 수 있는 사람(EVT-01의 고르는 칸). 규칙은 `memberChoices`에 있다. */
export async function staffLeaderCandidates(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<LeaderCandidate[]> {
  await eventOf(db, orgId, eventId)
  return memberChoices(db, orgId)
}

// ─── EVT-03B가 읽는 셋 ────────────────────────────────────────────────────────

/** 이 행사의 그 운영 부서인가. **남의 행사의 부서도, 없는 부서도 여기서는 없는 것이다.** */
async function staffDepartmentOf(
  db: Db,
  orgId: string,
  eventId: string,
  departmentId: string,
): Promise<void> {
  const rows = await db
    .select({ id: eventStaffDepartments.id })
    .from(eventStaffDepartments)
    .where(
      and(
        eq(eventStaffDepartments.orgId, orgId),
        eq(eventStaffDepartments.eventId, eventId),
        eq(eventStaffDepartments.id, departmentId),
      ),
    )
    .limit(1)
  if (rows.length === 0) throw new NotFound('그 부서를 찾지 못했습니다')
}

/**
 * 후보 목록에 '이미 그 자리인 사람'을 표시한다.
 *
 * **빼지 않고 표시한다.** 계약이 그 자리를 두었고(`disabled`), 빼면 같은 목록이 부서마다
 * 달라져 사람은 누가 왜 없는지 모른다.
 */
function markTaken(choices: LeaderCandidate[], taken: Set<string>): LeaderCandidate[] {
  return choices.map((choice) =>
    taken.has(choice.value) ? { ...choice, disabled: true } : choice,
  )
}

/**
 * 그 부서의 부서장이 될 수 있는 사람(EVT-03B의 부서 카드).
 *
 * **디자인이 목록을 그리지 않았다**(명세). 좁힐 근거가 없으므로 책임자 후보와 같은
 * 목록이고, 지금 그 부서의 부서장인 사람만 고를 수 없다고 표시한다 — 이미 그 자리다.
 */
export async function staffDeptLeaderCandidates(
  db: Db,
  orgId: string,
  eventId: string,
  departmentId: string,
): Promise<LeaderCandidate[]> {
  await eventOf(db, orgId, eventId)
  await staffDepartmentOf(db, orgId, eventId, departmentId)
  const rows = await eventStaffRows(db, orgId, eventId)
  const taken = new Set(
    rows
      .filter((row) => row.staffDepartmentId === departmentId && row.isDepartmentLeader)
      .map((row) => row.memberId),
  )
  return markTaken(await memberChoices(db, orgId), taken)
}

/**
 * 그 부서에 넣을 수 있는 사람(EVT-03B의 '＋ 구성원 추가').
 *
 * 이미 그 부서에 있는 사람 — 부서장이든 부원이든 — 은 넣을 수 없다고 표시한다. 다른
 * 부서에 있는 사람은 고를 수 있다: 고르면 그리로 옮겨 간다(한 사람은 한 자리에만 있다).
 */
export async function staffMemberCandidates(
  db: Db,
  orgId: string,
  eventId: string,
  departmentId: string,
): Promise<LeaderCandidate[]> {
  await eventOf(db, orgId, eventId)
  await staffDepartmentOf(db, orgId, eventId, departmentId)
  const rows = await eventStaffRows(db, orgId, eventId)
  const taken = new Set(
    rows.filter((row) => row.staffDepartmentId === departmentId).map((row) => row.memberId),
  )
  return markTaken(await memberChoices(db, orgId), taken)
}

/**
 * 아직 어느 부서에도 배정되지 않은 사람(EVT-03B의 오른쪽 기둥).
 *
 * **이 학생회의 구성원 중 이 행사 조직에 자리가 없는 사람이다.** 기둥의 제목이
 * '기본 조직 구성원'이고 명세가 `org.unassignedMembers와 같은 자리`라 적었다 —
 * 부서 카드의 '＋ 구성원 추가'가 여기서 사람을 데려간다. 표에 줄이 없는 사람도,
 * 줄은 있는데 부서도 책임자 자리도 없는 사람(표 머리가 '미배정'이라 적은 줄)도
 * 같은 사실이므로 함께 온다. 조직에 든 사람만 세면 '빈 조직'으로 시작한 행사는
 * 아무도 데려올 수 없다.
 */
export async function staffUnassignedMembers(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<StaffPerson[]> {
  await eventOf(db, orgId, eventId)
  const placed = new Set(
    (await eventStaffRows(db, orgId, eventId))
      .filter((row) => row.isEventLeader || row.staffDepartmentId !== null)
      .map((row) => row.memberId),
  )
  const rows = await db
    .select({ id: members.id, name: members.name, major: members.major, grade: members.grade })
    .from(members)
    .where(and(eq(members.orgId, orgId), stillHere))
  return rows
    .filter((row) => !placed.has(row.id))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(staffPerson)
}
