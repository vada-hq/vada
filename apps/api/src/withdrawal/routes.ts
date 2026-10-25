import { Hono } from 'hono'
import { EmptyRequestSchema, type WithdrawalResponse } from '@vada/contracts'
import type { SessionEnv, SessionReader } from '../auth/require-session.js'
import { ApiError, errorResponse } from '../http/errors.js'
import { json } from '../http/validate.js'
import type { Db } from '../db/types.js'
import { expireLoginCookies, isFreshSession } from './fresh-session.js'
import { withdrawAccount } from './service.js'

// 탈퇴(기능 021 정한 것 5·6). better-auth의 user.deleteUser는 꺼 둔 채로 둔다: 그 길은 소속·판 비우기와 한 거래로 묶이지 않는다.
// 로그인한 지 24시간이 넘었으면 다시 로그인하게 한다. 끝나면 세션 줄이 없어 그 쿠키는 401이고, 응답은 로그인 쿠키를 지운다.
export function createWithdrawalRoutes(db: Db, getSession: SessionReader, clock: () => Date) {
  // 다른 모듈과 같은 환경 타입이다(createApp이 한 타입으로 붙인다). 로그인 확인은 아래에서 직접 해 userId 변수는 쓰지 않는다.
  const routes = new Hono<SessionEnv>()
  routes.post('/me/withdrawal', json(EmptyRequestSchema), async c => {
    c.header('Cache-Control', 'no-store')
    const now = clock()
    const session = await getSession(c.req.raw.headers)
    if (!session) return errorResponse(c, 'UNAUTHENTICATED')
    if (!isFreshSession(session.session, now)) throw new ApiError('REAUTH_REQUIRED')
    await db.transaction(tx => withdrawAccount(tx, session.user.id, now))
    expireLoginCookies(c)
    return c.json({ withdrawn: true } satisfies WithdrawalResponse)
  })
  return routes
}
