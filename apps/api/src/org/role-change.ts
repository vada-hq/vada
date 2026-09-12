import { and, eq } from 'drizzle-orm'
import optionSourcesJson from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import type { Db } from '../db/client.ts'
import { departments, members, permissionChanges } from '../db/schema.ts'
import { NotFound, Blocked } from '../errors.ts'
import type { Role } from '../permissions.ts'
import { stillHere } from './membership.ts'

// 구성원의 기본 역할을 바꾼다(ORG-04B).
//
// **법이 이 자리를 3년 본다.** 권한을 주고 바꾸고 없앤 기록은 3년 보관해야 한다
// (개인정보의 안전성 확보조치 기준). 접속 기록과 따로 두는 까닭은 보관 기간이
// 달라서다 — 같은 표에 담으면 1년치를 지울 때 3년치가 함께 지워진다.

const ROLES = new Map<string, string>(
  (
    optionSourcesJson.sources.find((source) => source.key === 'org.baseRoles') as
      | { options: Array<{ value: string; label: string }> }
      | undefined
  )?.options.map((option) => [option.value, option.label]) ?? [],
)

export interface RoleAssignmentRow {
  id: string
  name: string
  department: string
  roleLabel: string
  roleTone: string
  role: string
}

const TONE: Record<string, string> = { chair: 'violet', head: 'blue', member: 'gray' }

/** 고른 사람 한 건. **누구인지는 자리가 말한다** — 서버가 기억하지 않는다. */
export async function roleAssignmentOf(
  db: Db,
  orgId: string,
  memberId: string,
): Promise<RoleAssignmentRow | null> {
  const rows = await db
    .select({
      id: members.id,
      name: members.name,
      role: members.role,
      department: departments.name,
    })
    .from(members)
    .leftJoin(departments, eq(members.departmentId, departments.id))
    // 나간 사람의 역할은 바꿀 것이 없다. 안 걸면 ORG-04B가 나간 사람을 골라
    // 권한을 주고, 그 권한은 아무도 못 쓰지만 표에는 남는다.
    .where(and(eq(members.orgId, orgId), eq(members.id, memberId), stillHere))
    .limit(1)

  const row = rows[0]
  if (row === undefined) return null
  return {
    id: row.id,
    name: row.name,
    department: row.department ?? '소속 없음',
    roleLabel: ROLES.get(row.role) ?? row.role,
    roleTone: TONE[row.role] ?? 'gray',
    role: row.role,
  }
}

export interface RoleChange {
  memberId: string
  /** 무엇으로 바꾸는가. `org.baseRoles`가 든 값 셋 중 하나다. */
  baseRole: unknown
  actorUserId: string | null
  now: () => Date
}

/**
 * 역할을 바꾸고 **바꾼 사실을 남긴다.**
 *
 * 두 번 보내도 같은 역할이 된다(계약의 `repeat: overwrite`). 다만 **기록은 바뀐
 * 때만 남긴다** — 같은 역할로 다시 눌린 것은 변경이 아니고, 변경이 아닌 것을
 * 변경으로 적으면 3년치 기록이 눌린 횟수가 된다.
 */
export async function changeRole(db: Db, orgId: string, change: RoleChange): Promise<void> {
  const role = change.baseRole
  // **명세가 든 셋 밖의 값은 받지 않는다.** 받아 두면 그 값으로 권한을 판정할 수
  // 없고, 판정할 수 없는 역할은 조용히 아무것도 못 하는 사람이 된다.
  if (typeof role !== 'string' || !ROLES.has(role)) {
    throw new Blocked('그 역할은 고를 수 있는 것이 아닙니다')
  }

  const before = await roleAssignmentOf(db, orgId, change.memberId)
  if (before === null) {
    throw new NotFound('그 구성원을 찾지 못했습니다')
  }
  if (before.role === role) return

  // **자리가 곧 역할이다.** 조직도(ORG-03B)가 그 규칙으로 쓰는데 이 자리는 오랫동안
  // `role`만 바꿨다. 그래서 여기서 부서장으로 만들어도 조직도에는 부서원으로 남았고,
  // 두 화면이 한 표를 다른 규칙으로 쓰고 있었다. 조직도의 규칙으로 모은다.
  const seat = await seatOf(db, orgId, change.memberId)
  const next = {
    role: role as Role,
    // 회장단은 부서에 들지 않는다. 조직도가 자리를 따로 두고 그린다.
    departmentId: role === 'chair' ? null : seat.departmentId,
    isDepartmentLeader: role === 'head',
    // 회장단 안의 자리 이름은 회장단이 아닌 사람에게는 없다. 새로 든 사람의 것은
    // 아직 정할 수 없다 — 그것을 고치는 화면이 명세에 없다(조직도와 같은 규칙).
    executiveTitle: role === 'chair' ? seat.executiveTitle : null,
  }
  // **부서장은 부서가 있어야 한다.** 없는 채로 두면 조직도의 어느 부서에도 안 서고,
  // '부서장'이라는 말만 남는다.
  if (role === 'head' && next.departmentId === null) {
    throw new Blocked('부서를 정한 뒤에 부서장으로 바꿀 수 있습니다')
  }
  // **회장이 없는 학생회가 생기지 않게 한다.** 조직 구조를 고치는 것은 회장단뿐이라
  // 마지막 회장이 스스로 내려오면 다음 순간 아무도 그 화면을 못 연다. 조직도 저장과
  // 내보내기가 같은 까닭으로 같은 것을 막는다.
  if (before.role === 'chair' && role !== 'chair' && (await chairCount(db, orgId)) <= 1) {
    throw new Blocked('마지막 회장의 역할은 바꿀 수 없습니다')
  }

  await db
    .update(members)
    .set(next)
    .where(and(eq(members.orgId, orgId), eq(members.id, change.memberId)))

  await recordRoleChange(db, orgId, {
    memberId: change.memberId,
    change: '기본 역할 변경',
    name: before.name,
    before: before.role,
    after: role,
    actorUserId: change.actorUserId,
    at: change.now(),
  })
}

/** 지금 그 사람이 앉은 자리. 역할을 바꿔도 부서는 그대로 따라간다. */
async function seatOf(
  db: Db,
  orgId: string,
  memberId: string,
): Promise<{ departmentId: string | null; executiveTitle: string | null }> {
  const rows = await db
    .select({ departmentId: members.departmentId, executiveTitle: members.executiveTitle })
    .from(members)
    .where(and(eq(members.orgId, orgId), eq(members.id, memberId), stillHere))
    .limit(1)
  return rows[0] ?? { departmentId: null, executiveTitle: null }
}

/** 지금 남아 있는 회장이 몇인가. */
async function chairCount(db: Db, orgId: string): Promise<number> {
  const rows = await db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.orgId, orgId), stillHere, eq(members.role, 'chair')))
  return rows.length
}

export interface RoleChangeRecord {
  memberId: string
  /**
   * 무슨 변경인가. 표의 `change` 칸이자 **줄을 가르는 조각**이다.
   *
   * 한동안 열쇠가 `사람:시각`뿐이었다. 같은 순간에 한 사람에게 두 가지 일이
   * 일어나면(역할을 바꾸고 곧바로 내보낸다) 두 줄이 같은 열쇠를 갖고, 뒤엣것이
   * 500으로 죽었다 — 3년 남겨야 하는 기록이 조용히 하나 사라지는 자리다.
   */
  change: string
  /** 그때 그 사람의 이름. 구성원이 지워져도 남는다. */
  name: string
  /** 그 전의 상태. **처음 들어오는 사람에게는 그 전이 없다.** */
  before: string | null
  after: string
  actorUserId: string | null
  at: Date
}

/**
 * 기본 역할이 바뀐 사실을 3년 남는 표에 적는다.
 *
 * **길이 둘이다.** ORG-04B가 역할을 바로 바꾸고, 조직도(ORG-03B)가 자리를 옮기면서
 * 바꾼다 — 자리가 곧 역할이기 때문이다. 두 길이 같은 줄을 쓰지 않으면 한쪽의
 * 기록만 남고, 남지 않은 쪽은 조용하다.
 */
export async function recordRoleChange(
  db: Pick<Db, 'insert'>,
  orgId: string,
  record: RoleChangeRecord,
): Promise<void> {
  await db
    .insert(permissionChanges)
    .values({
      // **한 사건에 열쇠 하나.** 사람과 시각뿐이던 동안 같은 순간의 두 변경이 서로를
      // 지웠고(역할을 바꾸고 곧바로 내보낸다), 그러면 3년 남겨야 하는 기록이 조용히
      // 하나 사라진다. 무엇이 무엇으로 바뀌었는지까지 열쇠에 넣는다.
      id: `${record.memberId}:${record.change}:${record.before ?? ''}>${record.after}:${record.at.toISOString()}`,
      at: record.at,
      orgId,
      actorUserId: record.actorUserId,
      subjectMemberId: record.memberId,
      // 구성원이 지워져도 누구였는지는 남는다 — 가리키는 줄이 사라지면 기록이
      // '누구인지 모르는 변경'이 된다.
      subjectName: record.name,
      change: record.change,
      before: record.before,
      after: record.after,
    })
    // 열쇠까지 같으면 **같은 사건**이다 — 두 번 보내진 것이지 두 번 일어난 것이
    // 아니다. 그때 500을 내면 두 번 눌린 사람이 아무것도 못 한다.
    .onConflictDoNothing()
}
