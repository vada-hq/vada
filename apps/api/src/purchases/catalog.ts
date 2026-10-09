import { and, asc, eq, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { coupangProducts } from '../db/schema.js'
import type { FetchResult, ProductFetcher } from './products.js'

export type CatalogDatabase = Pick<PgDatabase<PgQueryResultHKT>, 'select' | 'insert' | 'update' | 'transaction'>
export type ProductRow = typeof coupangProducts.$inferSelect
// 실패 뒤 다시 시도까지 기다리는 분. 네 번째 실패에서 멈춘다.
const RETRY_MINUTES = [1, 5, 30]
const NOT_CONFIGURED: FetchResult = { ok: false, code: 'NOT_CONFIGURED', retryable: false }

async function mapLimit<T, R>(values: T[], limit: number, run: (value: T) => Promise<R>) {
  const results: R[] = []
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (next < values.length) { const index = next++; results[index] = await run(values[index]!) }
  }))
  return results
}

export function createProductCatalog(db: CatalogDatabase, fetchProduct?: ProductFetcher) {
  // 실패는 상품 ID·원문 없이 오류 코드(와 HTTP 상태)만 로그에 남긴다.
  async function call(id: string, timeoutMs?: number) {
    const result = fetchProduct ? await fetchProduct(id, timeoutMs) : NOT_CONFIGURED
    if (!result.ok) console.error('PRODUCT_LOOKUP_FAILED', result.code, ...(result.status ? [result.status] : []))
    return result
  }
  // 성공이면 옵션 목록을 바꾸고, 실패면 다시 시도 일정을 정하거나 멈춘다.
  async function store(id: string, result: FetchResult, attempts: number) {
    if (result.ok) {
      await db.update(coupangProducts).set({ status: 'ready', items: result.items, fetchedAt: sql`now()`, attempts: 0,
        nextAttemptAt: sql`now()`, lockedUntil: null, errorCode: null }).where(eq(coupangProducts.id, id))
      return
    }
    const failures = attempts + 1
    const retry = result.retryable && failures <= RETRY_MINUTES.length
    await db.update(coupangProducts).set({ attempts: failures, lockedUntil: null, errorCode: result.code,
      ...(retry ? { status: 'pending' as const, nextAttemptAt: sql`now() + make_interval(mins => ${RETRY_MINUTES[failures - 1]!})` }
        : { status: 'failed' as const }) }).where(eq(coupangProducts.id, id))
  }
  async function read(ids: string[]) {
    if (!ids.length) return new Map<string, ProductRow>()
    const rows = await db.select().from(coupangProducts).where(inArray(coupangProducts.id, ids))
    return new Map(rows.map(row => [row.id, row]))
  }
  return {
    read,
    // 대기 중이고 시도할 때가 된 상품을 잠가 가져온다. 다른 실행이 잡은 행은 건너뛰고, 60초 안에 못 끝내면 다시 가져갈 수 있다.
    async claim(limit: number): Promise<ProductRow[]> {
      return db.transaction(async tx => {
        const due = await tx.select({ id: coupangProducts.id }).from(coupangProducts)
          .where(and(eq(coupangProducts.status, 'pending'), lte(coupangProducts.nextAttemptAt, sql`now()`),
            or(isNull(coupangProducts.lockedUntil), lt(coupangProducts.lockedUntil, sql`now()`))))
          .orderBy(asc(coupangProducts.nextAttemptAt)).limit(limit).for('update', { skipLocked: true })
        if (!due.length) return []
        return tx.update(coupangProducts).set({ lockedUntil: sql`now() + interval '60 seconds'` })
          .where(inArray(coupangProducts.id, due.map(row => row.id))).returning()
      })
    },
    async process(product: ProductRow) {
      await store(product.id, await call(product.id), product.attempts)
    },
    // 담기·제출처럼 지금 결과가 필요할 때 부른다. 이미 받아 둔 정보는 실패해도 그대로 둔다.
    async refresh(ids: string[], timeoutMs?: number) {
      const unique = [...new Set(ids)]
      if (!unique.length) return new Map<string, ProductRow>()
      await db.insert(coupangProducts).values(unique.map(id => ({ id }))).onConflictDoNothing()
      const before = await read(unique)
      const results = await mapLimit(unique, 4, async id => ({ id, result: await call(id, timeoutMs) }))
      for (const { id, result } of results) {
        const row = before.get(id)
        if (result.ok || row?.status !== 'ready') await store(id, result, row?.attempts ?? 0)
      }
      return read(unique)
    },
  }
}
export type ProductCatalog = ReturnType<typeof createProductCatalog>
