import { createMiddleware } from 'hono/factory'
import { errorResponse } from '../http/errors.js'

// 세션을 만든 시각은 되돌릴 수 없는 일(탈퇴)이 다시 로그인을 요구할 때만 본다. better-auth의 getSession이 함께 준다.
// 시험·흐름 세션처럼 없으면 그 일은 다시 로그인하라고 막는다(기본 거부).
export type SessionReader = (
  headers: Headers,
) => Promise<{ user: { id: string }; session?: { createdAt: Date } } | null>
export type SessionEnv = { Variables: { userId: string } }

export function requireSession(getSession: SessionReader) {
  return createMiddleware<SessionEnv>(async (c, next) => {
    c.header('Cache-Control', 'no-store')
    const session = await getSession(c.req.raw.headers)
    if (!session) return errorResponse(c, 'UNAUTHENTICATED')
    c.set('userId', session.user.id)
    await next()
  })
}
