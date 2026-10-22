import { Hono, type Context } from 'hono'
import type { ClosingResponse, FiscalPeriodsResponse } from '@vada/contracts'
import { authorize, councilIdOf, recordIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import type { Db } from '../db/types.js'
import { closingOf, fiscalPeriodsOf } from './queries.js'

const root = '/organizations/:councilId/fiscal-periods'

// 읽기는 한 시점의 모습이다. 수입·지출 합과 점검이 서로 어긋나 보이지 않게 한다.
const snapshot = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const

// 번호 형식은 운영진인지 본 뒤에 본다: 운영진이 아니면 대상이 있는지 드러내지 않고 403이다.
const periodIdOf = (c: Context<SessionEnv>) => recordIdOf(c.req.param('periodId'))

// 회계 기간 목록과 결산서 읽기. 목록은 모든 운영진이, 결산서는 공개 전에는 재정부만 본다(DEC-28, DEC-63).
export function createClosingRoutes(
  db: Db,
  getSession: SessionReader,
  options: { clock?: () => Date } = {},
) {
  const clock = options.clock ?? (() => new Date())
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
      async tx => fiscalPeriodsOf(tx, await authorize(tx, request), request.now),
      snapshot,
    )
    return c.json(list satisfies FiscalPeriodsResponse)
  })
  routes.get(`${root}/:periodId/closing`, auth, async c => {
    const request = asked(c)
    const closing = await db.transaction(
      async tx => closingOf(tx, await authorize(tx, request), periodIdOf(c)),
      snapshot,
    )
    return c.json({ closing } satisfies ClosingResponse)
  })
  return routes
}
