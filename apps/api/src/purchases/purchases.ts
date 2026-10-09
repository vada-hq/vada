import { Hono, type Context } from 'hono'
import { ChangeNeededBySchema, CreatePurchaseDraftsSchema, DecidePurchaseItemsSchema, PurchaseCandidateHiddenSchema, PurchasePurchasedSchema, PurchaseItemVersionSchema, PurchaseReceivedSchema, SubmitPurchaseItemsSchema, token,
  UpdatePurchaseItemSchema, type EventPurchaseItemsResponse, type PurchaseCandidateResponse, type PurchaseCandidatesResponse, type PurchaseItemResponse, type PurchaseItemsResponse, type PurchaseReviewResponse } from '@vada/contracts'
import { requireSession, type SessionReader } from '../auth/require-session.js'
import { requireMembership, type MembershipEnv } from '../access/membership.js'
import { json } from '../http/validate.js'
import { createCandidateService } from './candidates.js'
import { createProductCatalog } from './catalog.js'
import type { DraftGenerator } from './generation.js'
import type { ProductFetcher } from './products.js'
import { createPurchaseService, type PurchaseDatabase, type PurchaseScope } from './service.js'
import { createReviewService, type ReviewScope } from './review.js'
import { PurchaseError } from './validation.js'

// 경로의 ID도 본문과 같은 규칙으로 검사한다. 제어 문자나 너무 긴 값은 없는 ID로 본다.
const pathId = token(64)
function idOf(value: string | undefined) {
  const parsed = pathId.safeParse(value)
  if (!parsed.success) throw new PurchaseError('NOT_FOUND', 404)
  return parsed.data
}

export function createPurchaseRoutes(db: PurchaseDatabase, session: SessionReader, generate: DraftGenerator, fetchProduct?: ProductFetcher) {
  const routes = new Hono<MembershipEnv>()
  const service = createPurchaseService(db, generate, createProductCatalog(db, fetchProduct))
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
  const itemsOf = (items: PurchaseItemsResponse['items']) => ({ items } satisfies PurchaseItemsResponse)
  routes.post(`${base}/submit`, json(SubmitPurchaseItemsSchema), auth, member, async c =>
    c.json(itemsOf(await service.submit(scope(c), c.req.valid('json')))))
  routes.post(`${base}/needed-by`, json(ChangeNeededBySchema), auth, member, async c =>
    c.json(itemsOf(await service.changeNeededBy(scope(c), c.req.valid('json')))))
  routes.patch(`${base}/:itemId`, json(UpdatePurchaseItemSchema), auth, member, async c =>
    c.json(itemsOf(await service.updateDraft(scope(c), idOf(c.req.param('itemId')), c.req.valid('json')))))
  routes.post(`${base}/:itemId/delete`, json(PurchaseItemVersionSchema), auth, member, async c =>
    c.json(itemsOf(await service.deleteDraft(scope(c), idOf(c.req.param('itemId')), c.req.valid('json').version))))
  routes.post(`${base}/:itemId/cancel`, json(PurchaseItemVersionSchema), auth, member, async c =>
    c.json(itemsOf(await service.cancel(scope(c), idOf(c.req.param('itemId')), c.req.valid('json').version))))
  routes.post(`${base}/:itemId/re-add`, json(PurchaseItemVersionSchema), auth, member, async c =>
    c.json(itemsOf(await service.reAdd(scope(c), idOf(c.req.param('itemId')), c.req.valid('json').version))))
  routes.post(`${base}/:itemId/received`, json(PurchaseReceivedSchema), auth, member, async c => {
    const { version, received } = c.req.valid('json')
    return c.json(itemsOf(await service.setReceived(scope(c), idOf(c.req.param('itemId')), version, received)))
  })
  const candidates = createCandidateService(db)
  const candidateBase = '/organizations/:organizationId/events/:eventId/purchase-candidates'
  routes.get(candidateBase, auth, member, async c => c.json(await candidates.list(scope(c)) satisfies PurchaseCandidatesResponse))
  routes.post(`${candidateBase}/:candidateId/hidden`, json(PurchaseCandidateHiddenSchema), auth, member, async c =>
    c.json({ candidate: await candidates.setHidden(scope(c), idOf(c.req.param('candidateId')), c.req.valid('json').hidden) } satisfies PurchaseCandidateResponse))
  const review = createReviewService(db)
  const reviewBase = '/organizations/:organizationId/purchase-review'
  const reviewScope = (c: Context<MembershipEnv>): ReviewScope => ({ organizationId: c.get('membership').organization.id, userId: c.get('userId') })
  routes.get(reviewBase, auth, member, async c => c.json(await review.list(reviewScope(c)) satisfies PurchaseReviewResponse))
  routes.post(`${reviewBase}/decisions`, json(DecidePurchaseItemsSchema), auth, member, async c =>
    c.json(itemsOf(await review.decide(reviewScope(c), c.req.valid('json')))))
  routes.post(`${reviewBase}/:itemId/revoke`, json(PurchaseItemVersionSchema), auth, member, async c =>
    c.json(itemsOf(await review.revoke(reviewScope(c), idOf(c.req.param('itemId')), c.req.valid('json').version))))
  routes.post(`${reviewBase}/:itemId/purchased`, json(PurchasePurchasedSchema), auth, member, async c => {
    const { version, purchased } = c.req.valid('json')
    return c.json(itemsOf(await review.setPurchased(reviewScope(c), idOf(c.req.param('itemId')), version, purchased)))
  })
  return routes
}
