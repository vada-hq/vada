import { Hono } from 'hono'
import {
  CancelDepositSchema,
  ConfirmDepositSchema,
  RefundSchema,
  type ApplicantDeposit,
  type StaffDepositResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { inCouncilChange } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import type { Db, Tx } from '../db/types.js'
import { createRateLimiter, type RateLimiter } from '../http/rate-limit.js'
import { json } from '../http/validate.js'
import {
  kitHelpers,
  REGISTRATION_WRITE_LIMIT,
  registrationIdOf,
  root,
} from '../registrations/route-kit.js'
import { applicantChangeOf } from '../registrations/staff-registration.js'
import { cancelDeposit, confirmDeposit, refundDeposit } from './service.js'

const CREATED = 201

// 쓰기를 한 같은 거래에서 그 줄의 새 모습(actions 포함)을 세어 함께 돌려준다.
async function withChange(
  tx: Tx,
  actor: Actor,
  registrationId: string,
  write: () => Promise<ApplicantDeposit>,
): Promise<StaffDepositResponse> {
  const deposit = await write()
  return { deposit, applicant: await applicantChangeOf(tx, actor, registrationId) }
}

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
    const body = await inCouncilChange(db, changing(c), (tx, actor) =>
      withChange(tx, actor, registrationIdOf(c), () =>
        confirmDeposit(tx, actor, registrationIdOf(c), input),
      ),
    )
    return c.json(body, CREATED)
  })
  routes.post(`${base}/deposit/cancel`, json(CancelDepositSchema), auth, async c => {
    limited(c)
    const input = c.req.valid('json')
    const body = await inCouncilChange(db, changing(c), (tx, actor) =>
      withChange(tx, actor, registrationIdOf(c), () =>
        cancelDeposit(tx, actor, registrationIdOf(c), input),
      ),
    )
    return c.json(body)
  })
  routes.post(`${base}/refund`, json(RefundSchema), auth, async c => {
    limited(c)
    const input = c.req.valid('json')
    const body = await inCouncilChange(db, changing(c), (tx, actor) =>
      withChange(tx, actor, registrationIdOf(c), () =>
        refundDeposit(tx, actor, registrationIdOf(c), input),
      ),
    )
    return c.json(body)
  })
  return routes
}
