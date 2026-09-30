import { createMiddleware } from 'hono/factory'

export type SessionReader = (headers: Headers) => Promise<{ user: { id: string } } | null>
export type SessionEnv = { Variables: { userId: string } }

export function requireSession(getSession: SessionReader) {
  return createMiddleware<SessionEnv>(async (c, next) => {
    c.header('Cache-Control', 'no-store')
    const session = await getSession(c.req.raw.headers)
    if (!session) return c.json({ error: 'UNAUTHENTICATED' }, 401)
    c.set('userId', session.user.id)
    await next()
  })
}
