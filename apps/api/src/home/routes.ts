import { Hono } from 'hono'
import type { HomeResponse } from '@vada/contracts'
import { authorize, councilIdOf } from '../access/authorize.js'
import { requireSession, type SessionEnv, type SessionReader } from '../auth/require-session.js'
import type { Db } from '../db/types.js'
import { homeOf } from './queries.js'

// 읽기는 한 시점의 모습이다. 권한 확인과 조회를 읽기 전용 REPEATABLE READ 거래 하나에서 한다(업무 읽기와 같다).
const snapshot = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const

// 홈: 모든 운영진이 원래 보는 것만 모아 준다(DEC-59). 바꾸는 경로는 없다.
export function createHomeRoutes(
  db: Db,
  getSession: SessionReader,
  options: { clock?: () => Date } = {},
) {
  const clock = options.clock ?? (() => new Date())
  const routes = new Hono<SessionEnv>()
  routes.get('/organizations/:councilId/home', requireSession(getSession), async c => {
    const request = {
      userId: c.get('userId'),
      councilId: councilIdOf(c.req.param('councilId')),
      action: 'council.view' as const,
    }
    // 응답의 서버 시각(asOf)은 그 거래 안에서 잡아, 한 시점의 모습과 같은 뜻이 되게 한다(DEC-95).
    const home = await db.transaction(async tx => {
      const now = clock()
      return homeOf(tx, await authorize(tx, { ...request, now }), now)
    }, snapshot)
    return c.json(home satisfies HomeResponse)
  })
  return routes
}
