import { Hono } from 'hono'
import {
  CancelDepositSchema,
  ConfirmDepositSchema,
  RefundSchema,
  type DepositResponse,
} from '@vada/contracts'
import { inCouncilChange } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import type { Db } from '../db/types.js'
import { createRateLimiter, type RateLimiter } from '../http/rate-limit.js'
import { json } from '../http/validate.js'
import {
  kitHelpers,
  REGISTRATION_WRITE_LIMIT,
  registrationIdOf,
  root,
} from '../registrations/route-kit.js'
import { cancelDeposit, confirmDeposit, refundDeposit } from './service.js'

const CREATED = 201

// 신청마다 입금 확인, 확인 취소, 환불함(기능 008). 007의 신청 경로와 같은 줄에 둔다. 신청자 정보를 담지 않아 열람 기록이 없다.
export function createDepositRoutes(
  db: Db,
  getSession: SessionReader,
  options: { clock?: () => Date; writeLimiter?: RateLimiter } = {},
) {
  const clock = options.clock ?? (() => new Date())
  const writeLimiter = options.writeLimiter ?? createRateLimiter(REGISTRATION_WRITE_LIMIT)
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)
  const { changing, limited } = kitHelpers({ writeLimiter, clock })
  const base = `${root}/registrations/:registrationId`
  routes.post(`${base}/deposit`, json(ConfirmDepositSchema), auth, async c => {
    limited(c)
    const input = c.req.valid('json')
    const deposit = await inCouncilChange(db, changing(c), (tx, actor) =>
      confirmDeposit(tx, actor, registrationIdOf(c), input),
    )
    return c.json({ deposit } satisfies DepositResponse, CREATED)
  })
  routes.post(`${base}/deposit/cancel`, json(CancelDepositSchema), auth, async c => {
    limited(c)
    const input = c.req.valid('json')
    const deposit = await inCouncilChange(db, changing(c), (tx, actor) =>
      cancelDeposit(tx, actor, registrationIdOf(c), input),
    )
    return c.json({ deposit } satisfies DepositResponse)
  })
  routes.post(`${base}/refund`, json(RefundSchema), auth, async c => {
    limited(c)
    const input = c.req.valid('json')
    const deposit = await inCouncilChange(db, changing(c), (tx, actor) =>
      refundDeposit(tx, actor, registrationIdOf(c), input),
    )
    return c.json({ deposit } satisfies DepositResponse)
  })
  return routes
}
