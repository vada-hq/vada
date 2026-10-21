import { Hono, type Context } from 'hono'
import {
  CancelPurchaseRequestSchema,
  CreatePurchaseRequestSchema,
  DecideLineItemsSchema,
  NO_CONTENT,
  PurchaseRequestListQuerySchema,
  type PurchaseRequestResponse,
  type PurchaseRequestsResponse,
} from '@vada/contracts'
import { authorize, councilIdOf, inCouncilChange, recordIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { createRateLimiter, type RateLimiter } from '../http/rate-limit.js'
import { parseQuery } from '../http/query.js'
import { json } from '../http/validate.js'
import { decideLineItems } from './decide.js'
import type { PurchasePush } from './notify.js'
import { requestDetailOf, requestListOf } from './queries.js'
import { cancelPurchaseRequest, createPurchaseRequest } from './service.js'

const root = '/organizations/:councilId/purchase-requests'
const CREATED = 201

// 요청 내기는 계정마다 10초에 20번이다(기능 003 보내기와 같은 값). 지출 적기(조각 4)와 한도를 같이 쓴다.
const PURCHASE_WRITE_LIMIT = { limit: 20, windowMs: 10_000 }

// 읽기는 한 시점의 모습이다. 권한 확인과 조회를 읽기 전용 REPEATABLE READ 거래 하나에서 한다(업무와 같다).
const snapshot = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const

const requestIdOf = (c: Context<SessionEnv>) => recordIdOf(c.req.param('requestId'))

type WriteKit = {
  routes: Hono<SessionEnv>
  auth: ReturnType<typeof requireSession>
  writeLimiter: RateLimiter
  clock: () => Date
  push: PurchasePush | undefined
  db: Db
}

function addWriteRoutes({ routes, auth, writeLimiter, clock, push, db }: WriteKit) {
  routes.post(root, json(CreatePurchaseRequestSchema), auth, async c => {
    // 계정마다 센다. 로그인한 사람만 세므로 인증 뒤에 둔다.
    if (!writeLimiter.take(c.get('userId'), clock())) throw new ApiError('TOO_MANY_REQUESTS')
    const input = c.req.valid('json')
    const now = clock()
    const { request, notice } = await inCouncilChange(
      db,
      { userId: c.get('userId'), councilId: c.req.param('councilId'), action: 'council.view', now },
      (tx, actor) => createPurchaseRequest(tx, actor, input, now),
    )
    // 알림은 커밋 뒤에 떼어 보낸다. 응답은 기다리지 않는다.
    if (notice) void push?.notify(notice)
    return c.json({ request } satisfies PurchaseRequestResponse, CREATED)
  })
  routes.post(`${root}/:requestId/cancel`, json(CancelPurchaseRequestSchema), auth, async c => {
    const now = clock()
    await inCouncilChange(
      db,
      { userId: c.get('userId'), councilId: c.req.param('councilId'), action: 'council.view', now },
      (tx, actor) => cancelPurchaseRequest(tx, actor, requestIdOf(c)),
    )
    return c.body(null, NO_CONTENT)
  })
  routes.post(`${root}/:requestId/decisions`, json(DecideLineItemsSchema), auth, async c => {
    const input = c.req.valid('json')
    const now = clock()
    const { request, notice } = await inCouncilChange(
      db,
      { userId: c.get('userId'), councilId: c.req.param('councilId'), action: 'council.view', now },
      (tx, actor) => decideLineItems(tx, actor, requestIdOf(c), { input, now }),
    )
    if (notice) void push?.notify(notice)
    return c.json({ request } satisfies PurchaseRequestResponse)
  })
}

// 구매 요청: 모든 운영진이 본다(DEC-27 기준 1, PRIN-5). 내는 것도 모든 운영진이고, 취소는 요청한 사람만이다.
export function createPurchaseRoutes(
  db: Db,
  getSession: SessionReader,
  options: { clock?: () => Date; writeLimiter?: RateLimiter; push?: PurchasePush | undefined } = {},
) {
  const clock = options.clock ?? (() => new Date())
  const writeLimiter = options.writeLimiter ?? createRateLimiter(PURCHASE_WRITE_LIMIT)
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)
  const asked = (c: Context<SessionEnv>) => ({
    userId: c.get('userId'),
    councilId: councilIdOf(c.req.param('councilId')),
    action: 'council.view' as const,
    now: clock(),
  })
  routes.get(root, auth, async c => {
    const request = asked(c)
    const query = parseQuery(PurchaseRequestListQuerySchema, c.req.queries())
    const list = await db.transaction(
      async tx => requestListOf(tx, await authorize(tx, request), query),
      snapshot,
    )
    return c.json(list satisfies PurchaseRequestsResponse)
  })
  routes.get(`${root}/:requestId`, auth, async c => {
    const request = asked(c)
    const requestId = requestIdOf(c)
    const detail = await db.transaction(
      async tx => requestDetailOf(tx, await authorize(tx, request), requestId),
      snapshot,
    )
    return c.json({ request: detail } satisfies PurchaseRequestResponse)
  })
  addWriteRoutes({ routes, auth, writeLimiter, clock, push: options.push, db })
  return routes
}
