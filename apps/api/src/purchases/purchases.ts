import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { createMiddleware } from 'hono/factory'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { requireMembership, type MembershipEnv } from '../access/membership.js'
import type { PurchaseResponse, PurchasesResponse } from '@vada/contracts'
import type { DraftGenerator } from './generation.js'
import { createPurchaseService, type PurchaseDatabase, type PurchaseScope } from './service.js'
import { parseCreate, parseDecision, parseVersion, parseUpdate, PurchaseError, text } from './validation.js'

export function createPurchaseRoutes(db: PurchaseDatabase, session: SessionReader, trustedOrigin: string, generate: DraftGenerator) {
  const routes = new Hono<MembershipEnv>()
  const path = '/organizations/:organizationId/events/:eventId/purchase-requests'
  const service = createPurchaseService(db, generate)
  const origin = new URL(trustedOrigin).origin
  const auth = requireSession(session)
  const member = requireMembership(db)
  const mutation = createMiddleware<MembershipEnv>(async (c, next) => {
    if (c.req.header('Origin') !== origin) return c.json({ error: 'FORBIDDEN' }, 403)
    if (c.req.header('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') return c.json({ error: 'UNSUPPORTED_MEDIA_TYPE' }, 415)
    await next()
  })
  const size = bodyLimit({ maxSize: 32768, onError: c => c.json({ error: 'BODY_TOO_LARGE' }, 413) })
  const scope = (userId: string, organizationId: string, eventId: string): PurchaseScope => ({ userId, organizationId, eventId })
  // 에러 응답에는 입력·외부 응답·키를 포함하지 않는다.
  routes.onError((error, c) => error instanceof PurchaseError ? c.json({ error: error.code }, error.status) : c.json({ error: 'Internal server error' }, 500))
  const body = async (request: { json: () => Promise<unknown> }) => {
    try { return await request.json() } catch { throw new PurchaseError('INVALID_INPUT') }
  }
  routes.get(path, auth, member, async c => {
    const before = c.req.query('before')
    const result = await service.list(scope(c.get('userId'), c.req.param('organizationId'), c.req.param('eventId')), before === undefined ? undefined : text(before, 200))
    return c.json(result satisfies PurchasesResponse)
  })
  routes.get(`${path}/finance`, auth, member, async c => {
    const before = c.req.query('before')
    const result = await service.list(scope(c.get('userId'), c.req.param('organizationId'), c.req.param('eventId')), before === undefined ? undefined : text(before, 200), true)
    return c.json(result satisfies PurchasesResponse)
  })
  routes.get(`${path}/finance/:requestId`, auth, member, async c => {
    const request = await service.get(scope(c.get('userId'), c.req.param('organizationId'), c.req.param('eventId')), text(c.req.param('requestId'), 200), true)
    return c.json({ request } satisfies PurchaseResponse)
  })
  routes.get(`${path}/:requestId`, auth, member, async c => {
    const request = await service.get(scope(c.get('userId'), c.req.param('organizationId'), c.req.param('eventId')), text(c.req.param('requestId'), 200))
    return c.json({ request } satisfies PurchaseResponse)
  })
  routes.post(`${path}/drafts`, auth, member, mutation, size, async c => {
    const result = await service.create(scope(c.get('userId'), c.req.param('organizationId'), c.req.param('eventId')), parseCreate(await body(c.req)))
    return c.json({ request: result.request } satisfies PurchaseResponse, result.created ? 201 : 200)
  })
  routes.patch(`${path}/:requestId`, auth, member, mutation, size, async c => {
    const request = await service.change(scope(c.get('userId'), c.req.param('organizationId'), c.req.param('eventId')), text(c.req.param('requestId'), 200), parseUpdate(await body(c.req)))
    return c.json({ request } satisfies PurchaseResponse)
  })
  routes.post(`${path}/:requestId/discard`, auth, member, mutation, size, async c => {
    const request = await service.change(scope(c.get('userId'), c.req.param('organizationId'), c.req.param('eventId')), text(c.req.param('requestId'), 200), { version: parseVersion(await body(c.req)) }, 'discard')
    return c.json({ request } satisfies PurchaseResponse)
  })
  routes.post(`${path}/:requestId/submit`, auth, member, mutation, size, async c => {
    const request = await service.change(scope(c.get('userId'), c.req.param('organizationId'), c.req.param('eventId')), text(c.req.param('requestId'), 200), { version: parseVersion(await body(c.req)) }, 'submit')
    return c.json({ request } satisfies PurchaseResponse)
  })
  routes.post(`${path}/finance/:requestId/decision`, auth, member, mutation, size, async c => {
    const request = await service.decide(scope(c.get('userId'), c.req.param('organizationId'), c.req.param('eventId')), text(c.req.param('requestId'), 200), parseDecision(await body(c.req)))
    return c.json({ request } satisfies PurchaseResponse)
  })
  return routes
}
