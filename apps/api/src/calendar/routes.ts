import { Hono } from 'hono'
import { CalendarQuerySchema, type CalendarResponse } from '@vada/contracts'
import { authorize, councilIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import type { Db } from '../db/types.js'
import { parseQuery } from '../http/query.js'
import { calendarOf } from './aggregate.js'
import { calendarRangeOf } from './range.js'

const snapshot = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const

export function createCalendarRoutes(
  db: Db,
  getSession: SessionReader,
  options: { clock?: () => Date } = {},
) {
  const clock = options.clock ?? (() => new Date())
  const routes = new Hono<SessionEnv>()
  routes.get('/organizations/:councilId/calendar', requireSession(getSession), async c => {
    const request = {
      userId: c.get('userId'),
      councilId: councilIdOf(c.req.param('councilId')),
      action: 'council.view' as const,
      now: clock(),
    }
    const result = await db.transaction(async tx => {
      const actor = await authorize(tx, request)
      const range = calendarRangeOf(parseQuery(CalendarQuerySchema, c.req.queries()))
      return calendarOf(tx, actor, range, request.now)
    }, snapshot)
    return c.json(result satisfies CalendarResponse)
  })
  return routes
}
