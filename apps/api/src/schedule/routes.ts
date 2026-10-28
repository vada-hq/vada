import { Hono, type Context } from 'hono'
import {
  CreateScheduleItemSchema,
  UpdateScheduleItemSchema,
  DeleteScheduleItemSchema,
  type ScheduleItemResponse,
} from '@vada/contracts'
import { authorize, councilIdOf, inCouncilChange, recordIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { createRateLimiter, type RateLimiter } from '../http/rate-limit.js'
import { json } from '../http/validate.js'
import { scheduleDetailOf } from './queries.js'
import { createScheduleItem, updateScheduleItem, deleteScheduleItem } from './service.js'

const root = '/organizations/:councilId/schedule'
const CREATED = 201
const SCHEDULE_WRITE_LIMIT = { limit: 20, windowMs: 10_000 }
const snapshot = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const
const itemIdOf = (c: Context<SessionEnv>) => recordIdOf(c.req.param('itemId'))

export function createScheduleRoutes(
  db: Db,
  getSession: SessionReader,
  options: { clock?: () => Date; writeLimiter?: RateLimiter } = {},
) {
  const clock = options.clock ?? (() => new Date())
  const limiter = options.writeLimiter ?? createRateLimiter(SCHEDULE_WRITE_LIMIT)
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)
  const asked = (c: Context<SessionEnv>) => ({
    userId: c.get('userId'),
    councilId: councilIdOf(c.req.param('councilId')),
    action: 'council.view' as const,
    now: clock(),
  })
  routes.get(`${root}/:itemId`, auth, async c => {
    const request = asked(c)
    const item = await db.transaction(
      async tx => scheduleDetailOf(tx, await authorize(tx, request), itemIdOf(c), request.now),
      snapshot,
    )
    return c.json({ item } satisfies ScheduleItemResponse)
  })
  routes.post(root, json(CreateScheduleItemSchema), auth, async c => {
    if (!limiter.take(c.get('userId'), clock())) throw new ApiError('TOO_MANY_REQUESTS')
    const request = asked(c)
    const input = c.req.valid('json')
    const item = await inCouncilChange(db, request, (tx, actor) =>
      createScheduleItem(tx, actor, input, request.now),
    )
    return c.json({ item } satisfies ScheduleItemResponse, CREATED)
  })
  routes.post(`${root}/:itemId`, json(UpdateScheduleItemSchema), auth, async c => {
    const request = asked(c)
    const input = c.req.valid('json')
    const item = await inCouncilChange(db, request, (tx, actor) =>
      updateScheduleItem(tx, actor, { id: itemIdOf(c), now: request.now }, input),
    )
    return c.json({ item } satisfies ScheduleItemResponse)
  })
  routes.post(`${root}/:itemId/delete`, json(DeleteScheduleItemSchema), auth, async c => {
    await inCouncilChange(db, asked(c), (tx, actor) => deleteScheduleItem(tx, actor, itemIdOf(c)))
    return c.json({ ok: true })
  })
  return routes
}
