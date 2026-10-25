import { Hono, type Context } from 'hono'
import {
  CreateEventSchema,
  UpdateEventSchema,
  type EventResponse,
  type EventsResponse,
  type SidebarEventsResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { authorize, councilIdOf, inCouncilChange, recordIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import type { ChatPush } from '../chat/notify.js'
import type { Db, Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { createRateLimiter, type RateLimiter } from '../http/rate-limit.js'
import { json } from '../http/validate.js'
import { eventDetailOf } from './detail.js'
import { eventListOf, sidebarEventsOf } from './queries.js'
import { createEvent, updateEvent, type EventWrite } from './service.js'

const root = '/organizations/:councilId/events'
const CREATED = 201

// 만들기는 계정마다 10초에 20번이다(업무와 같은 값).
const EVENT_WRITE_LIMIT = { limit: 20, windowMs: 10_000 }

// 읽기는 한 시점의 모습이다(업무와 같다).
const snapshot = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const

// 번호 형식은 운영진인지 본 뒤에 본다: 운영진이 아니면 대상이 있는지 드러내지 않고 403이다.
const eventIdOf = (c: Context<SessionEnv>) => recordIdOf(c.req.param('eventId'))

type WriteKit = {
  routes: Hono<SessionEnv>
  auth: ReturnType<typeof requireSession>
  writeLimiter: RateLimiter
  clock: () => Date
  db: Db
  push: Pick<ChatPush, 'notify'> | undefined
}

function addWriteRoutes({ routes, auth, writeLimiter, clock, db, push }: WriteKit) {
  // 공지방 끼룩이 글의 휴대폰 알림은 커밋 뒤에 떼어 보낸다. 응답은 기다리지 않고, notify는 던지지 않는다.
  const sent = ({ event, notice }: EventWrite) => {
    if (notice) void push?.notify(notice.id, clock(), { except: notice.by })
    return event
  }
  const changing = (c: Context<SessionEnv>) => ({
    userId: c.get('userId'),
    councilId: c.req.param('councilId'),
    action: 'council.view' as const,
    now: clock(),
  })
  routes.post(root, json(CreateEventSchema), auth, async c => {
    // 로그인한 사람만 세므로 인증 뒤에 둔다.
    if (!writeLimiter.take(c.get('userId'), clock())) throw new ApiError('TOO_MANY_REQUESTS')
    const input = c.req.valid('json')
    const asked = changing(c)
    const event = sent(
      await inCouncilChange(db, asked, (tx, actor) => createEvent(tx, actor, input, asked.now)),
    )
    return c.json({ event } satisfies EventResponse, CREATED)
  })
  routes.post(`${root}/:eventId`, json(UpdateEventSchema), auth, async c => {
    const input = c.req.valid('json')
    const asked = changing(c)
    const event = sent(
      await inCouncilChange(db, asked, (tx, actor) =>
        updateEvent(tx, actor, { eventId: eventIdOf(c), now: asked.now }, input),
      ),
    )
    return c.json({ event } satisfies EventResponse)
  })
}

// 행사: 모든 운영진이 본다(DEC-28 기준 1, PRIN-5). 만들기는 회장단과 부서장(DEC-93), 고치기는 회장단과 그 행사의 책임자다(DEC-79).
export function createEventRoutes(
  db: Db,
  getSession: SessionReader,
  options: {
    clock?: () => Date
    writeLimiter?: RateLimiter
    push?: Pick<ChatPush, 'notify'> | undefined
  } = {},
) {
  const clock = options.clock ?? (() => new Date())
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)
  const asked = (c: Context<SessionEnv>) => ({
    userId: c.get('userId'),
    councilId: councilIdOf(c.req.param('councilId')),
    action: 'council.view' as const,
    now: clock(),
  })
  // 운영진인지 본 뒤 한 시점의 모습으로 읽는다.
  const read = <T>(
    c: Context<SessionEnv>,
    body: (tx: Tx, actor: Actor, now: Date) => Promise<T>,
  ) => {
    const request = asked(c)
    return db.transaction(async tx => body(tx, await authorize(tx, request), request.now), snapshot)
  }
  routes.get(root, auth, async c => c.json((await read(c, eventListOf)) satisfies EventsResponse))
  // 옆 메뉴의 완료하지 않은 행사. 행사 번호 경로보다 먼저 둔다('open'은 행사 번호가 아니다).
  routes.get(`${root}/open`, auth, async c =>
    c.json((await read(c, sidebarEventsOf)) satisfies SidebarEventsResponse),
  )
  routes.get(`${root}/:eventId`, auth, async c => {
    const event = await read(c, (tx, actor, now) => eventDetailOf(tx, actor, eventIdOf(c), now))
    return c.json({ event } satisfies EventResponse)
  })
  addWriteRoutes({
    routes,
    auth,
    clock,
    db,
    push: options.push,
    writeLimiter: options.writeLimiter ?? createRateLimiter(EVENT_WRITE_LIMIT),
  })
  return routes
}
