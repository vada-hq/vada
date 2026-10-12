import { Hono } from 'hono'
import type { HomeResponse } from '@vada/contracts'
import { requireMembership, type MembershipEnv } from '../access/membership.js'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { homeOf, type HomeDatabase } from './service.js'

// 운영 현황(M6). 구성원 누구나 본다(미배정 포함). 읽기만 한다.
export function createHomeRoutes(db: HomeDatabase, session: SessionReader, { now = () => new Date() }: { now?: () => Date } = {}) {
  const routes = new Hono<MembershipEnv>()
  routes.get('/organizations/:organizationId/home', requireSession(session), requireMembership(db), async c =>
    c.json(await homeOf(db, c.get('membership').organization.id, now()) satisfies HomeResponse))
  return routes
}
