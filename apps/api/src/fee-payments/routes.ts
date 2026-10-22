import { Hono, type Context } from 'hono'
import {
  AddFeePaymentsSchema,
  FeePaymentSearchSchema,
  RemoveFeePaymentSchema,
  statusOf,
  type AddFeePaymentsResponse,
  type FeePaymentsResponse,
  type InvalidFeePaymentsResponse,
} from '@vada/contracts'
import { authorize, councilIdOf, inCouncilChange, recordIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { createRateLimiter, type RateLimiter } from '../http/rate-limit.js'
import { json } from '../http/validate.js'
import { addFeePayments, feePaymentsOf, removeFeePayment } from './service.js'

const root = '/organizations/:councilId/fee-payments'
// 운영진 쓰기는 계정마다 10초에 20번이다(양식과 같다).
const FEE_PAYMENT_WRITE_LIMIT = { limit: 20, windowMs: 10_000 }
const snapshot = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const

// 형식이 틀리면 아무것도 쓰지 않았다(거래는 쓰기 없이 끝났다). 줄 번호를 알려 주고, 비었거나 너무 많으면 줄 없이 400이다.
function invalidResponseOf(
  result: Awaited<ReturnType<typeof addFeePayments>>,
): InvalidFeePaymentsResponse | undefined {
  if (!('kind' in result)) return undefined
  if (result.kind === 'unusable') throw new ApiError('INVALID_INPUT')
  return { error: 'INVALID_INPUT', lines: result.lines }
}

// 학생회비 납부자 명단(DEC-26, DEC-62): 올리기와 빼기는 재정부, 보기는 재정부와 회장단이다. 학번은 읽을 때 찾은 학번 하나만 나간다.
export function createFeePaymentRoutes(
  db: Db,
  getSession: SessionReader,
  options: { clock?: () => Date; writeLimiter?: RateLimiter } = {},
) {
  const clock = options.clock ?? (() => new Date())
  const writeLimiter = options.writeLimiter ?? createRateLimiter(FEE_PAYMENT_WRITE_LIMIT)
  const routes = new Hono<SessionEnv>()
  const auth = requireSession(getSession)
  const asked = (c: Context<SessionEnv>, action: 'fee_payment.view' | 'fee_payment.manage') => ({
    userId: c.get('userId'),
    councilId: c.req.param('councilId'),
    action,
    now: clock(),
  })
  const limited = (c: Context<SessionEnv>) => {
    if (!writeLimiter.take(c.get('userId'), clock())) throw new ApiError('TOO_MANY_REQUESTS')
  }
  routes.get(root, auth, async c => {
    const request = {
      ...asked(c, 'fee_payment.view'),
      councilId: councilIdOf(c.req.param('councilId')),
    }
    const query = FeePaymentSearchSchema.safeParse(c.req.query())
    const body = await db.transaction(async tx => {
      const actor = await authorize(tx, request)
      if (!query.success) throw new ApiError('INVALID_INPUT')
      return feePaymentsOf(tx, actor, query.data.studentId)
    }, snapshot)
    return c.json(body satisfies FeePaymentsResponse)
  })
  routes.post(root, json(AddFeePaymentsSchema), auth, async c => {
    limited(c)
    const input = c.req.valid('json')
    const result = await inCouncilChange(db, asked(c, 'fee_payment.manage'), (tx, actor) =>
      addFeePayments(tx, actor, input),
    )
    const invalid = invalidResponseOf(result)
    if (invalid) return c.json(invalid, statusOf('INVALID_INPUT'))
    return c.json(result as AddFeePaymentsResponse)
  })
  routes.post(`${root}/:paymentId/remove`, json(RemoveFeePaymentSchema), auth, async c => {
    limited(c)
    await inCouncilChange(db, asked(c, 'fee_payment.manage'), (tx, actor) =>
      removeFeePayment(tx, actor, recordIdOf(c.req.param('paymentId'))),
    )
    return c.json({ ok: true })
  })
  return routes
}
