import { Hono, type Context } from 'hono'
import {
  CloseAccountSchema,
  CreateAccountSchema,
  UpdateAccountSchema,
  type AccountResponse,
  type AccountsResponse,
} from '@vada/contracts'
import { authorize, councilIdOf, inCouncilChange, recordIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { createRateLimiter, type RateLimiter } from '../http/rate-limit.js'
import { json } from '../http/validate.js'
import { accountListOf } from './queries.js'
import { closeAccount, createAccount, updateAccount } from './service.js'

const root = '/organizations/:councilId/accounts'
const CREATED = 201

// 만들기는 계정마다 10초에 20번이다(행사와 같은 값).
const ACCOUNT_WRITE_LIMIT = { limit: 20, windowMs: 10_000 }

// 읽기는 한 시점의 모습이다(행사와 같다).
const snapshot = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const

// 번호 형식은 운영진인지 본 뒤에 본다: 운영진이 아니면 대상이 있는지 드러내지 않고 403이다.
const accountIdOf = (c: Context<SessionEnv>) => recordIdOf(c.req.param('accountId'))

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
  routes.post(root, json(CreateAccountSchema), auth, async c => {
    // 로그인한 사람만 세므로 인증 뒤에 둔다.
    if (!writeLimiter.take(c.get('userId'), clock())) throw new ApiError('TOO_MANY_REQUESTS')
    const input = c.req.valid('json')
    const account = await inCouncilChange(db, changing(c), (tx, actor) =>
      createAccount(tx, actor, input),
    )
    return c.json({ account } satisfies AccountResponse, CREATED)
  })
  routes.post(`${root}/:accountId`, json(UpdateAccountSchema), auth, async c => {
    const input = c.req.valid('json')
    const account = await inCouncilChange(db, changing(c), (tx, actor) =>
      updateAccount(tx, actor, accountIdOf(c), input),
    )
    return c.json({ account } satisfies AccountResponse)
  })
  routes.post(`${root}/:accountId/close`, json(CloseAccountSchema), auth, async c => {
    const asked = changing(c)
    const account = await inCouncilChange(db, asked, (tx, actor) =>
      closeAccount(tx, actor, { accountId: accountIdOf(c), now: asked.now }),
    )
    return c.json({ account } satisfies AccountResponse)
  })
}

// 계좌: 모든 운영진이 본다(DEC-28 기준 1, PRIN-5). 만들기, 고치기, 닫기는 재정부만이다(finance.manage).
export function createAccountRoutes(
  db: Db,
  getSession: SessionReader,
  options: { clock?: () => Date; writeLimiter?: RateLimiter } = {},
) {
  const clock = options.clock ?? (() => new Date())
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)
  routes.get(root, auth, async c => {
    const request = {
      userId: c.get('userId'),
      councilId: councilIdOf(c.req.param('councilId')),
      action: 'council.view' as const,
      now: clock(),
    }
    const list = await db.transaction(
      async tx => accountListOf(tx, await authorize(tx, request)),
      snapshot,
    )
    return c.json(list satisfies AccountsResponse)
  })
  addWriteRoutes({
    routes,
    auth,
    clock,
    db,
    writeLimiter: options.writeLimiter ?? createRateLimiter(ACCOUNT_WRITE_LIMIT),
  })
  return routes
}
