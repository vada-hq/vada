import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { and, desc, eq, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type { MessageResponse, MessagesResponse, MessageSummary } from '@vada/contracts'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { requireMembership, type MembershipEnv } from '../access/membership.js'
import { chatRooms, events, memberships, messages, users } from '../db/schema.js'

type ChatEnv = { Variables: MembershipEnv['Variables'] & { chatRoomId: string } }
const messageFields = {
  id: messages.id, chatRoomId: messages.chatRoomId, content: messages.content,
  createdAt: messages.createdAt, author: { id: users.id, name: users.name },
}
type MessageRow = Omit<MessageSummary, 'createdAt'> & { createdAt: Date }
const serialize = (row: MessageRow): MessageSummary => ({ ...row, createdAt: row.createdAt.toISOString() })

export function createChatRoutes(
  db: Pick<PgDatabase<PgQueryResultHKT>, 'select' | 'transaction'>,
  getSession: SessionReader,
  trustedOrigin: string,
) {
  const routes = new Hono<ChatEnv>()
  const path = '/organizations/:organizationId/events/:eventId/messages'
  const origin = new URL(trustedOrigin).origin
  const authenticated = requireSession(getSession)
  const member = requireMembership(db)
  const room = createMiddleware<ChatEnv>(async (c, next) => {
    const [found] = await db.select({ id: chatRooms.id }).from(chatRooms)
      .innerJoin(events, and(eq(events.id, chatRooms.eventId), eq(events.organizationId, chatRooms.organizationId)))
      .where(and(eq(events.id, c.req.param('eventId')!), eq(events.organizationId, c.req.param('organizationId')!)))
    // 다른 학생회 행사와 존재하지 않는 행사는 구분하지 않는다.
    if (!found) return c.json({ error: 'NOT_FOUND' }, 404)
    c.set('chatRoomId', found.id)
    await next()
  })

  routes.get(path, authenticated, member, room, async c => {
    const roomId = c.get('chatRoomId')
    const before = c.req.query('before')
    if (before !== undefined) {
      if (!before || before.length > 200 || /[\u0000\uD800-\uDFFF]/u.test(before)) return c.json({ error: 'INVALID_CURSOR' }, 400)
      const [anchor] = await db.select({ id: messages.id }).from(messages)
        .where(and(eq(messages.chatRoomId, roomId), eq(messages.id, before))).limit(1)
      if (!anchor) return c.json({ error: 'INVALID_CURSOR' }, 400)
    }
    // DB의 마이크로초 정밀도를 유지한다. JS Date로 변환한 시각을 커서 비교에 쓰지 않는다.
    const older = before === undefined ? undefined : sql`(${messages.createdAt}, ${messages.id}) < (
      SELECT created_at, id FROM messages WHERE id = ${before} AND chat_room_id = ${roomId}
    )`
    const rows = await db.select(messageFields).from(messages)
      .innerJoin(users, eq(users.id, messages.authorId))
      .where(and(eq(messages.chatRoomId, roomId), older))
      .orderBy(desc(messages.createdAt), desc(messages.id)).limit(51)
    const page = rows.slice(0, 50)
    const nextCursor = rows.length > 50 ? page[page.length - 1]!.id : null
    return c.json({ messages: page.reverse().map(serialize), nextCursor } satisfies MessagesResponse)
  })

  routes.post(path, authenticated, member, room, async c => {
    if (c.req.header('Origin') !== origin) return c.json({ error: 'FORBIDDEN' }, 403)
    if (c.req.header('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
      return c.json({ error: 'UNSUPPORTED_MEDIA_TYPE' }, 415)
    }
    let body: unknown
    try { body = await c.req.json() } catch { return c.json({ error: 'INVALID_INPUT' }, 400) }
    if (!body || typeof body !== 'object' || !('content' in body) || typeof body.content !== 'string') {
      return c.json({ error: 'INVALID_INPUT' }, 400)
    }
    const content = body.content.trim()
    // PostgreSQL char_length와 동일하게 유니코드 코드 포인트를 센다.
    if (!content || [...content].length > 2000 || /[\u0000\uD800-\uDFFF]/u.test(content)) {
      return c.json({ error: 'INVALID_INPUT' }, 400)
    }
    const saved = await db.transaction(async tx => {
      // 저장 시점에도 소속·행사·방을 함께 검사한다. 요청 본문의 작성자/방/시각은 무시한다.
      const [created] = await tx.insert(messages).select(
        tx.select({
          id: sql<string>`${randomUUID()}`.as('id'),
          chatRoomId: chatRooms.id,
          authorId: memberships.userId,
          content: sql<string>`${content}`.as('content'),
          createdAt: sql<Date>`now()`.as('created_at'),
        }).from(chatRooms)
          .innerJoin(events, and(eq(events.id, chatRooms.eventId), eq(events.organizationId, chatRooms.organizationId)))
          .innerJoin(memberships, and(eq(memberships.organizationId, chatRooms.organizationId), eq(memberships.userId, c.get('userId'))))
          .where(and(eq(chatRooms.id, c.get('chatRoomId')), eq(events.id, c.req.param('eventId')), eq(events.organizationId, c.req.param('organizationId')))),
      ).returning({ id: messages.id })
      if (!created) return undefined
      const [row] = await tx.select(messageFields).from(messages).innerJoin(users, eq(users.id, messages.authorId))
        .where(eq(messages.id, created.id))
      return row
    })
    if (!saved) return c.json({ error: 'FORBIDDEN' }, 403)
    return c.json({ message: serialize(saved) } satisfies MessageResponse, 201)
  })
  return routes
}
