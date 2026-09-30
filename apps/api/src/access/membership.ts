import { and, eq } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { createMiddleware } from 'hono/factory'
import type { MembershipSummary } from '@vada/contracts'
import type { SessionEnv } from '../auth/require-session.js'
import { departments, memberships, organizations } from '../db/schema.js'

type MembershipDatabase = Pick<PgDatabase<PgQueryResultHKT>, 'select'>
export type MembershipEnv = { Variables: SessionEnv['Variables'] & { membership: MembershipSummary } }

export function queryMemberships(db: MembershipDatabase, userId: string, organizationId?: string) {
  return db.select({
    id: memberships.id,
    organization: { id: organizations.id, name: organizations.name },
    department: { id: departments.id, name: departments.name, handlesFinance: departments.handlesFinance },
  }).from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .innerJoin(departments, and(eq(departments.id, memberships.departmentId), eq(departments.organizationId, memberships.organizationId)))
    .where(and(eq(memberships.userId, userId), organizationId === undefined ? undefined : eq(memberships.organizationId, organizationId)))
    .orderBy(organizations.id)
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
