import { and, eq } from 'drizzle-orm'
import optionSourcesJson from '../../../../specs/figma/vada-wireframe/option-sources.json' with { type: 'json' }
import type { Db } from '../db/client.ts'
import { departments, members, organizations } from '../db/schema.ts'

// 셸의 맨 위와 아래. 어느 화면에 있든 그대로인 둘이다.

const ROLE_LABEL = new Map<string, string>(
  (
    optionSourcesJson.sources.find((source) => source.key === 'org.baseRoles') as
      | { options: Array<{ value: string; label: string }> }
      | undefined
  )?.options.map((option) => [option.value, option.label]) ?? [],
)

export async function organizationName(db: Db, orgId: string): Promise<{ name: string } | null> {
  const rows = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1)
  return rows[0] ?? null
}

/**
 * 지금 보는 사람.
 *
 * **서버가 완성해서 준다.** '운영부 · 부원'처럼 부서와 역할을 이미 이어 붙인 글이다 —
 * 화면이 역할 이름을 알면 그 규칙이 화면에 박힌다.
 */
export async function viewerLine(
  db: Db,
  orgId: string,
  userId: string,
): Promise<{ name: string; role: string } | null> {
  const rows = await db
    .select({ name: members.name, role: members.role, department: departments.name })
    .from(members)
    .leftJoin(departments, eq(members.departmentId, departments.id))
    .where(and(eq(members.orgId, orgId), eq(members.userId, userId)))
    .limit(1)

  const row = rows[0]
  if (row === undefined) return null

  const roleLabel = ROLE_LABEL.get(row.role) ?? row.role
  // 부서가 없으면 역할만 준다. 가운뎃점만 남은 글을 주지 않는다.
  return { name: row.name, role: row.department === null ? roleLabel : `${row.department} · ${roleLabel}` }
}
