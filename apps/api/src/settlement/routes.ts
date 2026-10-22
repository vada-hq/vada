import { Hono } from 'hono'
import type { SettlementResponse } from '@vada/contracts'
import { authorize, councilIdOf, recordIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import type { Db } from '../db/types.js'
import { settlementOf } from './queries.js'

// 읽기는 한 시점의 모습이다. 돈 합과 남은 것이 서로 어긋나 보이지 않게 한다.
const snapshot = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const

// 행사 정산 읽기: 모든 운영진이 본다(DEC-28 기준 1). 완료는 조각 4의 쓰기 경로다.
export function createSettlementRoutes(
  db: Db,
  getSession: SessionReader,
  options: { clock?: () => Date } = {},
) {
  const clock = options.clock ?? (() => new Date())
  const routes = new Hono<SessionEnv>()
  routes.get(
    '/organizations/:councilId/events/:eventId/settlement',
    requireSession(getSession),
    async c => {
      const request = {
        userId: c.get('userId'),
        councilId: councilIdOf(c.req.param('councilId')),
        action: 'council.view' as const,
        now: clock(),
      }
      // 번호 형식은 운영진인지 본 뒤에 본다: 운영진이 아니면 대상이 있는지 드러내지 않고 403이다.
      const settlement = await db.transaction(
        async tx =>
          settlementOf(tx, await authorize(tx, request), recordIdOf(c.req.param('eventId'))),
        snapshot,
      )
      return c.json({ settlement } satisfies SettlementResponse)
    },
  )
  return routes
}
