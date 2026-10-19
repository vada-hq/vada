import { Hono } from 'hono'
import type { HealthResponse } from '@vada/contracts'
import type { createCouncilRoutes } from './councils/routes.js'
import type { createPushRoutes } from './push/routes.js'
import { handleError } from './http/on-error.js'
import { limitBody, mutationGuard } from './http/guard.js'

type AuthHandler = { handler: (request: Request) => Promise<Response> }
export type AppOptions = {
  auth: AuthHandler
  trustedOrigin: string
  // 학생회: 내 학생회 목록, 만들기, 보기, 설정, 기수
  councils?: ReturnType<typeof createCouncilRoutes>
  // 휴대폰 알림. 알림 열쇠(VAPID)가 없으면 만들지 않는다.
  push?: ReturnType<typeof createPushRoutes>
}

export function createApp({ auth, trustedOrigin, councils, push }: AppOptions) {
  const app = new Hono()
  app.use('/api/organizations/*', mutationGuard(trustedOrigin))
  // 로그인한 사람 자신의 것(휴대폰 알림)도 같은 가드를 건다.
  app.use('/api/me/*', mutationGuard(trustedOrigin))
  // 로그인 없이 쓰는 공개 경로(참가 신청)도 같은 화면에서만 보내므로 같은 가드를 건다.
  app.use('/api/public/*', mutationGuard(trustedOrigin))
  app.get('/api/health', (c) => c.json({ status: 'ok' } satisfies HealthResponse))
  // better-auth는 출처 검사 전에 본문 전체를 읽으므로 크기만 먼저 제한한다.
  app.use('/api/auth/*', limitBody())
  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))
  if (councils) app.route('/api', councils)
  if (push) app.route('/api', push)
  app.onError(handleError)
  return app
}
