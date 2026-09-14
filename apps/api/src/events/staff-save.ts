import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { eventStaffDepartments, eventStaffMembers } from '../db/schema.ts'
import { Blocked } from '../errors.ts'
import { eventOf } from './staff.ts'
import { assertStaffMembers, staffWordOf, type Ids } from './staff-write-shared.ts'
import { eventStaffDepartmentDrafts, type StaffPlace } from './staff-write-draft.ts'

/**
 * 행사 운영 조직을 고친다(EVT-03B · event.staff.save).
 *
 * **덮어쓴다.** 계약이 overwrite라 적었다 — 화면이 조직 전부를 보내고, 같은 것을 다시
 * 보내면 같은 조직이 된다. 그래서 받는 것은 '누가 어디로 갔나'가 아니라 **지금 조직이
 * 어떤 모양인가**다.
 *
 * ## 무엇이 실려 오나
 *
 * 계약의 네 칸(`leaderId` · `newDepartmentName` · `departmentLeaderId` · `departmentMemberId`)과
 * 부서마다의 부원 목록이다. 부원 목록(`departments.<부서>.members`)은 계약의 칸이 아니라
 * 명세의 옮김(`itemMove` — '부서에서 빼기')의 결과다: 화면이 사람을 빼고 넣은 뒤 그
 * 부서의 부원 전부를 보낸다. 그것을 안 읽으면 '부서에서 빼기'가 저장되지 않고 조용히
 * 사라진다.
 *
 * ## 규칙 — 전부 표에서 온다
 *
 * - **한 사람은 한 자리에만 있다**(`event_staff_members_once`). 두 부서의 목록에 같은
 *   사람이 오면 막는다. 책임자로 고른 사람이 어느 부서의 목록에도 있으면 책임자가
 *   이긴다 — 책임자는 따로 고르는 칸이고 화면이 그 사람을 목록에서 빼 주지 않는다.
 * - **부서장은 부서마다 0명 또는 1명**(`staffDepartments`가 그렇게 말했다). 새 부서장이
 *   오면 앞의 부서장은 그 부서의 부원이 된다. 부서장 칸이 비어 오면 안 바꾼다 — 화면이
 *   지금 부서장을 그 칸에 되비추지 않으므로 빈 칸은 '없앤다'가 아니다.
 * - **자리를 잃으면 줄도 없다.** 미배정은 줄이 아니라 '자리 없음'이고 오른쪽 기둥이
 *   그것을 기본 조직에서 읽는다.
 * - `newDepartmentName`은 부서를 더한다. 같은 이름의 부서가 이미 있으면 다시 만들지
 *   않는다 — 같은 것을 다시 보내면 같은 조직이어야 하므로.
 *
 * **기본 학생회 조직에는 영향을 주지 않는다.** 여기서 손대는 표는 `event_staff_*` 둘뿐이다.
 */
export async function saveEventStaff(
  db: Db,
  orgId: string,
  eventId: string,
  draft: Record<string, unknown>,
  make: Ids,
): Promise<Record<string, never>> {
  await eventOf(db, orgId, eventId)
  const leaderId = staffWordOf(draft, 'leaderId')
  if (leaderId === '') throw new Blocked('행사 책임자를 골라 주세요')
  const newDepartmentName = staffWordOf(draft, 'newDepartmentName')
  const drafts = eventStaffDepartmentDrafts(draft)

  const groups = await db
    .select({
      id: eventStaffDepartments.id,
      name: eventStaffDepartments.name,
      sortOrder: eventStaffDepartments.sortOrder,
    })
    .from(eventStaffDepartments)
    .where(and(eq(eventStaffDepartments.orgId, orgId), eq(eventStaffDepartments.eventId, eventId)))
  const groupIds = new Set(groups.map((group) => group.id))
  for (const departmentId of drafts.keys()) {
    if (!groupIds.has(departmentId)) throw new Blocked('이 행사에 없는 부서가 있습니다')
  }

  // 실려 온 자리들 — 사람마다 하나. 같은 사람이 두 부서에 오면 여기서 드러난다.
  const wanted = new Map<string, { department: string; leader: boolean }>()
  const seat = (memberId: string, department: string, leader: boolean) => {
    const before = wanted.get(memberId)
    if (before !== undefined && before.department !== department) {
      throw new Blocked('한 사람이 두 부서에 있습니다')
    }
    wanted.set(memberId, { department, leader: leader || (before?.leader ?? false) })
  }
  for (const [departmentId, entry] of drafts) {
    for (const memberId of entry.members ?? []) seat(memberId, departmentId, false)
    if (entry.addMemberId !== undefined) seat(entry.addMemberId, departmentId, false)
    if (entry.leaderId !== undefined) seat(entry.leaderId, departmentId, true)
  }
  await assertStaffMembers(db, orgId, [leaderId, ...wanted.keys()])

  const current = await db
    .select({
      id: eventStaffMembers.id,
      memberId: eventStaffMembers.memberId,
      staffDepartmentId: eventStaffMembers.staffDepartmentId,
      isDepartmentLeader: eventStaffMembers.isDepartmentLeader,
      isEventLeader: eventStaffMembers.isEventLeader,
    })
    .from(eventStaffMembers)
    .where(and(eq(eventStaffMembers.orgId, orgId), eq(eventStaffMembers.eventId, eventId)))

  // 지금의 배치에서 시작한다.
  const next = new Map<string, StaffPlace>()
  for (const row of current) {
    next.set(row.memberId, {
      department: row.staffDepartmentId,
      leader: row.isDepartmentLeader,
      eventLeader: row.isEventLeader,
    })
  }
  // 실려 온 부원 목록은 그 부서의 부원을 통째로 대신한다 — 목록에 없는 부원은 나간다.
  // 부서장은 목록에 그려지지 않으므로 목록이 건드리지 않는다.
  for (const [departmentId, entry] of drafts) {
    if (entry.members === undefined) continue
    for (const [memberId, place] of next) {
      if (place.department === departmentId && !place.leader && !entry.members.includes(memberId)) {
        next.delete(memberId)
      }
    }
  }
  for (const [memberId, want] of wanted) {
    const place = next.get(memberId)
    if (want.leader) {
      // 앞의 부서장은 그 부서의 부원이 된다.
      for (const [other, otherPlace] of next) {
        if (other !== memberId && otherPlace.department === want.department && otherPlace.leader) {
          otherPlace.leader = false
        }
      }
      next.set(memberId, { department: want.department, leader: true, eventLeader: false })
    } else if (place?.department !== want.department) {
      next.set(memberId, { department: want.department, leader: false, eventLeader: false })
    }
    // 이미 그 부서에 있으면 그대로다 — 부서장이면 부서장으로 남는다.
  }
  // 책임자. **책임자가 이긴다** — 앞의 책임자는 다른 자리를 받지 않았으면 자리를 잃는다.
  for (const [memberId, place] of next) {
    if (place.eventLeader && memberId !== leaderId) next.delete(memberId)
  }
  next.set(leaderId, { department: null, leader: false, eventLeader: true })

  if (newDepartmentName !== '' && !groups.some((group) => group.name === newDepartmentName)) {
    const last = groups.reduce((most, group) => Math.max(most, group.sortOrder), -1)
    await db.insert(eventStaffDepartments).values({
      id: make.newId(),
      orgId,
      eventId,
      name: newDepartmentName,
      sortOrder: last + 1,
    })
  }
  const before = new Map(current.map((row) => [row.memberId, row]))
  for (const [memberId, place] of next) {
    const row = before.get(memberId)
    const values = {
      staffDepartmentId: place.department,
      isDepartmentLeader: place.leader,
      isEventLeader: place.eventLeader,
    }
    if (row === undefined) {
      await db.insert(eventStaffMembers).values({ id: make.newId(), orgId, eventId, memberId, ...values })
    } else if (
      row.staffDepartmentId !== place.department ||
      row.isDepartmentLeader !== place.leader ||
      row.isEventLeader !== place.eventLeader
    ) {
      await db
        .update(eventStaffMembers)
        .set(values)
        // 고칠 때도 학생회를 다시 건다. 위에서 찾았다고 빼면 울타리가 한 겹이 된다.
        .where(and(eq(eventStaffMembers.orgId, orgId), eq(eventStaffMembers.id, row.id)))
    }
  }
  for (const row of current) {
    if (next.has(row.memberId)) continue
    await db
      .delete(eventStaffMembers)
      .where(and(eq(eventStaffMembers.orgId, orgId), eq(eventStaffMembers.id, row.id)))
  }
  // 계약이 '돌려주는 값이 없다'고 적었다.
  return {}
}
