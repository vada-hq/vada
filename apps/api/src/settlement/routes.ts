import { Hono, type Context } from 'hono'
import {
  CancelCompletionSchema,
  CompleteEventSchema,
  type EventResponse,
  type SettlementResponse,
} from '@vada/contracts'
import { authorize, councilIdOf, inCouncilChange, recordIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import type { Db } from '../db/types.js'
import { json } from '../http/validate.js'
import { cancelCompletion, completeEvent } from './complete.js'
import { settlementOf } from './queries.js'

const root = '/organizations/:councilId/events/:eventId'

// 읽기는 한 시점의 모습이다. 돈 합과 남은 것이 서로 어긋나 보이지 않게 한다.
const snapshot = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const

// 번호 형식은 운영진인지 본 뒤에 본다: 운영진이 아니면 대상이 있는지 드러내지 않고 403이다.
const eventIdOf = (c: Context<SessionEnv>) => recordIdOf(c.req.param('eventId'))

type WriteKit = {
  routes: Hono<SessionEnv>
  auth: ReturnType<typeof requireSession>
  clock: () => Date
  db: Db
}

function addWriteRoutes({ routes, auth, clock, db }: WriteKit) {
  const changing = (c: Context<SessionEnv>) => ({
    userId: c.get('userId'),
    councilId: c.req.param('councilId'),
    action: 'council.view' as const,
    now: clock(),
  })
  routes.post(`${root}/complete`, json(CompleteEventSchema), auth, async c => {
    const input = c.req.valid('json')
    const asked = changing(c)
    const event = await inCouncilChange(db, asked, (tx, actor) =>
      completeEvent(tx, actor, { eventId: eventIdOf(c), now: asked.now }, input),
    )
    return c.json({ event } satisfies EventResponse)
  })
  routes.post(`${root}/cancel-completion`, json(CancelCompletionSchema), auth, async c => {
    const input = c.req.valid('json')
    const asked = changing(c)
    const event = await inCouncilChange(db, asked, (tx, actor) =>
      cancelCompletion(tx, actor, { eventId: eventIdOf(c), now: asked.now }, input),
    )
    return c.json({ event } satisfies EventResponse)
  })
}

// 행사 정산: 읽기는 모든 운영진이 본다(DEC-28 기준 1). 완료와 완료 취소는 회장단만 한다(event.complete).
export function createSettlementRoutes(
  db: Db,
  getSession: SessionReader,
  options: { clock?: () => Date } = {},
) {
  const clock = options.clock ?? (() => new Date())
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)
  routes.get(`${root}/settlement`, auth, async c => {
    const request = {
      userId: c.get('userId'),
      councilId: councilIdOf(c.req.param('councilId')),
      action: 'council.view' as const,
      now: clock(),
    }
    const settlement = await db.transaction(
      async tx => settlementOf(tx, await authorize(tx, request), eventIdOf(c)),
      snapshot,
    )
    return c.json({ settlement } satisfies SettlementResponse)
  })
  addWriteRoutes({ routes, auth, clock, db })
  return routes
}
