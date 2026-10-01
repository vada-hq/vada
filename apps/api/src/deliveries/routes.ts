import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { createMiddleware } from 'hono/factory'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { requireMembership, type MembershipEnv } from '../access/membership.js'
import { createDeliveryService, type DeliveryDatabase } from './service.js'
import type { DeliveryProvider } from './provider.js'
import { DeliveryError, parseLookup, parseRegister, parseUnlink, text } from './validation.js'

export function createDeliveryRoutes(db: DeliveryDatabase, session: SessionReader, trustedOrigin: string, provider: DeliveryProvider) {
  const routes = new Hono<MembershipEnv>()
  const root = '/organizations/:organizationId'
  const service = createDeliveryService(db, provider)
  const auth = requireSession(session)
  const member = requireMembership(db)
  const finance = createMiddleware<MembershipEnv>(async (c, next) => {
    if (!c.get('membership').department.handlesFinance) return c.json({ error: 'FORBIDDEN' }, 403)
    await next()
  })
  const origin = new URL(trustedOrigin).origin
  const mutation = createMiddleware<MembershipEnv>(async (c, next) => {
    if (c.req.header('Origin') !== origin) return c.json({ error: 'FORBIDDEN' }, 403)
    if (c.req.header('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') return c.json({ error: 'UNSUPPORTED_MEDIA_TYPE' }, 415)
    await next()
  })
  const size = bodyLimit({ maxSize: 16384, onError: c => c.json({ error: 'BODY_TOO_LARGE' }, 413) })
  const body = async (req: { json: () => Promise<unknown> }) => {
    try { return await req.json() } catch { throw new DeliveryError('INVALID_INPUT') }
  }
  routes.onError((error, c) => error instanceof DeliveryError ? c.json({ error: error.code }, error.status) : c.json({ error: 'Internal server error' }, 500))
  routes.get(`${root}/delivery-carriers`, auth, member, finance, async c => {
    const after = c.req.query('after'), search = c.req.query('search')
    return c.json(await service.carriers(c.get('userId'), after === undefined ? undefined : text(after, 2000), search === undefined ? undefined : text(search, 100)))
  })
  routes.post(`${root}/delivery-lookups`, auth, member, finance, mutation, size, async c => c.json(await service.lookup(
    { userId: c.get('userId'), organizationId: c.req.param('organizationId') }, parseLookup(await body(c.req)),
  )))
  routes.post(`${root}/shipments`, auth, member, finance, mutation, size, async c => {
    const result = await service.register({ userId: c.get('userId'), organizationId: c.req.param('organizationId') }, parseRegister(await body(c.req)))
    return c.json(result, result.replayed ? 200 : 201)
  })
  routes.get(`${root}/events/:eventId/deliveries`, auth, member, async c => {
    const after = c.req.query('after')
    return c.json(await service.list({ userId: c.get('userId'), organizationId: c.req.param('organizationId') }, text(c.req.param('eventId')), after === undefined ? undefined : text(after)))
  })
  routes.post(`${root}/shipments/:shipmentId/unlink`, auth, member, finance, mutation, size, async c => c.json(await service.unlink(
    { userId: c.get('userId'), organizationId: c.req.param('organizationId') }, text(c.req.param('shipmentId')), parseUnlink(await body(c.req)).linkIds,
  )))
  return routes
}
