import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, eventStaffDepartments, eventStaffMembers, members } from '../db/schema.ts'
import { AlreadyExists, Blocked } from '../errors.ts'
import { stillHere } from '../org/membership.ts'
import { eventOf } from './staff-data.ts'
import { SETUP_MODES } from './staff-tree.ts'
import { assertStaffMembers, staffWordOf, type Ids } from './staff-write-shared.ts'

/** 이 행사에 운영 조직이 있는가 — 부서든 사람이든 줄이 하나라도 있으면 세워진 것이다. */
async function hasStaff(db: Db, orgId: string, eventId: string): Promise<boolean> {
  const groups = await db
    .select({ id: eventStaffDepartments.id })
    .from(eventStaffDepartments)
    .where(and(eq(eventStaffDepartments.orgId, orgId), eq(eventStaffDepartments.eventId, eventId)))
    .limit(1)
  if (groups.length > 0) return true
  const people = await db
    .select({ id: eventStaffMembers.id })
    .from(eventStaffMembers)
    .where(and(eq(eventStaffMembers.orgId, orgId), eq(eventStaffMembers.eventId, eventId)))
    .limit(1)
  return people.length > 0
}

/**
 * 행사 운영 조직을 처음 세운다(EVT-01 · event.staff.setup).
 *
 * **처음 한 번이다.** 계약이 conflict라 적었다 — 이미 세워진 조직에 또 세우면 409이고,
 * 고치는 것은 `saveEventStaff`다.
 *
 * - `copyBase` — 학생회의 부서와 **부서에 든** 사람을 그대로 베낀다(미리보기가 보여 준
 *   그대로). 부서 없는 사람은 베끼지 않는다 — 여기서도 자리가 없는 것이고, 오른쪽
 *   기둥이 그 사실을 기본 조직에서 읽는다(`staffUnassignedMembers`).
 * - `empty` — 책임자만 둔다.
 * - `pickDepartments` — **막는다(422).** 계약의 몸통이 방식과 책임자뿐이라 고른 부서를
 *   실을 자리가 없고, 고르는 칸도 그려지지 않았다(미리보기가 같은 까닭으로 빈 목록을
 *   준다). 부서 전체로 대신 세우면 '고르기 전'과 '전부 골랐다'가 같아진다 — 그 방식은
 *   고르는 칸이 명세에 생기는 날 연다.
 *
 * **책임자는 부서에 들지 않는다.** 표 머리가 '부서가 비어 있으면 책임자거나 미배정'이라
 * 적었고 EVT-03A가 뿌리에 따로 그린다. 기본 조직에서 부서장이던 사람을 책임자로 고르면
 * 그 부서에서는 빠진다 — 한 사람은 한 자리에만 있다(`event_staff_members_once`).
 *
 * **기본 학생회 조직에는 손대지 않는다.** 여기서 쓰는 표는 `event_staff_*` 둘뿐이다.
 */
export async function setupEventStaff(
  db: Db,
  orgId: string,
  eventId: string,
  draft: Record<string, unknown>,
  make: Ids,
): Promise<Record<string, never>> {
  await eventOf(db, orgId, eventId)
  const mode = staffWordOf(draft, 'setupMode')
  if (mode === '') throw new Blocked('조직 구성 방식을 골라 주세요')
  if (!SETUP_MODES.includes(mode)) throw new Blocked('명세에 없는 조직 구성 방식입니다')
  const leaderId = staffWordOf(draft, 'leaderId')
  if (leaderId === '') throw new Blocked('행사 책임자를 골라 주세요')
  await assertStaffMembers(db, orgId, [leaderId])
  if (mode === 'pickDepartments') {
    throw new Blocked('참여 부서를 고르는 자리가 아직 없어 이 방식으로는 세울 수 없습니다')
  }
  if (await hasStaff(db, orgId, eventId)) {
    throw new AlreadyExists('이미 운영 조직이 있는 행사입니다')
  }

  if (mode === 'copyBase') {
    const groups = await db
      .select({ id: departments.id, name: departments.name, sortOrder: departments.sortOrder })
      .from(departments)
      .where(eq(departments.orgId, orgId))
      .orderBy(asc(departments.sortOrder), asc(departments.name))
    const copied = new Map(groups.map((group) => [group.id, make.newId()]))
    if (groups.length > 0) {
      await db.insert(eventStaffDepartments).values(
        groups.map((group) => ({
          id: copied.get(group.id)!,
          orgId,
          eventId,
          name: group.name,
          sortOrder: group.sortOrder,
        })),
      )
    }
    const people = await db
      .select({
        id: members.id,
        departmentId: members.departmentId,
        isLeader: members.isDepartmentLeader,
      })
      .from(members)
      .where(and(eq(members.orgId, orgId), stillHere))
    const seated = people
      .filter(
        (one) =>
          one.departmentId !== null && copied.has(one.departmentId) && one.id !== leaderId,
      )
      .map((one) => ({
        id: make.newId(),
        orgId,
        eventId,
        memberId: one.id,
        staffDepartmentId: copied.get(one.departmentId!)!,
        isDepartmentLeader: one.isLeader,
      }))
    if (seated.length > 0) await db.insert(eventStaffMembers).values(seated)
  }

  await db.insert(eventStaffMembers).values({
    id: make.newId(),
    orgId,
    eventId,
    memberId: leaderId,
    isEventLeader: true,
  })
  return {}
}
