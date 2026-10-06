import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { createApp } from '../app.js'
import { createAccessRoutes } from '../access/access.js'
import { createEventRoutes } from '../events/events.js'
import { createChatRoutes } from '../chat/chat.js'
import { createPurchaseRoutes } from '../purchases/purchases.js'
import { createDeliveryRoutes } from '../deliveries/routes.js'

// 구매 본문 검사는 ERD 재설계 때 스키마로 다시 만든다. 그때 이 목록을 비운다.
const schemaPending = new Set([
  'POST /api/organizations/:organizationId/events/:eventId/purchase-requests/drafts',
  'PATCH /api/organizations/:organizationId/events/:eventId/purchase-requests/:requestId',
  'POST /api/organizations/:organizationId/events/:eventId/purchase-requests/:requestId/discard',
  'POST /api/organizations/:organizationId/events/:eventId/purchase-requests/:requestId/submit',
  'POST /api/organizations/:organizationId/events/:eventId/purchase-requests/finance/:requestId/decision',
])

test('모든 변경 라우트는 출처·형식·크기·JSON·모르는 키를 인증 전에 거절한다', async () => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
    const origin = 'http://127.0.0.1:5180'
    let authCalls = 0
    const session = async () => { authCalls++; return null }
    const app = createApp({
      auth: { handler: async () => new Response() }, trustedOrigin: origin,
      access: createAccessRoutes(db, session), events: createEventRoutes(db, session), chat: createChatRoutes(db, session),
      purchases: createPurchaseRoutes(db, session, async () => { throw new Error('unused') }),
      deliveries: createDeliveryRoutes(db, session, {} as never),
    })
    const mutating = [...new Set(app.routes
      .filter(route => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(route.method) && route.path.startsWith('/api/organizations/'))
      .map(route => `${route.method} ${route.path}`))]
    // 목록이 비어 테스트가 저절로 통과하는 일을 막는다.
    assert.ok(mutating.length >= 10, `변경 라우트 ${mutating.length}개`)
    for (const key of mutating) {
      const [method, pattern] = key.split(' ') as [string, string]
      const path = pattern.replace(/:[^/]+/g, 'probe')
      const send = (headers: Record<string, string>, body: string) => app.request(path, { method, headers, body })
      const json = { 'Content-Type': 'application/json', Origin: origin }
      assert.equal((await send({ ...json, Origin: 'https://evil.test' }, '{}')).status, 403, key)
      assert.equal((await send({ Origin: origin, 'Content-Type': 'text/plain' }, '{}')).status, 415, key)
      assert.equal((await send(json, JSON.stringify({ x: 'a'.repeat(40000) }))).status, 413, key)
      if (schemaPending.has(key)) continue
      const before = authCalls
      const malformed = await send(json, '{')
      assert.equal(malformed.status, 400, key)
      assert.deepEqual(await malformed.json(), { error: 'INVALID_INPUT' }, key)
      assert.equal((await send(json, '{"__probe":1}')).status, 400, key)
      assert.equal(authCalls, before, `${key}: 형식 검사가 인증보다 먼저여야 한다`)
    }
  } finally {
    await pg.close()
  }
})
