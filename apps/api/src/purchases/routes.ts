import { Hono, type Context } from 'hono'
import {
  CancelLineItemSchema,
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
import type { RateLimiter } from '../http/rate-limit.js'
import { parseQuery } from '../http/query.js'
import { json } from '../http/validate.js'
import { cancelLineItem } from './cancel-item.js'
import { decideLineItems } from './decide.js'
import type { PurchasePush } from './notify.js'
import { requestDetailOf } from './queries.js'
import { requestListOf } from './list.js'
import { cancelPurchaseRequest, createPurchaseRequest } from './service.js'
import { createPurchaseWriteLimiter } from './write-limit.js'

const root = '/organizations/:councilId/purchase-requests'
const CREATED = 201

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

// 승인한 품목 취소(DEC-73): 재정부가 사유와 함께 한 품목을 취소한다.
function addCancelItemRoute({ routes, auth, clock, push, db }: WriteKit) {
  routes.post(
    `${root}/:requestId/items/:lineItemId/cancel`,
    json(CancelLineItemSchema),
    auth,
    async c => {
      const input = c.req.valid('json')
      const now = clock()
      const { request, notice } = await inCouncilChange(
        db,
        {
          userId: c.get('userId'),
          councilId: c.req.param('councilId'),
          action: 'council.view',
          now,
        },
        (tx, actor) =>
          cancelLineItem(
            tx,
            actor,
            { requestId: requestIdOf(c), lineItemId: recordIdOf(c.req.param('lineItemId')) },
            { input, now },
          ),
      )
      if (notice) void push?.notify(notice)
      return c.json({ request } satisfies PurchaseRequestResponse)
    },
  )
}

// 구매 요청: 모든 운영진이 읽고 낸다. 취소는 요청한 사람만이다(DEC-27, DEC-28).
export function createPurchaseRoutes(
  db: Db,
  getSession: SessionReader,
  options: { clock?: () => Date; writeLimiter?: RateLimiter; push?: PurchasePush | undefined } = {},
) {
  const clock = options.clock ?? (() => new Date())
  const writeLimiter = options.writeLimiter ?? createPurchaseWriteLimiter()
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
  const kit = { routes, auth, writeLimiter, clock, push: options.push, db }
  addWriteRoutes(kit)
  addCancelItemRoute(kit)
  return routes
}
