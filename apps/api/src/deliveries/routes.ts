import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { requireMembership, type MembershipEnv } from '../access/membership.js'
import { createDeliveryService, type DeliveryDatabase } from './service.js'
import type { DeliveryProvider } from './provider.js'
import { DeliveryLookupSchema, RegisterShipmentSchema, UnlinkShipmentSchema } from '@vada/contracts'
import { json } from '../http/validate.js'
import { text } from './validation.js'

export function createDeliveryRoutes(db: DeliveryDatabase, session: SessionReader, provider: DeliveryProvider) {
  const routes = new Hono<MembershipEnv>()
  const root = '/organizations/:organizationId'
  const service = createDeliveryService(db, provider)
  const auth = requireSession(session)
  const member = requireMembership(db)
  const finance = createMiddleware<MembershipEnv>(async (c, next) => {
    if (!c.get('membership').permissions.approvePurchases) return c.json({ error: 'FORBIDDEN' }, 403)
    await next()
  })
  routes.get(`${root}/delivery-carriers`, auth, member, finance, async c => {
    const after = c.req.query('after'), search = c.req.query('search')
    return c.json(await service.carriers(c.get('userId'), after === undefined ? undefined : text(after, 2000), search === undefined ? undefined : text(search, 100)))
  })
  routes.post(`${root}/delivery-lookups`, json(DeliveryLookupSchema), auth, member, finance, async c => c.json(await service.lookup(
    { userId: c.get('userId'), organizationId: c.req.param('organizationId') }, c.req.valid('json'),
  )))
  routes.post(`${root}/shipments`, json(RegisterShipmentSchema), auth, member, finance, async c => {
    const result = await service.register({ userId: c.get('userId'), organizationId: c.req.param('organizationId') }, c.req.valid('json'))
    return c.json(result, result.replayed ? 200 : 201)
  })
  routes.post(`${root}/shipments/:shipmentId/unlink`, json(UnlinkShipmentSchema), auth, member, finance, async c => c.json(await service.unlink(
    { userId: c.get('userId'), organizationId: c.req.param('organizationId') }, text(c.req.param('shipmentId')), c.req.valid('json').linkIds,
  )))
  return routes
}
