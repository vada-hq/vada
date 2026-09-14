import { and, asc, eq } from 'drizzle-orm'
import optionSourcesJson from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import type { Db } from '../db/client.ts'
import {
  departments,
  events,
  eventStaffDepartments,
  eventStaffMembers,
  members,
} from '../db/schema.ts'
import { departmentTree } from '../org/chart.ts'
import { Blocked, NotFound } from '../errors.ts'
import { stillHere } from '../org/membership.ts'

// 행사 운영 조직(EVT-01 · EVT-03A · EVT-03B)이 읽고 쓰는 것.
//
// **학생회의 기본 조직과 다른 물건이다.** 명세가 그렇게 못 박았고(`event.staffLeaders`가
// 'org.executives와 같은 모양이지만 다른 물건'이라 적었다) 표도 둘이다. 그래서 행사
// 조직이 비어 있을 때 기본 조직 사람을 대신 주지 않는다 — 그러면 화면은 조직이
// 만들어진 줄 안다.
//
// **미리보기만 반대로 기본 조직을 본다.** 아직 만들어지지 않은 것을 미리 보는
// 자리이므로, 고른 방식이 베낄 원본을 그대로 보여 준다.

interface Person {
  id: string
  name: string
  major: string
  grade: string
}

/** 사람 한 줄. **없는 것을 빈 글로 대신하지 않는다**(조직도가 쓰는 규칙과 같다). */
function person(row: {
  id: string
  name: string
  major: string | null
  grade: string | null
}): Person {
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
function staffRows(db: Db, orgId: string, eventId: string) {
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

export interface StaffLeader extends Person {
  roleLabel: string
  roleTone: string
}

/**
 * 행사 책임자(EVT-01 · EVT-03A · EVT-03B).
 *
 * **자리 이름을 명세가 들지 않는다**(계약이 그렇게 적었다). 표가 이 행사에서 부르는
 * 직함을 들고 있으면 그것이고, 없으면 그림이 그린 말이다. 색은 조직도의 회장과
 * 같은 자리이므로 같은 색을 쓴다 — 나무의 뿌리이고, 그림도 그 딱지를 노랗게 그렸다.
 */
export async function eventStaffLeaders(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<StaffLeader[]> {
  await eventOf(db, orgId, eventId)
  const rows = await staffRows(db, orgId, eventId)
  return rows
    .filter((row) => row.isEventLeader)
    .map((row) => ({
      ...person({ id: row.memberId, name: row.name, major: row.major, grade: row.grade }),
      roleLabel: row.roleTitle ?? '책임자',
      roleTone: 'yellow',
    }))
}

export interface StaffDepartment {
  id: string
  name: string
  memberCountLabel: string
  leaders: Person[]
  members: Person[]
}

/**
 * 행사 운영 부서들(EVT-01 · EVT-03A · EVT-03B).
 *
 * **세는 말도 서버가 만든다.** '부원 2명'은 저장하는 값이 아니라 세어서 말로 만든
 * 것이고, 화면이 세면 세는 규칙이 화면에 박힌다.
 */
export async function eventStaffDepartmentTree(
  db: Db,
  orgId: string,
  eventId: string,
): Promise<StaffDepartment[]> {
  await eventOf(db, orgId, eventId)
  const [groups, people] = await Promise.all([
    db
      .select({ id: eventStaffDepartments.id, name: eventStaffDepartments.name })
      .from(eventStaffDepartments)
      .where(
        and(
          eq(eventStaffDepartments.orgId, orgId),
          eq(eventStaffDepartments.eventId, eventId),
        ),
      )
      // 사람이 정한 차례가 있다. 이름순이 아니다.
      .orderBy(asc(eventStaffDepartments.sortOrder), asc(eventStaffDepartments.name)),
    staffRows(db, orgId, eventId),
  ])

  return groups.map((group) => {
    const mine = people.filter((row) => row.staffDepartmentId === group.id)
    const members = mine
      .filter((row) => !row.isDepartmentLeader)
      .map((row) => person({ id: row.memberId, name: row.name, major: row.major, grade: row.grade }))
    return {
      id: group.id,
      name: group.name,
      memberCountLabel: `부원 ${members.length}명`,
      leaders: mine
        .filter((row) => row.isDepartmentLeader)
        .map((row) =>
          person({ id: row.memberId, name: row.name, major: row.major, grade: row.grade }),
        ),
      members,
    }
  })
}

/** 고를 수 있는 방식은 **명세가 갖고 있다**(event.staffSetupModes). 두 벌을 들면 갈린다. */
export const SETUP_MODES: readonly string[] = (
  optionSourcesJson.sources.find((source) => source.key === 'event.staffSetupModes') as
    | { options: Array<{ value: string }> }
    | undefined
)?.options.map((option) => option.value) ?? []

/**
 * 고른 방식으로 만들어질 운영 조직의 미리보기(EVT-01).
 *
 * - `copyBase` — 학생회 기본 조직을 그대로 쓴다. 그래서 **조직도와 같은 답**이다.
 * - `empty` — 처음부터 새로 구성하므로 만들어질 것이 없다.
 * - `pickDepartments` — **아직 고른 것이 없다.** 계약이 이 자리에 넘기는 인자는
 *   방식 하나뿐이고(고른 부서를 실을 자리가 없다) 고르는 칸도 그려지지 않았다.
 *   그러므로 지금 고른 것으로 만들어질 부서는 없다. 부서 전체를 대신 주면 그것은
 *   '고르기 전'과 '전부 골랐다'를 같게 만드는 조용한 대체다.
 *
 * **안 넘긴 것과 틀리게 넘긴 것은 다르다.** 방식은 화면 안의 칸에 살아서 그릇이
 * 미리 받을 때는 아직 없다 — 그때 막으면 화면이 그려지기도 전에 통째로 오류가
 * 된다(업무 보드의 `readScope`가 같은 자리에서 같은 규칙을 쓴다). 아무것도 안
 * 골랐으면 만들어질 것도 없고, 없는 방식을 골랐으면 막는다.
 */
export async function staffSetupPreview(
  db: Db,
  orgId: string,
  eventId: string,
  setupMode: string | undefined,
): Promise<StaffDepartment[]> {
  await eventOf(db, orgId, eventId)
  const mode = (setupMode ?? '').trim()
  if (mode === '') return []
  // **명세에 없는 방식은 막는다.** 조용히 빈 목록을 주면 '빈 조직'과 구별되지 않는다.
  if (!SETUP_MODES.includes(mode)) throw new Blocked('명세에 없는 조직 구성 방식입니다')
  if (mode !== 'copyBase') return []
  // 기본 조직을 그대로 쓴다는 뜻이므로 **조직도가 답하는 것을 그대로** 준다.
  return departmentTree(db, orgId)
}

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
  const rows = await staffRows(db, orgId, eventId)
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
  const rows = await staffRows(db, orgId, eventId)
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
): Promise<Person[]> {
  await eventOf(db, orgId, eventId)
  const placed = new Set(
    (await staffRows(db, orgId, eventId))
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
    .map(person)
}

// ─── EVT-01 · EVT-03B가 쓰는 둘 ──────────────────────────────────────────────
