import { Hono, type Context } from 'hono'
import { CreatePurchaseDraftsSchema, token, type EventPurchaseItemsResponse, type PurchaseItemResponse,
  type PurchaseItemsResponse } from '@vada/contracts'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { requireMembership, type MembershipEnv } from '../access/membership.js'
import { json } from '../http/validate.js'
import type { DraftGenerator } from './generation.js'
import { createPurchaseService, type PurchaseDatabase, type PurchaseScope } from './service.js'
import { PurchaseError } from './validation.js'

// 경로의 ID도 본문과 같은 규칙으로 검사한다. 제어 문자나 너무 긴 값은 없는 ID로 본다.
const pathId = token(64)
function idOf(value: string | undefined) {
  const parsed = pathId.safeParse(value)
  if (!parsed.success) throw new PurchaseError('NOT_FOUND', 404)
  return parsed.data
}

export function createPurchaseRoutes(db: PurchaseDatabase, session: SessionReader, generate: DraftGenerator) {
  const routes = new Hono<MembershipEnv>()
  const service = createPurchaseService(db, generate)
  const auth = requireSession(session)
  const member = requireMembership(db)
  const base = '/organizations/:organizationId/events/:eventId/purchase-items'
  // 송장번호 가리기는 소속의 구매 승인 권한으로 정한다.
  const scope = (c: Context<MembershipEnv>): PurchaseScope => ({ organizationId: c.get('membership').organization.id,
    eventId: idOf(c.req.param('eventId')), userId: c.get('userId'), finance: c.get('membership').permissions.approvePurchases })
  routes.get(base, auth, member, async c => c.json(await service.list(scope(c)) satisfies EventPurchaseItemsResponse))
  routes.post(`${base}/drafts`, json(CreatePurchaseDraftsSchema), auth, member, async c => {
    const result = await service.createDrafts(scope(c), c.req.valid('json'))
    return c.json({ items: result.items } satisfies PurchaseItemsResponse, result.created ? 201 : 200)
  })
  routes.get(`${base}/:itemId`, auth, member, async c =>
    c.json({ item: await service.get(scope(c), idOf(c.req.param('itemId'))) } satisfies PurchaseItemResponse))
  return routes
}
