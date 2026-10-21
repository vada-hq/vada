import { Hono, type Context } from 'hono'
import {
  CancelExpenseSchema,
  CreateExpenseSchema,
  ReimburseExpenseSchema,
  type ExpenseResponse,
  type ExpensesResponse,
} from '@vada/contracts'
import { authorize, councilIdOf, inCouncilChange, recordIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import type { RateLimiter } from '../http/rate-limit.js'
import { json } from '../http/validate.js'
import { createPurchaseWriteLimiter } from '../purchases/write-limit.js'
import { expenseDetailOf, expenseListOf } from './queries.js'
import { cancelExpense, createExpense, reimburseExpense } from './service.js'

const root = '/organizations/:councilId/expenses'
const CREATED = 201

// 읽기는 한 시점의 모습이다(업무와 같다).
const snapshot = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const

const expenseIdOf = (c: Context<SessionEnv>) => recordIdOf(c.req.param('expenseId'))

type WriteKit = {
  routes: Hono<SessionEnv>
  auth: ReturnType<typeof requireSession>
  writeLimiter: RateLimiter
  clock: () => Date
  db: Db
}

function addWriteRoutes({ routes, auth, writeLimiter, clock, db }: WriteKit) {
  const changing = (c: Context<SessionEnv>) => ({
    userId: c.get('userId'),
    councilId: c.req.param('councilId'),
    action: 'council.view' as const,
    now: clock(),
  })
  routes.post(root, json(CreateExpenseSchema), auth, async c => {
    // 요청 내기와 같은 한도다. 로그인한 사람만 세므로 인증 뒤에 둔다.
    if (!writeLimiter.take(c.get('userId'), clock())) throw new ApiError('TOO_MANY_REQUESTS')
    const input = c.req.valid('json')
    const asked = changing(c)
    const detail = await inCouncilChange(db, asked, (tx, actor) =>
      createExpense(tx, actor, input, asked.now),
    )
    return c.json({ expense: detail } satisfies ExpenseResponse, CREATED)
  })
  routes.post(`${root}/:expenseId/cancel`, json(CancelExpenseSchema), auth, async c => {
    const { reason } = c.req.valid('json')
    const detail = await inCouncilChange(db, changing(c), (tx, actor) =>
      cancelExpense(tx, actor, expenseIdOf(c), reason),
    )
    return c.json({ expense: detail } satisfies ExpenseResponse)
  })
  routes.post(`${root}/:expenseId/reimburse`, json(ReimburseExpenseSchema), auth, async c => {
    const detail = await inCouncilChange(db, changing(c), (tx, actor) =>
      reimburseExpense(tx, actor, expenseIdOf(c)),
    )
    return c.json({ expense: detail } satisfies ExpenseResponse)
  })
}

// 지출: 모든 운영진이 읽고(PRIN-5), 적고 취소하고 환급 표시하는 것은 재정부만이다(DEC-28).
export function createExpenseRoutes(
  db: Db,
  getSession: SessionReader,
  options: { clock?: () => Date; writeLimiter?: RateLimiter } = {},
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
    const list = await db.transaction(
      async tx => expenseListOf(tx, await authorize(tx, request)),
      snapshot,
    )
    return c.json(list satisfies ExpensesResponse)
  })
  routes.get(`${root}/:expenseId`, auth, async c => {
    const request = asked(c)
    const expenseId = expenseIdOf(c)
    const detail = await db.transaction(
      async tx => expenseDetailOf(tx, await authorize(tx, request), expenseId),
      snapshot,
    )
    return c.json({ expense: detail } satisfies ExpenseResponse)
  })
  addWriteRoutes({ routes, auth, writeLimiter, clock, db })
  return routes
}
