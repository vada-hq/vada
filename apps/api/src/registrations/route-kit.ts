import type { Hono, Context } from 'hono'
import { recordIdOf } from '../access/authorize.js'
import type { SessionEnv, requireSession } from '../auth/require-session.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import type { RateLimiter } from '../http/rate-limit.js'

export const root = '/organizations/:councilId'

// 운영진 쓰기는 계정마다 10초에 20번이다(행사, 계좌와 같은 값).
export const REGISTRATION_WRITE_LIMIT = { limit: 20, windowMs: 10_000 }

// 번호 형식은 운영진인지 본 뒤에 본다: 운영진이 아니면 대상이 있는지 드러내지 않고 403이다.
export const eventIdOf = (c: Context<SessionEnv>) => recordIdOf(c.req.param('eventId'))
export const formIdOf = (c: Context<SessionEnv>) => recordIdOf(c.req.param('formId'))
export const registrationIdOf = (c: Context<SessionEnv>) =>
  recordIdOf(c.req.param('registrationId'))

// 신청 라우트 모듈들이 같이 쓰는 재료
export type RouteKit = {
  routes: Hono<SessionEnv>
  auth: ReturnType<typeof requireSession>
  writeLimiter: RateLimiter
  clock: () => Date
  db: Db
}

export function kitHelpers({ writeLimiter, clock }: Pick<RouteKit, 'writeLimiter' | 'clock'>) {
  return {
    changing: (c: Context<SessionEnv>) => ({
      userId: c.get('userId'),
      councilId: c.req.param('councilId'),
      action: 'council.view' as const,
      now: clock(),
    }),
    // 로그인한 사람만 세므로 인증 뒤에 둔다.
    limited: (c: Context<SessionEnv>) => {
      if (!writeLimiter.take(c.get('userId'), clock())) throw new ApiError('TOO_MANY_REQUESTS')
    },
  }
}
