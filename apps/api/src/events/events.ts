import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { and, desc, eq, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { CreateEventSchema, type EventResponse, type EventsResponse } from '@vada/contracts'
import { chatRooms, events, memberships } from '../db/schema.js'

import { requireSession, type SessionReader } from '../auth/require-session.js'
import { requireMembership, type MembershipEnv } from '../access/membership.js'
import { json } from '../http/validate.js'

export function createEventRoutes(
  db: Pick<PgDatabase<PgQueryResultHKT>, 'select' | 'transaction'>,
  getSession: SessionReader,
) {
  const routes = new Hono<MembershipEnv>()
  const path = '/organizations/:organizationId/events'
  const authenticated = requireSession(getSession)
  const member = requireMembership(db)
  const serialize = (event: typeof events.$inferSelect) => ({ ...event, createdAt: event.createdAt.toISOString() })
  routes.get(path, authenticated, member, async (c) => {
    const rows = await db.select().from(events)
      .where(eq(events.organizationId, c.req.param('organizationId')))
      .orderBy(desc(events.createdAt), desc(events.id))
    return c.json({ events: rows.map(serialize) } satisfies EventsResponse)
  })
  routes.post(path, json(CreateEventSchema), authenticated, member, async (c) => {
    const { name } = c.req.valid('json')
    // 저장 시점에도 소속을 확인하며, 클라이언트의 생성자·학생회 필드는 사용하지 않는다.
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
