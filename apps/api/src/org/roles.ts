import { eq, sql } from 'drizzle-orm'
import permissionsJson from '../../../../specs/figma/vada-wireframe/permissions.json' with { type: 'json' }
import optionSourcesJson from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import type { Db } from '../db/client.ts'
import { departments, members } from '../db/schema.ts'

// 역할 및 권한(ORG-04 · ORG-04B)이 읽는 것.
//
// **서버가 완성된 글을 준다.** 화면은 '7명'을 이어 붙이지 않고 'violet'을 고르지
// 않는다 — 역할 이름과 색의 규칙이 화면에 박히면 규칙이 바뀔 때마다 화면을 고쳐야 한다.
//
// **역할 이름은 명세가 갖고 있다.** `org.baseRoles`가 chair→회장단을 이미 말하므로
// 여기서 다시 적지 않는다. 두 벌을 들면 갈린다.

type Role = 'chair' | 'head' | 'member'

const ROLE_LABEL = new Map<string, string>(
  (
    optionSourcesJson.sources.find((source) => source.key === 'org.baseRoles') as
      | { options: Array<{ value: string; label: string }> }
      | undefined
  )?.options.map((option) => [option.value, option.label]) ?? [],
)

// 색은 표현이라 명세가 정하지 않는다. **서버가 고르되 그 규칙은 한 곳에만 있다** —
// 화면이 역할 이름을 보고 색을 고르면 그 규칙이 화면마다 흩어진다.
const ROLE_TONE: Record<Role, string> = {
  chair: 'violet',
  head: 'blue',
  member: 'gray',
}

export interface RoleCounts {
  chairCount: number
  headCount: number
  memberCount: number
}

export async function roleCounts(db: Db, orgId: string): Promise<RoleCounts> {
  const rows = await db
    .select({ role: members.role, count: sql<number>`count(*)::int` })
    .from(members)
    .where(eq(members.orgId, orgId))
    .groupBy(members.role)

  const by = new Map(rows.map((row) => [row.role, row.count]))
  return {
    chairCount: by.get('chair') ?? 0,
    headCount: by.get('head') ?? 0,
    memberCount: by.get('member') ?? 0,
  }
}

export interface RoleAssignment {
  id: string
  name: string
  department: string
  roleLabel: string
  roleTone: string
  role: string
}

export async function roleAssignments(db: Db, orgId: string): Promise<RoleAssignment[]> {
  const rows = await db
    .select({
      id: members.id,
      name: members.name,
      role: members.role,
      department: departments.name,
    })
    .from(members)
    .leftJoin(departments, eq(members.departmentId, departments.id))
    .where(eq(members.orgId, orgId))
    // 회장단이 먼저, 그다음 부서장, 부원. 그림이 그린 차례다 — 이름순이 아니다.
    .orderBy(
      sql`case ${members.role} when 'chair' then 0 when 'head' then 1 else 2 end`,
      members.name,
    )

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    // 부서에 아직 안 든 사람이 있다. **비었다고 빈 글을 주지 않는다** —
    // 조용한 대체를 하지 않는 것이 이 저장소의 규칙이고 서버도 같은 규칙을 따른다.
    department: row.department ?? '소속 없음',
    roleLabel: ROLE_LABEL.get(row.role) ?? row.role,
    roleTone: ROLE_TONE[row.role as Role] ?? 'gray',
    role: row.role,
  }))
}

/** 목록 곁의 한 줄. **세는 말까지 서버가 만든다.** */
export async function roleAssignmentCount(db: Db, orgId: string): Promise<{ total: string }> {
  const counts = await roleCounts(db, orgId)
  const total = counts.chairCount + counts.headCount + counts.memberCount
  return { total: `${total}명` }
}

export interface PermissionMatrixRow {
  id: string
  area: string
  chair: string
  chairTone: string
  head: string
  headTone: string
  member: string
  memberTone: string
}

/**
 * ORG-04이 그리는 권한 표.
 *
 * **저장소에서 오지 않는다.** 행렬은 모든 학생회가 같은 것을 쓰므로(2026-08-30 결정)
 * 조직마다 저장할 까닭이 없다 — 저장하면 조직이 늘 때마다 같은 열세 줄이 늘고,
 * 규칙을 고칠 때 이미 만들어진 조직들은 옛 규칙을 든 채 남는다.
 *
 * **표는 정책의 그림이다.** 권한을 판정하는 것과 표를 그리는 것이 같은 원본에서
 * 나오므로, 규칙을 고치면 화면이 저절로 따라온다.
 */
export function permissionMatrix(): PermissionMatrixRow[] {
  return permissionsJson.areas
    .filter((area) => area.drawnInMatrix)
    .map((area) => ({
      id: area.key,
      area: area.name,
      chair: area.rules.chair.label!,
      chairTone: matrixTone(area.rules.chair.label!),
      head: area.rules.head.label!,
      headTone: matrixTone(area.rules.head.label!),
      member: area.rules.member.label!,
      memberTone: matrixTone(area.rules.member.label!),
    }))
}

// '가능'은 초록, 조건이 붙으면 노랑, 못 하면 무채색이다.
function matrixTone(label: string): string {
  if (label === '가능') return 'green'
  if (label === '—') return 'gray'
  return 'yellow'
}
