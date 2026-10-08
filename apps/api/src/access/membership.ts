import { and, eq, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { createMiddleware } from 'hono/factory'
import type { MembershipPermissions, MembershipSummary } from '@vada/contracts'
import type { SessionEnv } from '../auth/require-session.js'
import { departments, memberships, organizations } from '../db/schema.js'

type MembershipDatabase = Pick<PgDatabase<PgQueryResultHKT>, 'select'>
export type MembershipEnv = { Variables: SessionEnv['Variables'] & { membership: MembershipSummary } }

// 권한 규칙은 여기 한 곳에 둔다. 회장단은 조직을 관리하고, 회장단과 구매 승인 부서는 구매를 승인한다.
export function permissionsOf(department: { isLeadership: boolean; handlesFinance: boolean } | null): MembershipPermissions {
  return {
    manageOrganization: department?.isLeadership ?? false,
    approvePurchases: Boolean(department?.isLeadership || department?.handlesFinance),
  }
}
// 구매·배송의 재정 검사가 같은 규칙을 SQL로 쓴다. departments를 소속과 조인한 쿼리에 넣는다.
export const approvesPurchases = sql<boolean>`(${departments.isLeadership} or ${departments.handlesFinance})`

export async function queryMemberships(db: MembershipDatabase, userId: string, organizationId?: string): Promise<MembershipSummary[]> {
  const rows = await db.select({
    id: memberships.id,
    organization: { id: organizations.id, name: organizations.name, inviteCode: organizations.inviteCode },
    department: { id: departments.id, name: departments.name, handlesFinance: departments.handlesFinance, isLeadership: departments.isLeadership },
    title: memberships.title,
  }).from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    // 초대로 들어온 구성원은 부서가 없다(미배정). 부서가 없어도 소속은 유지한다.
    .leftJoin(departments, and(eq(departments.id, memberships.departmentId), eq(departments.organizationId, memberships.organizationId)))
    .where(and(eq(memberships.userId, userId), organizationId === undefined ? undefined : eq(memberships.organizationId, organizationId)))
    .orderBy(organizations.id)
  return rows.map(row => ({ ...row, permissions: permissionsOf(row.department) }))
}

// requireSession 이후, organizationId 경로 매개변수가 있는 엔드포인트에 적용한다.
export function requireMembership(db: MembershipDatabase) {
  return createMiddleware<MembershipEnv>(async (c, next) => {
    const userId = c.get('userId')
    if (!userId) return c.json({ error: 'UNAUTHENTICATED' }, 401)
    const organizationId = c.req.param('organizationId')
    if (!organizationId) return c.json({ error: 'FORBIDDEN' }, 403)
    const [membership] = await queryMemberships(db, userId, organizationId)
    // 학생회의 존재 여부도 소속이 없는 사용자에게 공개하지 않는다.
    if (!membership) return c.json({ error: 'FORBIDDEN' }, 403)
    c.set('membership', membership)
    await next()
  })
}
