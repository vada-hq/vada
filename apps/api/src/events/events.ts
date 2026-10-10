import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { and, desc, eq, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { CreateEventSchema, UpdateEventSchema, dateFromKorean, koreanOf, token, type EventResponse, type EventSummary,
  type EventsResponse } from '@vada/contracts'
import { chatRooms, events, memberships, registrationForms } from '../db/schema.js'

import { requireSession, type SessionReader } from '../auth/require-session.js'
import { requireEventManager, requireMembership, type MembershipEnv } from '../access/membership.js'
import { ApiError } from '../http/errors.js'
import { json } from '../http/validate.js'

// 경로의 ID도 본문과 같은 규칙으로 검사한다. 제어 문자나 너무 긴 값은 없는 행사로 본다.
const pathId = token(64)
function idOf(value: string | undefined) {
  const parsed = pathId.safeParse(value)
  if (!parsed.success) throw new ApiError('NOT_FOUND', 404)
  return parsed.data
}

// 일시는 한국 시각 문자열로 준다.
export const serializeEvent = (event: typeof events.$inferSelect): EventSummary => ({
  id: event.id, organizationId: event.organizationId, name: event.name, createdBy: event.createdBy, createdAt: event.createdAt.toISOString(),
  startsAt: event.startsAt && koreanOf(event.startsAt), endsAt: event.endsAt && koreanOf(event.endsAt), place: event.place, version: event.version,
})

export function createEventRoutes(
  db: Pick<PgDatabase<PgQueryResultHKT>, 'select' | 'transaction'>,
  getSession: SessionReader,
) {
  const routes = new Hono<MembershipEnv>()
  const path = '/organizations/:organizationId/events'
  const authenticated = requireSession(getSession)
  const member = requireMembership(db)
  const manager = requireEventManager()
  routes.get(path, authenticated, member, async (c) => {
    const rows = await db.select().from(events)
      .where(eq(events.organizationId, c.req.param('organizationId')))
      .orderBy(desc(events.createdAt), desc(events.id))
    return c.json({ events: rows.map(serializeEvent) } satisfies EventsResponse)
  })
  routes.post(path, json(CreateEventSchema), authenticated, member, async (c) => {
    const { name } = c.req.valid('json')
    // 저장 시점에도 소속을 확인하며, 클라이언트의 생성자·학생회 필드는 사용하지 않는다.
    // INSERT … SELECT는 표의 모든 칸을 순서대로 골라야 하므로, 일시·장소(M3a)는 빈 값과 첫 버전으로 채운다.
    const event = await db.transaction(async tx => {
      const [created] = await tx.insert(events).select(
        tx.select({
          id: sql<string>`${randomUUID()}`.as('id'),
          organizationId: memberships.organizationId,
          name: sql<string>`${name}`.as('name'),
          createdBy: memberships.userId,
          createdAt: sql<Date>`now()`.as('created_at'),
          startsAt: sql<Date | null>`null::timestamptz`.as('starts_at'),
          endsAt: sql<Date | null>`null::timestamptz`.as('ends_at'),
          place: sql<string | null>`null::text`.as('place'),
          version: sql<number>`1`.as('version'),
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
    return c.json({ event: serializeEvent(event) } satisfies EventResponse, 201)
  })
  // 행사 일시·장소 수정. 참가 신청의 마감과 보관 기간이 행사 끝에 기대므로, 신청이 있으면 시작을 비우거나 마감보다 일찍 끝낼 수 없다.
  routes.patch(`${path}/:eventId`, json(UpdateEventSchema), authenticated, member, manager, async (c) => {
    const input = c.req.valid('json')
    const organizationId = c.req.param('organizationId')
    const eventId = idOf(c.req.param('eventId'))
    const event = await db.transaction(async tx => {
      // 행사 행은 FOR NO KEY UPDATE로 잠근다(저장소 관례). 참가 신청 설정 변경·입금 확인과 겹치지 않는다.
      const [current] = await tx.select().from(events)
        .where(and(eq(events.organizationId, organizationId), eq(events.id, eventId))).for('no key update')
      if (!current) throw new ApiError('NOT_FOUND', 404)
      if (current.version !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
      const startsAt = input.startsAt === null ? null : dateFromKorean(input.startsAt)
      const endsAt = input.endsAt === null ? null : dateFromKorean(input.endsAt)
      const [form] = await tx.select({ closesAt: registrationForms.closesAt }).from(registrationForms)
        .where(and(eq(registrationForms.organizationId, organizationId), eq(registrationForms.eventId, eventId)))
      if (form) {
        if (!startsAt) throw new ApiError('EVENT_TIME_REQUIRED', 409)
        if (form.closesAt > (endsAt ?? startsAt)) throw new ApiError('DEADLINE_AFTER_EVENT', 409)
      }
      const [updated] = await tx.update(events).set({ startsAt, endsAt, place: input.place, version: current.version + 1 })
        .where(and(eq(events.organizationId, organizationId), eq(events.id, eventId))).returning()
      return updated!
    })
    return c.json({ event: serializeEvent(event) } satisfies EventResponse)
  })
  return routes
}
