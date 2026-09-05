import { and, eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import { departments, members } from '../db/schema.ts'
import { Blocked } from '../routes.ts'
import { recordRoleChange } from './role-change.ts'

// 조직도를 저장한다(ORG-03B · org.saveChart).
//
// **덮어쓴다.** 화면이 배치 전부를 보내고 계약이 그렇게 적었다(`repeat: overwrite`).
// 그래서 받는 것은 '누가 어디로 갔나'가 아니라 **지금 조직도가 어떤 모양인가**이고,
// 저장이 끝나면 저장소가 그 모양이 된다.
//
// **읽는 모양이 곧 쓰는 모양이다.** `chart.ts`가 회장단을 `role = chair`로, 부서장을
// `isDepartmentLeader`로, 미배정을 `departmentId is null`로 읽는다. 저장이 그 열들을
// 그 뜻대로 두어야 저장하고 다시 읽었을 때 같은 배치가 보인다. 그러므로 **자리가
// 곧 역할이다** — 회장단에 놓인 사람은 chair, 부서장 자리는 head, 나머지는 member.
// ORG-04(역할 및 권한)가 같은 `role`을 읽으므로 두 화면이 같은 말을 한다.

type Role = 'chair' | 'head' | 'member'

/**
 * 화면이 초안에 쓰는 자리 이름. `ORG03BScreen`의 HQ·POOL·leaderKey·memberKey와 같다.
 *
 * 계약은 '초안(orgEditDraft)을 그대로 보낸다'고만 말하고 자리 이름은 화면이 정했다.
 * 두 벌이 갈리는 것은 화면에서 완료를 눌러 저장하는 통합 검사가 잡는다
 * (`end-to-end.server.test.tsx`).
 */
const EXECUTIVES = 'executives'
const UNASSIGNED = 'unassigned'
/** 미배정 패널의 검색어. 초안에 함께 실려 오지만 배치가 아니다. */
const SEARCH = 'memberQuery'
const SEPARATOR = '\n'

/** 한 사람이 초안에서 놓인 자리들. 회장단은 부서와 겹칠 수 있다(회장이 부서에도 있다). */
interface Seat {
  chair: boolean
  pooled: boolean
  department: { id: string; leader: boolean } | null
}

export interface ChartSave {
  /** 화면이 보낸 초안 그대로 — 자리 이름마다 줄바꿈으로 이은 구성원 id. */
  chart: unknown
  /** 저장하는 회장. 자기 자신을 회장단에서 빼지 못한다. */
  actorMemberId: string
  actorUserId: string | null
  now: () => Date
}

function idsOf(holder: string, value: unknown): string[] {
  if (value === null || value === undefined) return []
  if (typeof value !== 'string') {
    throw new Blocked(`'${holder}' 자리의 값이 글이 아닙니다`)
  }
  return value
    .split(SEPARATOR)
    .map((id) => id.trim())
    .filter((id) => id !== '')
}

export async function saveChart(db: Db, orgId: string, save: ChartSave): Promise<void> {
  const chart = save.chart
  if (chart === null || typeof chart !== 'object' || Array.isArray(chart)) {
    throw new Blocked('조직도의 모양이 아닙니다')
  }

  const ours = await db
    .select({ id: departments.id })
    .from(departments)
    .where(eq(departments.orgId, orgId))
  const departmentIds = new Set(ours.map((row) => row.id))

  const rows = await db
    .select({
      id: members.id,
      name: members.name,
      role: members.role,
      departmentId: members.departmentId,
      isDepartmentLeader: members.isDepartmentLeader,
      executiveTitle: members.executiveTitle,
    })
    .from(members)
    .where(eq(members.orgId, orgId))
  const current = new Map(rows.map((row) => [row.id, row]))
  const nameOf = (id: string) => current.get(id)?.name ?? id

  // 초안을 사람 기준으로 뒤집는다 — 자리마다 사람 목록이 왔지만 저장은 사람마다 한 줄이다.
  const seats = new Map<string, Seat>()
  const seatOf = (id: string): Seat => {
    const seat = seats.get(id) ?? { chair: false, pooled: false, department: null }
    seats.set(id, seat)
    return seat
  }
  for (const [holder, value] of Object.entries(chart)) {
    if (holder === SEARCH) continue
    const ids = idsOf(holder, value)
    if (holder === EXECUTIVES) {
      for (const id of ids) seatOf(id).chair = true
      continue
    }
    if (holder === UNASSIGNED) {
      for (const id of ids) seatOf(id).pooled = true
      continue
    }
    const dot = holder.lastIndexOf('.')
    const part = holder.slice(dot + 1)
    if (dot === -1 || (part !== 'leaders' && part !== 'members')) {
      throw new Blocked(`알 수 없는 자리입니다: ${holder}`)
    }
    const departmentId = holder.slice(0, dot)
    // **남의 학생회 부서에 우리 사람을 놓지 못한다.** 표도 막지만(복합 외래 키)
    // 여기서 먼저 막아야 '받을 수 없는 값'(422)이지 서버의 고장이 아니다.
    if (!departmentIds.has(departmentId)) {
      throw new Blocked('이 학생회에 없는 부서입니다')
    }
    for (const id of ids) {
      const seat = seatOf(id)
      if (seat.department !== null) {
        throw new Blocked(`한 사람이 두 자리에 있습니다: ${nameOf(id)}`)
      }
      seat.department = { id: departmentId, leader: part === 'leaders' }
    }
  }

  for (const id of seats.keys()) {
    if (!current.has(id)) throw new Blocked('이 학생회에 없는 구성원입니다')
  }
  // **빠진 사람을 조용히 남겨 두지 않는다.** 전부를 보내 덮어쓰는 자리인데 빠진
  // 사람을 제자리에 두면 '전부'가 거짓이 되고, 지우면 계약이 되돌릴 수 없다고 적지
  // 않은 자리가 사람을 없애게 된다. 화면의 '구성원 삭제'는 아직 어느 계약에도 없다.
  for (const row of rows) {
    if (!seats.has(row.id)) {
      throw new Blocked(`조직도에 없는 구성원이 있습니다: ${row.name}`)
    }
  }
  // **회장이 없는 학생회가 생기지 않게 한다.** 조직 구조를 고치는 것은 회장단뿐이라
  // 자기 자신을 빼면 다음 순간 아무도 이 화면을 못 여는 학생회가 될 수 있다.
  // 다른 회장이 빼야 한다.
  if (seats.get(save.actorMemberId)?.chair !== true) {
    throw new Blocked('자기 자신을 회장단에서 뺄 수 없습니다')
  }

  const targets = rows.map((row) => {
    const seat = seats.get(row.id)!
    if (seat.pooled && (seat.chair || seat.department !== null)) {
      throw new Blocked(`한 사람이 두 자리에 있습니다: ${row.name}`)
    }
    const role: Role = seat.chair ? 'chair' : seat.department?.leader === true ? 'head' : 'member'
    return {
      row,
      next: {
        role,
        departmentId: seat.department?.id ?? null,
        isDepartmentLeader: seat.department?.leader ?? false,
        // 회장단 안의 자리 이름은 회장단이 아닌 사람에게는 없다. 새로 든 사람의 것은
        // 아직 정할 수 없다 — 그것을 고치는 화면이 명세에 없다(ORG-03B의 '수정'이 pending).
        executiveTitle: seat.chair ? row.executiveTitle : null,
      },
    }
  })

  // **한 번에 다 바뀌거나 하나도 안 바뀐다.** 반쯤 옮겨진 조직도는 어느 화면도
  // 설명하지 못한다.
  await db.transaction(async (tx) => {
    for (const { row, next } of targets) {
      const same =
        row.role === next.role &&
        row.departmentId === next.departmentId &&
        row.isDepartmentLeader === next.isDepartmentLeader &&
        row.executiveTitle === next.executiveTitle
      if (same) continue
      await tx
        .update(members)
        .set(next)
        .where(and(eq(members.orgId, orgId), eq(members.id, row.id)))
      // 자리가 곧 역할이므로 옮긴 것이 곧 권한을 준 것이다. 그 기록은 3년 남는다.
      if (row.role !== next.role) {
        await recordRoleChange(tx, orgId, {
          memberId: row.id,
          name: row.name,
          before: row.role,
          after: next.role,
          actorUserId: save.actorUserId,
          at: save.now(),
        })
      }
    }
  })
}
