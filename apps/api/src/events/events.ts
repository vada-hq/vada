import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { and, count, desc, eq, ne, sql } from 'drizzle-orm'
import { alias, type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { CancelEventCompletionSchema, CompleteEventSchema, CreateEventSchema, UpdateEventSchema, dateFromKorean, koreanOf, token,
  type EventCompletionResponse, type EventResponse, type EventSummary, type EventsResponse } from '@vada/contracts'
import { chatRooms, departments, eventFinances, events, memberships, registrationForms, tasks, users } from '../db/schema.js'

import { requireSession, type SessionReader } from '../auth/require-session.js'
import { requireEventManager, requireMembership, requireOrganizationManager, type MembershipEnv } from '../access/membership.js'
import { ApiError } from '../http/errors.js'
import { json } from '../http/validate.js'
import { lockActiveEvent } from './lock.js'

// 경로의 ID도 본문과 같은 규칙으로 검사한다. 제어 문자나 너무 긴 값은 없는 행사로 본다.
const pathId = token(64)
function idOf(value: string | undefined) {
  const parsed = pathId.safeParse(value)
  if (!parsed.success) throw new ApiError('NOT_FOUND', 404)
  return parsed.data
}

type Reader = Pick<PgDatabase<PgQueryResultHKT>, 'select'>
const ownerMemberships = alias(memberships, 'event_owner_memberships')
const ownerUsers = alias(users, 'event_owner_users')
type OwnerNames = { departmentName: string | null; ownerMembershipId: string | null; ownerName: string | null }
const noOwner: OwnerNames = { departmentName: null, ownerMembershipId: null, ownerName: null }

// 일시는 한국 시각 문자열로 준다. 담당 부서·책임자(M5b)는 이름과 함께 준다.
export const serializeEvent = (event: typeof events.$inferSelect, owner: OwnerNames): EventSummary => ({
  id: event.id, organizationId: event.organizationId, name: event.name, createdBy: event.createdBy, createdAt: event.createdAt.toISOString(),
  startsAt: event.startsAt && koreanOf(event.startsAt), endsAt: event.endsAt && koreanOf(event.endsAt), place: event.place, version: event.version,
  completedAt: event.completedAt?.toISOString() ?? null,
  ownerDepartment: event.ownerDepartmentId && owner.departmentName !== null ? { id: event.ownerDepartmentId, name: owner.departmentName } : null,
  owner: owner.ownerMembershipId !== null && owner.ownerName !== null ? { membershipId: owner.ownerMembershipId, name: owner.ownerName } : null,
})
// 행사 목록(만든 순 역순)과 바꾼 뒤의 응답, 결과보고서가 같이 쓴다. eventId를 주면 그 행사 하나다.
export async function eventSummaries(db: Reader, organizationId: string, eventId?: string): Promise<EventSummary[]> {
  const rows = await db.select({ event: events, departmentName: departments.name, ownerMembershipId: ownerMemberships.id, ownerName: ownerUsers.name })
    .from(events)
    .leftJoin(departments, and(eq(departments.organizationId, events.organizationId), eq(departments.id, events.ownerDepartmentId)))
    .leftJoin(ownerMemberships, and(eq(ownerMemberships.organizationId, events.organizationId), eq(ownerMemberships.userId, events.ownerId)))
    .leftJoin(ownerUsers, eq(ownerUsers.id, events.ownerId))
    .where(and(eq(events.organizationId, organizationId), eventId === undefined ? undefined : eq(events.id, eventId)))
    .orderBy(desc(events.createdAt), desc(events.id))
  return rows.map(({ event, ...owner }) => serializeEvent(event, owner))
}
// 다른 학생회의 행사나 없는 행사는 NOT_FOUND다.
export async function eventSummary(db: Reader, organizationId: string, eventId: string) {
  const [summary] = await eventSummaries(db, organizationId, eventId)
  if (!summary) throw new ApiError('NOT_FOUND', 404)
  return summary
}

export function createEventRoutes(
  db: Pick<PgDatabase<PgQueryResultHKT>, 'select' | 'transaction'>,
  getSession: SessionReader,
) {
  const routes = new Hono<MembershipEnv>()
  const path = '/organizations/:organizationId/events'
  const authenticated = requireSession(getSession)
  const member = requireMembership(db)
  const manager = requireEventManager()
  routes.get(path, authenticated, member, async (c) =>
    c.json({ events: await eventSummaries(db, c.req.param('organizationId')) } satisfies EventsResponse))
  routes.post(path, json(CreateEventSchema), authenticated, member, async (c) => {
    const { name } = c.req.valid('json')
    // 저장 시점에도 소속을 확인하며, 클라이언트의 생성자·학생회 필드는 사용하지 않는다.
    // INSERT … SELECT는 표의 모든 칸을 순서대로 골라야 하므로, 일시·장소(M3a)·완료(M5a)·담당(M5b)은 빈 값, 버전은 1로 채운다.
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
          completedAt: sql<Date | null>`null::timestamptz`.as('completed_at'),
          completedBy: sql<string | null>`null::text`.as('completed_by'),
          ownerDepartmentId: sql<string | null>`null::text`.as('owner_department_id'),
          ownerId: sql<string | null>`null::text`.as('owner_id'),
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
    return c.json({ event: serializeEvent(event, noOwner) } satisfies EventResponse, 201)
  })
  // 행사 정보(일시·장소·담당) 수정. 참가 신청의 마감과 보관 기간이 행사 끝에 기대므로, 신청이 있으면 시작을 비우거나 마감보다 일찍 끝낼 수 없다.
  routes.patch(`${path}/:eventId`, json(UpdateEventSchema), authenticated, member, manager, async (c) => {
    const input = c.req.valid('json')
    const organizationId = c.req.param('organizationId')
    const eventId = idOf(c.req.param('eventId'))
    const event = await db.transaction(async tx => {
      // 행사 행은 FOR NO KEY UPDATE로 잠근다(저장소 관례). 참가 신청 설정 변경·입금 확인과 겹치지 않고, 완료한 행사(M5a)는 막는다.
      const current = await lockActiveEvent(tx, organizationId, eventId)
      if (current.version !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
      const startsAt = input.startsAt === null ? null : dateFromKorean(input.startsAt)
      const endsAt = input.endsAt === null ? null : dateFromKorean(input.endsAt)
      const [form] = await tx.select({ closesAt: registrationForms.closesAt }).from(registrationForms)
        .where(and(eq(registrationForms.organizationId, organizationId), eq(registrationForms.eventId, eventId)))
      if (form) {
        if (!startsAt) throw new ApiError('EVENT_TIME_REQUIRED', 409)
        if (form.closesAt > (endsAt ?? startsAt)) throw new ApiError('DEADLINE_AFTER_EVENT', 409)
      }
      // 담당 부서·책임자(M5b). 업무 추가와 같은 순서로 부서(FOR KEY SHARE) → 소속(FOR SHARE)을 잠근다(행사 → 부서 → 소속).
      if (input.ownerDepartmentId !== null) {
        const [department] = await tx.select({ id: departments.id }).from(departments)
          .where(and(eq(departments.organizationId, organizationId), eq(departments.id, input.ownerDepartmentId))).for('key share')
        if (!department) throw new ApiError('EVENT_DEPARTMENT_INVALID', 409)
      }
      let ownerId: string | null = null
      if (input.ownerMembershipId !== null) {
        const [owner] = await tx.select({ userId: memberships.userId, departmentId: memberships.departmentId }).from(memberships)
          .where(and(eq(memberships.organizationId, organizationId), eq(memberships.id, input.ownerMembershipId))).for('share')
        // 이미 책임자인 사람은 그 뒤 미배정이 되었어도 그대로 둘 수 있다.
        if (!owner || (owner.departmentId === null && owner.userId !== current.ownerId)) throw new ApiError('EVENT_OWNER_INVALID', 409)
        ownerId = owner.userId
      }
      await tx.update(events).set({ startsAt, endsAt, place: input.place, ownerDepartmentId: input.ownerDepartmentId, ownerId,
        version: current.version + 1 }).where(and(eq(events.organizationId, organizationId), eq(events.id, eventId)))
      return eventSummary(tx, organizationId, eventId)
    })
    return c.json({ event } satisfies EventResponse)
  })
  const leader = requireOrganizationManager()
  // 완료·완료 취소가 잠근다. 완료 여부와 상관없이 잠가야 하므로 lockActiveEvent를 쓰지 않는다.
  async function lockEvent(tx: Pick<PgDatabase<PgQueryResultHKT>, 'select'>, organizationId: string, eventId: string) {
    const [event] = await tx.select().from(events)
      .where(and(eq(events.organizationId, organizationId), eq(events.id, eventId))).for('no key update')
    if (!event) throw new ApiError('NOT_FOUND', 404)
    return event
  }
  // 완료 확인 대화상자가 연다. 정산 여부와 끝나지 않은 업무(예정·진행 중) 수다.
  routes.get(`${path}/:eventId/completion`, authenticated, member, async (c) => {
    const organizationId = c.req.param('organizationId')
    const eventId = idOf(c.req.param('eventId'))
    const [event] = await db.select({ id: events.id }).from(events).where(and(eq(events.organizationId, organizationId), eq(events.id, eventId)))
    if (!event) throw new ApiError('NOT_FOUND', 404)
    const [finance] = await db.select({ settledAt: eventFinances.settledAt }).from(eventFinances)
      .where(and(eq(eventFinances.organizationId, organizationId), eq(eventFinances.eventId, eventId)))
    const [open] = await db.select({ n: count() }).from(tasks)
      .where(and(eq(tasks.organizationId, organizationId), eq(tasks.eventId, eventId), ne(tasks.status, 'done')))
    return c.json({ settled: Boolean(finance?.settledAt), openTasks: open?.n ?? 0 } satisfies EventCompletionResponse)
  })
  // 완료: 회장단이 정산한 행사를 완료한다. 완료한 행사는 바꿀 수 없고 옆 메뉴 "기록"으로 옮겨진다.
  routes.post(`${path}/:eventId/completion`, json(CompleteEventSchema), authenticated, member, leader, async (c) => {
    const input = c.req.valid('json')
    const organizationId = c.req.param('organizationId')
    const eventId = idOf(c.req.param('eventId'))
    const event = await db.transaction(async tx => {
      const current = await lockEvent(tx, organizationId, eventId)
      if (current.version !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
      if (current.completedAt) throw new ApiError('INVALID_STATE', 409)
      // 정산·다시 열기도 이 행사 행을 FOR NO KEY UPDATE로 잠그므로, 여기서 본 정산 여부는 완료가 끝날 때까지 그대로다.
      const [finance] = await tx.select({ settledAt: eventFinances.settledAt }).from(eventFinances)
        .where(and(eq(eventFinances.organizationId, organizationId), eq(eventFinances.eventId, eventId)))
      if (!finance?.settledAt) throw new ApiError('EVENT_NOT_SETTLED', 409)
      await tx.update(events).set({ completedAt: sql`now()`, completedBy: c.get('userId'), version: current.version + 1 })
        .where(and(eq(events.organizationId, organizationId), eq(events.id, eventId)))
      return eventSummary(tx, organizationId, eventId)
    })
    return c.json({ event } satisfies EventResponse)
  })
  // 완료 취소: 실수로 완료했을 때 되돌린다. 정산은 그대로 두고, 돈이 바뀌지 않아 기록을 남기지 않는다.
  routes.post(`${path}/:eventId/completion/cancel`, json(CancelEventCompletionSchema), authenticated, member, leader, async (c) => {
    const input = c.req.valid('json')
    const organizationId = c.req.param('organizationId')
    const eventId = idOf(c.req.param('eventId'))
    const event = await db.transaction(async tx => {
      const current = await lockEvent(tx, organizationId, eventId)
      if (current.version !== input.version) throw new ApiError('VERSION_CONFLICT', 409)
      if (!current.completedAt) throw new ApiError('INVALID_STATE', 409)
      await tx.update(events).set({ completedAt: null, completedBy: null, version: current.version + 1 })
        .where(and(eq(events.organizationId, organizationId), eq(events.id, eventId)))
      return eventSummary(tx, organizationId, eventId)
    })
    return c.json({ event } satisfies EventResponse)
  })
  return routes
}
