import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { alias, type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type { CoupangLink, PurchaseCandidate, PurchaseCandidatesResponse } from '@vada/contracts'
import { coupangProducts, events, messages, purchaseCandidates as candidates, purchaseCandidateShares as shares,
  purchaseItems as items, users } from '../db/schema.js'
import { matchItem } from './products.js'
import type { PurchaseScope } from './service.js'
import { PurchaseError } from './validation.js'
import { requireActiveEvents } from '../events/lock.js'

type Writer = Pick<PgDatabase<PgQueryResultHKT>, 'insert'>

// 대화 저장 트랜잭션에서 부른다. 상품 행은 조회 대기로 두고(실패했던 상품은 NOT_FOUND가 아니면 다시 대기),
// 행사의 후보를 만들거나 찾아 공유를 남긴다. 숨긴 후보가 다시 공유되면 숨김을 푼다(2026-10-09 결정).
export async function recordMessageLinks(tx: Writer, scope: { organizationId: string; eventId: string; messageId: string }, links: CoupangLink[]) {
  if (!links.length) return
  await tx.insert(coupangProducts).values([...new Set(links.map(link => link.productId))].map(id => ({ id })))
    .onConflictDoUpdate({ target: coupangProducts.id, set: { status: 'pending', attempts: 0, nextAttemptAt: sql`now()`, errorCode: null },
      setWhere: sql`${coupangProducts.status} = 'failed' AND ${coupangProducts.errorCode} IS DISTINCT FROM 'NOT_FOUND'` })
  for (const [position, link] of links.entries()) {
    const [candidate] = await tx.insert(candidates).values({ id: randomUUID(), organizationId: scope.organizationId, eventId: scope.eventId,
      productId: link.productId, itemId: link.itemId, vendorItemId: link.vendorItemId, url: link.url })
      .onConflictDoUpdate({ target: [candidates.eventId, candidates.productId, candidates.vendorItemId],
        set: { itemId: sql`coalesce(${candidates.itemId}, excluded.item_id)`, hiddenBy: null, hiddenAt: null } })
      .returning({ id: candidates.id })
    await tx.insert(shares).values({ organizationId: scope.organizationId, candidateId: candidate!.id, messageId: scope.messageId, position })
  }
}

type Reader = Pick<PgDatabase<PgQueryResultHKT>, 'select' | 'selectDistinct' | 'update' | 'transaction'>
const LIST_LIMIT = 300
const SHARES_SHOWN = 20
const hiders = alias(users, 'candidate_hiders')
type CandidateRow = { candidate: typeof candidates.$inferSelect; hiderName: string | null; shareCount: number }
type ShareRow = { candidateId: string; messageId: string; sharedAt: Date; author: { id: string; name: string } }
type RequestRow = { candidateId: string | null; status: string; quantity: number | null; requester: { id: string; name: string } }

function summary(row: CandidateRow, product: typeof coupangProducts.$inferSelect | undefined, shareRows: ShareRow[],
  requestRows: RequestRow[], drafted: { candidateId: string | null }[]): PurchaseCandidate {
  const c = row.candidate
  const ready = product?.status === 'ready' ? product : undefined
  const matched = ready ? matchItem(ready.items, c) : { item: null, warning: null }
  // 옵션을 못 맞추면 첫 옵션의 이름·이미지만 보여 주고 가격은 비운다("옵션 미정").
  const option = matched.item
  const shown = option ?? ready?.items[0] ?? null
  return {
    id: c.id, url: c.url, productId: c.productId, itemId: c.itemId, vendorItemId: c.vendorItemId,
    lookup: product?.status ?? 'pending', fetchedAt: product?.fetchedAt?.toISOString() ?? null, optionKnown: option !== null,
    product: shown ? { name: shown.name, price: option?.price ?? null, listPrice: option?.listPrice ?? null,
      discountPercent: option?.discountPercent ?? null, inStock: option?.inStock ?? null, deliveryEta: option?.deliveryEta ?? null,
      imageUrl: shown.imageUrl } : null,
    warning: matched.warning,
    shareCount: row.shareCount,
    shares: shareRows.filter(share => share.candidateId === c.id).slice(0, SHARES_SHOWN)
      .map(share => ({ messageId: share.messageId, author: share.author, sharedAt: share.sharedAt.toISOString() })),
    hidden: c.hiddenBy && c.hiddenAt ? { by: { id: c.hiddenBy, name: row.hiderName ?? '' }, at: c.hiddenAt.toISOString() } : null,
    requests: requestRows.filter(request => request.candidateId === c.id)
      .map(request => ({ requester: request.requester, quantity: request.quantity, status: request.status as 'pending' | 'approved' })),
    draftedByMe: drafted.some(entry => entry.candidateId === c.id),
  }
}

// 행사의 후보. 학생회 누구나 본다. 요청됨은 제출된 품목만, 내가 담음은 보는 사람의 작성 중 품목만 센다.
export function createCandidateService(db: Reader) {
  async function event(scope: PurchaseScope) {
    const [found] = await db.select({ id: events.id }).from(events)
      .where(and(eq(events.id, scope.eventId), eq(events.organizationId, scope.organizationId)))
    if (!found) throw new PurchaseError('NOT_FOUND', 404)
  }
  async function summaries(scope: PurchaseScope, only?: string): Promise<PurchaseCandidatesResponse> {
    const lastShared = sql<Date>`max(${shares.createdAt})`
    const rows = await db.select({ candidate: candidates, hiderName: hiders.name, shareCount: sql<number>`count(*)::int` }).from(candidates)
      .innerJoin(shares, eq(shares.candidateId, candidates.id))
      .leftJoin(hiders, eq(hiders.id, candidates.hiddenBy))
      .where(and(eq(candidates.organizationId, scope.organizationId), eq(candidates.eventId, scope.eventId),
        only === undefined ? undefined : eq(candidates.id, only)))
      .groupBy(candidates.id, hiders.name).orderBy(desc(lastShared), desc(candidates.id)).limit(LIST_LIMIT + 1)
    const page = rows.slice(0, LIST_LIMIT)
    const ids = page.map(row => row.candidate.id)
    if (!ids.length) return { candidates: [], truncated: false }
    const products = new Map((await db.select().from(coupangProducts)
      .where(inArray(coupangProducts.id, [...new Set(page.map(row => row.candidate.productId))]))).map(row => [row.id, row]))
    const shareRows = await db.select({ candidateId: shares.candidateId, messageId: shares.messageId, sharedAt: shares.createdAt,
      author: { id: users.id, name: users.name } }).from(shares)
      .innerJoin(messages, eq(messages.id, shares.messageId)).innerJoin(users, eq(users.id, messages.authorId))
      .where(inArray(shares.candidateId, ids)).orderBy(desc(shares.createdAt), desc(shares.messageId), desc(shares.position))
    const requestRows = await db.select({ candidateId: items.candidateId, status: items.status, quantity: items.quantity,
      requester: { id: users.id, name: users.name } }).from(items).innerJoin(users, eq(users.id, items.requesterId))
      .where(and(eq(items.organizationId, scope.organizationId), inArray(items.candidateId, ids), inArray(items.status, ['pending', 'approved'])))
      .orderBy(asc(items.createdAt), asc(items.id))
    const drafted = await db.selectDistinct({ candidateId: items.candidateId }).from(items)
      .where(and(eq(items.organizationId, scope.organizationId), inArray(items.candidateId, ids), eq(items.status, 'draft'),
        eq(items.requesterId, scope.userId)))
    return { candidates: page.map(row => summary(row, products.get(row.candidate.productId), shareRows, requestRows, drafted)),
      truncated: rows.length > LIST_LIMIT }
  }
  return {
    async list(scope: PurchaseScope) {
      await event(scope)
      return summaries(scope)
    },
    async setHidden(scope: PurchaseScope, id: string, hidden: boolean): Promise<PurchaseCandidate> {
      await event(scope)
      // 완료한 행사(M5a)의 후보는 바꾸지 않는다. 행사 행을 FOR SHARE로 잠근 채 바꾼다.
      await db.transaction(async tx => {
        await requireActiveEvents(tx, scope.organizationId, [scope.eventId])
        // 이미 그 상태면 그대로 둔다. 처음 숨긴 사람·시각을 덮어쓰지 않는다.
        await tx.update(candidates).set(hidden ? { hiddenBy: scope.userId, hiddenAt: sql`now()` } : { hiddenBy: null, hiddenAt: null })
          .where(and(eq(candidates.id, id), eq(candidates.organizationId, scope.organizationId), eq(candidates.eventId, scope.eventId),
            hidden ? isNull(candidates.hiddenAt) : isNotNull(candidates.hiddenAt)))
      })
      const [found] = (await summaries(scope, id)).candidates
      if (!found) throw new PurchaseError('NOT_FOUND', 404)
      return found
    },
  }
}
