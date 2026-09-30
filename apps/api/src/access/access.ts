import { Hono } from 'hono'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type { MembershipSummary, MembershipsResponse } from '@vada/contracts'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { queryMemberships, requireMembership, type MembershipEnv } from './membership.js'

export function createAccessRoutes(db: Pick<PgDatabase<PgQueryResultHKT>, 'select'>, getSession: SessionReader) {
  const routes = new Hono<MembershipEnv>()
  const authenticated = requireSession(getSession)

  routes.get('/me/memberships', authenticated, async (c) => {
    const result: MembershipSummary[] = await queryMemberships(db, c.get('userId'))
    return c.json({ memberships: result } satisfies MembershipsResponse)
  })
  routes.get('/organizations/:organizationId/membership', authenticated, requireMembership(db), (c) => {
    return c.json({ membership: c.get('membership') })
  })
  return routes
}
