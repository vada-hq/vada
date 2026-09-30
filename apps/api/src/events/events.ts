import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { and, desc, eq, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type { EventResponse, EventsResponse } from '@vada/contracts'
import { chatRooms, events, memberships } from '../db/schema.js'

import { requireSession, type SessionReader } from '../auth/require-session.js'
import { requireMembership, type MembershipEnv } from '../access/membership.js'

export function createEventRoutes(
  db: Pick<PgDatabase<PgQueryResultHKT>, 'select' | 'transaction'>,
  getSession: SessionReader,
  trustedOrigin: string,
) {
  const routes = new Hono<MembershipEnv>()
  const path = '/organizations/:organizationId/events'
  const origin = new URL(trustedOrigin).origin
  const authenticated = requireSession(getSession)
  const member = requireMembership(db)
  const serialize = (event: typeof events.$inferSelect) => ({ ...event, createdAt: event.createdAt.toISOString() })
  routes.get(path, authenticated, member, async (c) => {
    const rows = await db.select().from(events)
      .where(eq(events.organizationId, c.req.param('organizationId')))
      .orderBy(desc(events.createdAt), desc(events.id))
    return c.json({ events: rows.map(serialize) } satisfies EventsResponse)
  })
  routes.post(path, authenticated, member, async (c) => {
    // 인증 쿠키를 사용하는 변경 요청은 프런트엔드의 동일 출처만 허용한다.
    if (c.req.header('Origin') !== origin) return c.json({ error: 'FORBIDDEN' }, 403)
    if (c.req.header('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
      return c.json({ error: 'UNSUPPORTED_MEDIA_TYPE' }, 415)
    }
    let body: unknown
    try { body = await c.req.json() } catch { return c.json({ error: 'INVALID_INPUT' }, 400) }
    if (!body || typeof body !== 'object' || !('name' in body) || typeof body.name !== 'string' || !body.name.trim()) {
      return c.json({ error: 'INVALID_INPUT' }, 400)
    }
    // 저장 시점에도 소속을 확인하며, 클라이언트의 생성자·학생회 필드는 사용하지 않는다.
    const name = body.name.trim()
    const event = await db.transaction(async tx => {
      const [created] = await tx.insert(events).select(
        tx.select({
          id: sql<string>`${randomUUID()}`.as('id'),
          organizationId: memberships.organizationId,
          name: sql<string>`${name}`.as('name'),
          createdBy: memberships.userId,
          createdAt: sql<Date>`now()`.as('created_at'),
        }).from(memberships).where(and(
          eq(memberships.userId, c.get('userId')),
          eq(memberships.organizationId, c.req.param('organizationId')),
        )),
      ).returning()
      if (!created) return undefined
      await tx.insert(chatRooms).values({ id: randomUUID(), organizationId: created.organizationId, eventId: created.id })
      return created
    })
    if (!event) return c.json({ error: 'FORBIDDEN' }, 403)
    return c.json({ event: serialize(event) } satisfies EventResponse, 201)
  })
  return routes
}
