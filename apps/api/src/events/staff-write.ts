import { and, asc, eq, inArray } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, eventStaffDepartments, eventStaffMembers, members } from '../db/schema.ts'
import { AlreadyExists, Blocked } from '../errors.ts'
import { stillHere } from '../org/membership.ts'
import { eventOf, SETUP_MODES } from './staff.ts'

interface Ids {
  newId: () => string
}

/** 몸통의 글 한 칸. 없거나 글이 아니면 빈 글이다 — 빈 것을 어떻게 볼지는 부르는 쪽이 정한다. */
function wordOf(draft: Record<string, unknown>, key: string): string {
  const value = draft[key]
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * 전부 이 학생회의 구성원인가.
 *
 * 남의 학생회 사람은 이 조직에 들 수 없다 — 표도 막지만(복합 외래 키) 표가 막으면
 * 500이고, 여기서 막으면 무엇이 잘못됐는지 말할 수 있다.
 */
async function assertMembers(db: Db, orgId: string, ids: readonly string[]): Promise<void> {
  const wanted = [...new Set(ids)]
  if (wanted.length === 0) return
  const rows = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.orgId, orgId), stillHere, inArray(members.id, wanted)))
  const known = new Set(rows.map((row) => row.id))
  if (wanted.some((id) => !known.has(id))) {
    throw new Blocked('이 학생회의 구성원이 아닌 사람이 있습니다')
  }
}

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
  const mode = wordOf(draft, 'setupMode')
  if (mode === '') throw new Blocked('조직 구성 방식을 골라 주세요')
  if (!SETUP_MODES.includes(mode)) throw new Blocked('명세에 없는 조직 구성 방식입니다')
  const leaderId = wordOf(draft, 'leaderId')
  if (leaderId === '') throw new Blocked('행사 책임자를 골라 주세요')
  await assertMembers(db, orgId, [leaderId])
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

/**
 * 화면이 초안에 쓰는 자리 이름.
 *
 * 되풀이되는 부서의 칸은 `departments.<부서>.<칸>`으로 온다(`payloadOf`가 적어 둔 규칙 —
 * 계약의 칸 이름은 마지막 조각이다). 부원 목록은 `EVT03BScreen`의 memberKey와 같고
 * 사람은 줄바꿈으로 잇는다. 두 벌이 갈리는 것은 화면에서 완료를 눌러 저장하는 통합
 * 검사가 잡는다(`events.server.test.tsx`).
 */
const DEPARTMENT_LIST = 'departments'
const SEPARATOR = '\n'

/** 부서 하나에 실려 온 것. 셋 다 없을 수 있다 — 없는 것은 안 건드린다. */
interface DepartmentDraft {
  /** 그 부서의 부원 전부. 있으면 **그 목록이 그 부서의 부원이다** — 빠진 사람은 나간다. */
  members?: string[]
  /** 새 부서장. 부서마다 0명 또는 1명이라 앞의 부서장은 부원이 된다. */
  leaderId?: string
  /** '＋ 구성원 추가'로 고른 사람. */
  addMemberId?: string
}

function idsOf(holder: string, value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((one) => String(one).trim()).filter((one) => one !== '')
  }
  if (typeof value !== 'string') throw new Blocked(`'${holder}' 자리의 값이 글이 아닙니다`)
  return value
    .split(SEPARATOR)
    .map((id) => id.trim())
    .filter((id) => id !== '')
}

/**
 * `departments.<부서>.<칸>` 꼴의 열쇠를 부서마다 모은다.
 *
 * 모르는 칸은 건너뛴다 — 화면이 제 자리 이름(leaders·unassigned)도 함께 보내는데 그것은
 * 배치의 원본이 아니라 그린 것의 자취다. 배치는 부서마다의 목록과 책임자 칸이 말한다.
 */
function departmentDrafts(draft: Record<string, unknown>): Map<string, DepartmentDraft> {
  const found = new Map<string, DepartmentDraft>()
  for (const [key, value] of Object.entries(draft)) {
    if (!key.startsWith(`${DEPARTMENT_LIST}.`)) continue
    const dot = key.lastIndexOf('.')
    const departmentId = key.slice(DEPARTMENT_LIST.length + 1, dot)
    const field = key.slice(dot + 1)
    if (departmentId === '') continue
    const entry = found.get(departmentId) ?? {}
    if (field === 'members') {
      entry.members = idsOf(key, value)
    } else if (field === 'departmentLeaderId' || field === 'departmentMemberId') {
      const id = typeof value === 'string' ? value.trim() : ''
      if (id === '') continue
      if (field === 'departmentLeaderId') entry.leaderId = id
      else entry.addMemberId = id
    } else {
      continue
    }
    found.set(departmentId, entry)
  }
  return found
}

interface Place {
  department: string | null
  leader: boolean
  eventLeader: boolean
}

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
  const leaderId = wordOf(draft, 'leaderId')
  if (leaderId === '') throw new Blocked('행사 책임자를 골라 주세요')
  const newDepartmentName = wordOf(draft, 'newDepartmentName')
  const drafts = departmentDrafts(draft)

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
  await assertMembers(db, orgId, [leaderId, ...wanted.keys()])

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
  const next = new Map<string, Place>()
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
