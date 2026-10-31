import { Hono, type Context } from 'hono'
import {
  CancelIncomeSchema,
  CreateIncomeSchema,
  IncomeListQuerySchema,
  type IncomeResponse,
  type IncomesResponse,
} from '@vada/contracts'
import { authorize, councilIdOf, inCouncilChange, recordIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import type { RateLimiter } from '../http/rate-limit.js'
import { parseQuery } from '../http/query.js'
import { json } from '../http/validate.js'
import { createPurchaseWriteLimiter } from '../purchases/write-limit.js'
import { incomeDetailOf, incomeListOf } from './queries.js'
import { cancelIncome, createIncome } from './service.js'

const root = '/organizations/:councilId/incomes'
const CREATED = 201

// 읽기는 한 시점의 모습이다(지출과 같다).
const snapshot = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const

const incomeIdOf = (c: Context<SessionEnv>) => recordIdOf(c.req.param('incomeId'))

// 읽기와 쓰기가 같은 권한 요청(운영진이면 된다)을 만든다. 재정부 확인은 서비스가 한다.
const askedBy = (clock: () => Date) => (c: Context<SessionEnv>) => ({
  userId: c.get('userId'),
  councilId: councilIdOf(c.req.param('councilId')),
  action: 'council.view' as const,
  now: clock(),
})

type WriteKit = {
  routes: Hono<SessionEnv>
  auth: ReturnType<typeof requireSession>
  writeLimiter: RateLimiter
  clock: () => Date
  db: Db
  receiptKey: string
}

function addWriteRoutes({ routes, auth, writeLimiter, clock, db, receiptKey }: WriteKit) {
  const asked = askedBy(clock)
  routes.post(root, json(CreateIncomeSchema), auth, async c => {
    // 요청 내기·지출 적기와 같은 한도다. 로그인한 사람만 세므로 인증 뒤에 둔다.
    if (!writeLimiter.take(c.get('userId'), clock())) throw new ApiError('TOO_MANY_REQUESTS')
    const input = c.req.valid('json')
    const request = asked(c)
    const detail = await inCouncilChange(db, request, (tx, actor) =>
      createIncome(tx, actor, input, { now: request.now, receiptKey }),
    )
    return c.json({ income: detail } satisfies IncomeResponse, CREATED)
  })
  routes.post(`${root}/:incomeId/cancel`, json(CancelIncomeSchema), auth, async c => {
    const { reason } = c.req.valid('json')
    const detail = await inCouncilChange(db, asked(c), (tx, actor) =>
      cancelIncome(tx, actor, incomeIdOf(c), reason),
    )
    return c.json({ income: detail } satisfies IncomeResponse)
  })
}

// 수입: 모든 운영진이 읽고(PRIN-5), 적고 취소하는 것은 재정부만이다(DEC-28, DEC-45).
export function createIncomeRoutes(
  db: Db,
  getSession: SessionReader,
  options: { clock?: () => Date; writeLimiter?: RateLimiter; receiptKey: string },
) {
  const clock = options.clock ?? (() => new Date())
  const writeLimiter = options.writeLimiter ?? createPurchaseWriteLimiter()
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)
  const asked = askedBy(clock)
  routes.get(root, auth, async c => {
    const request = asked(c)
    const query = parseQuery(IncomeListQuerySchema, c.req.queries())
    const list = await db.transaction(
      async tx => incomeListOf(tx, await authorize(tx, request), query),
      snapshot,
    )
    return c.json(list satisfies IncomesResponse)
  })
  routes.get(`${root}/:incomeId`, auth, async c => {
    const request = asked(c)
    const incomeId = incomeIdOf(c)
    const detail = await db.transaction(
      async tx => incomeDetailOf(tx, await authorize(tx, request), incomeId),
      snapshot,
    )
    return c.json({ income: detail } satisfies IncomeResponse)
  })
  addWriteRoutes({ routes, auth, writeLimiter, clock, db, receiptKey: options.receiptKey })
  return routes
}
