import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { parseCoupangLinks, type PurchaseItemSummary, type PurchaseItemsResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import type { CoupangItem } from '../db/schema.js'
import { migrationsFolder } from '../db/test-migrations.js'
import { recordMessageLinks } from './candidates.js'
import type { DraftGenerator, GeneratedItem } from './generation.js'
import type { FetchResult, ProductFetcher } from './products.js'
import { createPurchaseRoutes } from './purchases.js'

export const origin = 'http://127.0.0.1:5180'
export const link = (n: number) => `https://www.coupang.com/vp/products/${1000 + n}?itemId=${2000 + n}&vendorItemId=${3000 + n}`
export const generated = (productUrl: string, overrides: Partial<GeneratedItem> = {}): GeneratedItem => ({
  productUrl, productName: '테이블', selectedOption: '화이트', optionRequired: true, quantity: 2, packagingUnit: null,
  note: '부스 설치', neededBy: null, sourceMessageIds: ['m'], warnings: [], estimatedUnitPrice: 11590,
  productSnapshot: { price: 11590 }, productFetchedAt: new Date('2026-09-29T00:00:00Z'), ...overrides,
})
// 쿠팡 조회 가짜. link(n)과 같은 옵션 하나를 돌려준다.
export const lookedUp = (productId: string, price = 11590): FetchResult => {
  const n = Number(productId) - 1000
  return { ok: true, items: [{ itemId: String(2000 + n), vendorItemId: String(3000 + n), name: '테이블', price, listPrice: null,
    discountPercent: null, inStock: true, deliveryEta: null, imageUrl: null }] }
}
export const refs = (items: PurchaseItemSummary[]) => items.map(({ id, version }) => ({ id, version }))

// 학생회 a: 기획부 p·q, 총무부(구매 승인) f, 회장단 l, 미배정 n. 학생회 b: x.
// migrations를 주면 그 폴더의 마이그레이션까지만 적용한다(배포 구간 확인용).
export async function setupPurchases(migrations = migrationsFolder) {
  const pg = new PGlite()
  const db = drizzle(pg)
  await migrate(db, { migrationsFolder: migrations })
  await pg.exec(`
    INSERT INTO users(id,name,email) VALUES ('p','기획','p@test.local'),('q','기획2','q@test.local'),('f','재정','f@test.local'),
      ('l','회장','l@test.local'),('n','새내기','n@test.local'),('x','남','x@test.local');
    INSERT INTO organizations(id,name) VALUES ('a','A'),('b','B');
    INSERT INTO departments(id,organization_id,name,handles_finance,is_leadership) VALUES ('dp','a','기획부',false,false),
      ('df','a','총무부',true,false),('dl','a','회장단',false,true),('dx','b','총무부',true,false);
    INSERT INTO memberships(id,user_id,organization_id,department_id) VALUES ('mp','p','a','dp'),('mq','q','a','dp'),('mf','f','a','df'),
      ('ml','l','a','dl'),('mn','n','a',NULL),('mx','x','b','dx');
    INSERT INTO events(id,organization_id,name,created_by) VALUES ('e','a','체육대회','p'),('e2','a','축제','p'),('ex','b','남의 행사','x');
    INSERT INTO chat_rooms(id,organization_id,event_id) VALUES ('room','a','e'),('room2','a','e2'),('roomx','b','ex');
    INSERT INTO messages(id,chat_room_id,author_id,content) VALUES ('m','room','p','테이블 2개'),('m2','room2','p','다른 행사'),('mx','roomx','x','남의 대화');
  `)
  const state = { userId: 'p' as string | null, calls: 0, lookups: 0,
    generate: (async input => ({ items: input.links.map(url => generated(url)) })) as DraftGenerator,
    fetch: (async productId => lookedUp(productId)) as ProductFetcher }
  const routes = createPurchaseRoutes(db, async () => state.userId ? { user: { id: state.userId } } : null,
    async input => { state.calls++; return state.generate(input) },
    async (productId, timeoutMs) => { state.lookups++; return state.fetch(productId, timeoutMs) })
  const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, purchases: routes })
  const request = (method: string, path: string, body?: unknown) => app.request(`/api/organizations/a${path}`, body === undefined
    ? { method } : { method, headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  async function ok<T = PurchaseItemsResponse>(pending: Response | Promise<Response>, status = 200): Promise<T> {
    const response = await pending
    if (response.status !== status) throw new Error(`expected ${status}, got ${response.status}: ${await response.text()}`)
    return await response.json() as T
  }
  // 대화에 링크를 올린 것처럼 메시지를 넣고, 대화 저장과 같은 함수로 후보를 기록한다.
  const rooms: Record<string, [room: string, organizationId: string]> = { e: ['room', 'a'], e2: ['room2', 'a'], ex: ['roomx', 'b'] }
  async function share(content: string, event = 'e', author = 'p') {
    const [room, organizationId] = rooms[event]!
    const messageId = crypto.randomUUID()
    await pg.query('INSERT INTO messages(id,chat_room_id,author_id,content) VALUES ($1,$2,$3,$4)', [messageId, room, author, content])
    await db.transaction(tx => recordMessageLinks(tx, { organizationId, eventId: event, messageId }, parseCoupangLinks(content)))
    return messageId
  }
  // 뒤에서 하는 조회가 끝난 것처럼 상품 행을 채운다.
  async function ready(productId: string, items: CoupangItem[]) {
    await pg.query("UPDATE coupang_products SET status = 'ready', items = $2, fetched_at = now() WHERE id = $1", [productId, JSON.stringify(items)])
  }
  const candidateOf = async (url: string, event = 'e') =>
    (await pg.query<{ id: string }>('SELECT id FROM purchase_candidates WHERE url = $1 AND event_id = $2', [url, event])).rows[0]!.id
  // 지금 사용자가 대화에 링크를 올리고, 그 후보로 담는다. 링크마다 작성 중 품목이 생긴다.
  async function drafts(links = [link(1)], event = 'e') {
    await share(links.join('\n'), event, state.userId ?? 'p')
    const candidateIds = await Promise.all(links.map(url => candidateOf(url, event)))
    return (await ok(request('POST', `/events/${event}/purchase-items/drafts`, { idempotencyKey: crypto.randomUUID(), candidateIds }), 201)).items
  }
  // 담고 바로 제출한다. Task 4의 제출 경로가 있어야 쓸 수 있다.
  async function submitted(links = [link(1)], event = 'e') {
    const created = await drafts(links, event)
    return (await ok(request('POST', `/events/${event}/purchase-items/submit`, { items: refs(created) }))).items
  }
  return { pg, db, state, request, ok, drafts, submitted, share, ready, candidateOf, as: (userId: string | null) => { state.userId = userId } }
}
