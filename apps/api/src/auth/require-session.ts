import { createMiddleware } from 'hono/factory'
import { errorResponse } from '../http/errors.js'

export type SessionReader = (headers: Headers) => Promise<{ user: { id: string } } | null>
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
