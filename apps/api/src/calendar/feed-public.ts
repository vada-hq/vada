import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { DAY_MS, koreanDateOf, statusOf } from '@vada/contracts'
import { actorOfMember } from '../access/actor.js'
import { calendarFeed, council } from '../db/schema.js'
import type { Db, Tx } from '../db/types.js'
import { createRateLimiter, type RateLimiter } from '../http/rate-limit.js'
import { NOT_MODIFIED } from '../http/status.js'
import { calendarOf } from './aggregate.js'
import { feedHash, type FeedOptions } from './feed-service.js'
import { createFeedRepresentation } from './feed-representation.js'
import { calendarRangeOf } from './range.js'

const FEED_FILE = /^[A-Za-z0-9_-]{43}\.ics$/
const EXTENSION_LENGTH = '.ics'.length
const PAST_DAYS = 60
const FUTURE_DAYS = 365
const READ_LIMIT = 30
const READ_WINDOW_MS = 600_000
const HEADERS = {
  'Content-Type': 'text/calendar; charset=utf-8',
  'Content-Disposition': 'inline; filename="vada.ics"',
  'Cache-Control': 'private, max-age=300',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
}

async function ownerOf(tx: Tx, hash: string, now: Date) {
  const [feed] = await tx
    .select({
      memberId: calendarFeed.memberId,
      councilId: calendarFeed.councilId,
      councilName: council.name,
    })
    .from(calendarFeed)
    .innerJoin(council, eq(council.id, calendarFeed.councilId))
    .where(eq(calendarFeed.tokenHash, hash))
  if (!feed) return null
  const actor = await actorOfMember(tx, feed.memberId, feed.councilId, now)
  if (!actor) {
    await tx
      .delete(calendarFeed)
      .where(and(eq(calendarFeed.tokenHash, hash), eq(calendarFeed.memberId, feed.memberId)))
    return null
  }
  return { actor, councilName: feed.councilName }
}

async function calendarForFeed(
  tx: Tx,
  hash: string,
  { now, limiter }: { now: Date; limiter: RateLimiter },
) {
  const owner = await ownerOf(tx, hash, now)
  if (!owner) return { kind: 'missing' } as const
  if (!limiter.take(hash, now)) return { kind: 'limited' } as const
  const range = calendarRangeOf({
    from: koreanDateOf(new Date(now.getTime() - PAST_DAYS * DAY_MS)),
    to: koreanDateOf(new Date(now.getTime() + FUTURE_DAYS * DAY_MS)),
  })
  const { items } = await calendarOf(tx, owner.actor, range, { now, feed: true })
  return {
    kind: 'ready',
    calendar: { items, councilId: owner.actor.councilId, councilName: owner.councilName },
  } as const
}

export function createPublicCalendarRoutes(db: Db, options: FeedOptions) {
  const routes = new Hono()
  const clock = options.clock ?? (() => new Date())
  const limiter = createRateLimiter({ limit: READ_LIMIT, windowMs: READ_WINDOW_MS })
  const representation = createFeedRepresentation()
  routes.get('/public/calendar/:file', async c => {
    for (const [name, value] of Object.entries(HEADERS)) c.header(name, value)
    const file = c.req.param('file')
    if (!FEED_FILE.test(file)) return c.body(null, statusOf('NOT_FOUND'))
    const hash = feedHash(file.slice(0, -EXTENSION_LENGTH))
    const now = clock()
    const result = await db.transaction(tx => calendarForFeed(tx, hash, { now, limiter }), {
      isolationLevel: 'repeatable read',
    })
    if (result.kind === 'missing') return c.body(null, statusOf('NOT_FOUND'))
    if (result.kind === 'limited') return c.body(null, statusOf('TOO_MANY_REQUESTS'))
    const { body, etag } = representation(hash, {
      ...result.calendar,
      origin: options.trustedOrigin,
      now,
    })
    c.header('ETag', etag)
    return c.req.header('If-None-Match') === etag ? c.body(null, NOT_MODIFIED) : c.body(body)
  })
  return routes
}
