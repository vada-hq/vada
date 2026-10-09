import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type { CoupangLink } from '@vada/contracts'
import { coupangProducts, purchaseCandidates as candidates, purchaseCandidateShares as shares } from '../db/schema.js'

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
