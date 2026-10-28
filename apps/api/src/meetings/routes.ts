import { Hono, type Context } from 'hono'
import {
  CreateMeetingSchema,
  UpdateMeetingSchema,
  ReplaceMeetingAttendeesSchema,
  CancelMeetingSchema,
  MeetingListQuerySchema,
  MeetingOptionsQuerySchema,
  type MeetingResponse,
} from '@vada/contracts'
import {
  authorize,
  councilIdOf,
  inCouncilChange,
  recordIdOf,
  type AccessRequest,
} from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { createRateLimiter, type RateLimiter } from '../http/rate-limit.js'
import { parseQuery } from '../http/query.js'
import { json } from '../http/validate.js'
import { meetingOptionsOf } from './options.js'
import { meetingDetailOf, meetingListOf } from './queries.js'
import { createMeeting, updateMeeting, replaceMeetingAttendees, cancelMeeting } from './service.js'
import { addMinutesWrites } from './minutes-routes.js'

const root = '/organizations/:councilId/meetings'
const CREATED = 201
const WRITE_LIMIT = { limit: 20, windowMs: 10_000 }
const snapshot = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const
type Asked = (c: Context<SessionEnv>) => AccessRequest
type Routes = Hono<SessionEnv>
type Auth = ReturnType<typeof requireSession>
const idOf = (c: Context<SessionEnv>) => recordIdOf(c.req.param('meetingId'))

function addReads(routes: Routes, db: Db, auth: Auth, asked: Asked) {
  routes.get(root, auth, async c => {
    const request = asked(c)
    const query = parseQuery(MeetingListQuerySchema, c.req.queries())
    const list = await db.transaction(
      async tx => meetingListOf(tx, await authorize(tx, request), query, request.now),
      snapshot,
    )
    c.header('Cache-Control', 'private, no-store')
    return c.json(list)
  })
  routes.get(`${root}/options`, auth, async c => {
    const request = asked(c)
    const query = parseQuery(MeetingOptionsQuerySchema, c.req.queries())
    const options = await db.transaction(
      async tx => meetingOptionsOf(tx, await authorize(tx, request), query),
      snapshot,
    )
    c.header('Cache-Control', 'private, no-store')
    return c.json(options)
  })
  routes.get(`${root}/:meetingId`, auth, async c => {
    const request = asked(c)
    const meeting = await db.transaction(
      async tx => meetingDetailOf(tx, await authorize(tx, request), idOf(c), request.now),
      snapshot,
    )
    c.header('Cache-Control', 'private, no-store')
    return c.json({ meeting } satisfies MeetingResponse)
  })
}

function addWrites(routes: Routes, db: Db, auth: Auth, asked: Asked) {
  routes.post(root, json(CreateMeetingSchema), auth, async c => {
    const request = asked(c)
    const input = c.req.valid('json')
    const meeting = await inCouncilChange(db, request, (tx, actor) =>
      createMeeting(tx, actor, input, request.now),
    )
    return c.json({ meeting } satisfies MeetingResponse, CREATED)
  })
  routes.post(`${root}/:meetingId`, json(UpdateMeetingSchema), auth, async c => {
    const request = asked(c)
    const input = c.req.valid('json')
    const meeting = await inCouncilChange(db, request, (tx, actor) =>
      updateMeeting(tx, actor, { id: idOf(c), now: request.now }, input),
    )
    return c.json({ meeting } satisfies MeetingResponse)
  })
  routes.post(
    `${root}/:meetingId/attendees`,
    json(ReplaceMeetingAttendeesSchema),
    auth,
    async c => {
      const request = asked(c)
      const input = c.req.valid('json')
      const meeting = await inCouncilChange(db, request, (tx, actor) =>
        replaceMeetingAttendees(tx, actor, { id: idOf(c), now: request.now }, input),
      )
      return c.json({ meeting } satisfies MeetingResponse)
    },
  )
  routes.post(`${root}/:meetingId/cancel`, json(CancelMeetingSchema), auth, async c => {
    const request = asked(c)
    const input = c.req.valid('json')
    const meeting = await inCouncilChange(db, request, (tx, actor) =>
      cancelMeeting(tx, actor, { id: idOf(c), now: request.now }, input),
    )
    return c.json({ meeting } satisfies MeetingResponse)
  })
}

export function createMeetingRoutes(
  db: Db,
  getSession: SessionReader,
  options: { clock?: () => Date; writeLimiter?: RateLimiter; notesLimiter?: RateLimiter } = {},
) {
  const clock = options.clock ?? (() => new Date())
  const limiter = options.writeLimiter ?? createRateLimiter(WRITE_LIMIT)
  const notesLimiter = options.notesLimiter ?? createRateLimiter(WRITE_LIMIT)
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)
  const asked: Asked = c => {
    const now = clock()
    const writeLimiter = /\/agenda\/[^/]+$/.test(c.req.path) ? notesLimiter : limiter
    if (c.req.method === 'POST' && !writeLimiter.take(c.get('userId'), now))
      throw new ApiError('TOO_MANY_REQUESTS')
    return {
      userId: c.get('userId'),
      councilId: councilIdOf(c.req.param('councilId')),
      action: 'council.view',
      now,
    }
  }
  addReads(routes, db, auth, asked)
  addWrites(routes, db, auth, asked)
  addMinutesWrites(routes, { db, auth, asked })
  return routes
}
