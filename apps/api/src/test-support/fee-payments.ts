import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { createFeePaymentRoutes } from '../fee-payments/routes.js'
import type { RateLimiter } from '../http/rate-limit.js'
import { seedCouncil } from './council.js'
import { caller, ORIGIN, testSession } from './http.js'

// 학생회 둘(우리, 다른)과 납부자 명단 라우트를 띄운다.
export async function startFeePayments(options: { writeLimiter?: RateLimiter } = {}) {
  const { pg, db, close } = await createTestDb()
  const council = await seedCouncil(db, pg)
  const other = await seedCouncil(db, pg, 'o')
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      feePayments: createFeePaymentRoutes(db, testSession, options),
    }),
  )
  const base = `/api/organizations/${council.councilId}/fee-payments`
  const upload = (body: unknown, user = 's-financeMember', path = base) =>
    api.post(path, body, user)
  const count = async (sql: string, params: unknown[] = []) =>
    Number(((await pg.query(sql, params)).rows[0] as { n: string }).n)
  return { pg, db, council, other, api, base, upload, count, close }
}

export type FeePaymentKit = Awaited<ReturnType<typeof startFeePayments>>

export const withFeePayments = (body: (t: FeePaymentKit) => Promise<void>) => async () => {
  const t = await startFeePayments()
  try {
    await body(t)
  } finally {
    await t.close()
  }
}
