import { and, eq } from 'drizzle-orm'
import optionSourcesJson from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import type { Db } from '../db/client.ts'
import { departments, members, permissionChanges } from '../db/schema.ts'
import { NotFound, Blocked } from '../routes.ts'

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
    .where(and(eq(members.orgId, orgId), eq(members.id, memberId)))
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

  await db
    .update(members)
    .set({ role: role as 'chair' | 'head' | 'member' })
    .where(and(eq(members.orgId, orgId), eq(members.id, change.memberId)))

  await db.insert(permissionChanges).values({
    id: `${change.memberId}:${change.now().toISOString()}`,
    at: change.now(),
    orgId,
    actorUserId: change.actorUserId,
    subjectMemberId: change.memberId,
    // 구성원이 지워져도 누구였는지는 남는다 — 가리키는 줄이 사라지면 기록이
    // '누구인지 모르는 변경'이 된다.
    subjectName: before.name,
    change: '기본 역할 변경',
    before: before.role,
    after: role,
  })
}
