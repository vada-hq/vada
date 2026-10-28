import { Hono } from 'hono'
import {
  EmptyRequestSchema,
  type CalendarFeedResponse,
  type CreatedCalendarFeedResponse,
} from '@vada/contracts'
import { authorize, councilIdOf, inCouncilChange } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import type { Db } from '../db/types.js'
import { CREATED } from '../http/status.js'
import { json } from '../http/validate.js'
import { deleteFeed, feedOf, replaceFeed, type FeedOptions } from './feed-service.js'

export { createPublicCalendarRoutes } from './feed-public.js'

export function createCalendarFeedRoutes(db: Db, getSession: SessionReader, options: FeedOptions) {
  const routes = new Hono<SessionEnv>()
  const clock = options.clock ?? (() => new Date())
  const base = '/organizations/:councilId/calendar/feed'
  routes.get(base, requireSession(getSession), async c => {
    const request = {
      userId: c.get('userId'),
      councilId: councilIdOf(c.req.param('councilId')),
      action: 'council.view' as const,
      now: clock(),
    }
    const result = await db.transaction(async tx => feedOf(tx, await authorize(tx, request)))
    return c.json(result satisfies CalendarFeedResponse)
  })
  routes.post(base, json(EmptyRequestSchema), requireSession(getSession), async c => {
    const now = clock()
    const result = await inCouncilChange(
      db,
      { userId: c.get('userId'), councilId: c.req.param('councilId'), action: 'council.view', now },
      (tx, actor) => replaceFeed(tx, actor, { now, trustedOrigin: options.trustedOrigin }),
    )
    return c.json(result satisfies CreatedCalendarFeedResponse, CREATED)
  })
  routes.post(`${base}/delete`, json(EmptyRequestSchema), requireSession(getSession), async c => {
    const result = await inCouncilChange(
      db,
      {
        userId: c.get('userId'),
        councilId: c.req.param('councilId'),
        action: 'council.view',
        now: clock(),
      },
      deleteFeed,
    )
    return c.json(result satisfies CalendarFeedResponse)
  })
  return routes
}
