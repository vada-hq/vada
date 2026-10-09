import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { createChatRoutes } from './chat.js'
import { createApp } from '../app.js'
import { createAccessRoutes } from '../access/access.js'
import type { MessagesResponse, MessageResponse } from '@vada/contracts'
import { migrationsFolder } from '../db/test-migrations.js'

test('event chat respects council boundaries and paginates persisted messages', async (t) => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
    await pg.exec(`
      INSERT INTO users(id,name,email) VALUES ('p','Planner','p@test.local'),('f','Finance','f@test.local'),('x','Other','x@test.local');
      INSERT INTO organizations(id,name) VALUES ('a','A'),('b','B');
      INSERT INTO departments(id,organization_id,name,handles_finance) VALUES ('p','a','Planning',false),('f','a','Finance',true),('x','b','Other',false);
      INSERT INTO memberships(id,user_id,organization_id,department_id) VALUES ('p','p','a','p'),('f','f','a','f'),('x','x','b','x');
      INSERT INTO events(id,organization_id,name,created_by) VALUES ('e1','a','First','p'),('e2','a','Second','p'),('e3','b','Other','x'),('no-room','a','No room','p');
      INSERT INTO chat_rooms(id,organization_id,event_id) VALUES ('r1','a','e1'),('r2','a','e2'),('r3','b','e3');
      INSERT INTO chat_rooms(id,organization_id) VALUES ('unlinked','a');
    `)
    let userId: string | null = null
    const session = async () => userId ? { user: { id: userId } } : null
    const origin = 'http://127.0.0.1:5180'
    const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, access: createAccessRoutes(db, session), chat: createChatRoutes(db, session) })
    const path = '/api/organizations/a/events/e1/messages'
    const post = (body: unknown, target = path, requestOrigin = origin) => app.request(target, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: requestOrigin }, body: JSON.stringify(body),
    })
    const get = async (target = path) => {
      const response = await app.request(target)
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('Cache-Control'), 'no-store')
      return await response.json() as MessagesResponse
    }

    await t.test('anonymous and nonmembers are denied for reads and writes', async () => {
      assert.equal((await app.request(path)).status, 401)
      assert.equal((await post({ content: 'Hello' })).status, 401)
      userId = 'x'
      assert.equal((await app.request(path)).status, 403)
      assert.equal((await post({ content: 'Hello' })).status, 403)
    })
    await t.test('missing, cross-council events and unlinked rooms are not exposed', async () => {
      userId = 'p'
      for (const id of ['missing', 'e3', 'no-room', 'unlinked']) {
        const target = `/api/organizations/a/events/${id}/messages`
        assert.equal((await app.request(target)).status, 404)
        assert.equal((await post({ content: 'Hello' }, target)).status, 404)
      }
      assert.deepEqual(await get(), { messages: [], nextCursor: null })
    })
    await t.test('invalid content and cross-origin requests are rejected without writes', async () => {
      for (const body of [null, [], {}, { content: 3 }, { content: '' }, { content: ' \t\n ' }, { content: 'a'.repeat(2001) }, { content: '\u0000' }, { content: '\ud800' }, { content: 'Hi', extra: 1 }, { content: '😀'.repeat(2001) }]) {
        assert.equal((await post(body)).status, 400)
      }
      assert.deepEqual(await (await post({ content: '\u0000' })).json(), { error: 'INVALID_INPUT' })
      assert.equal((await app.request(path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{' })).status, 400)
      assert.equal((await post({ content: 'Hello' }, path, 'https://evil.test')).status, 403)
      assert.equal((await app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"content":"Hi"}' })).status, 403)
      assert.equal((await app.request(path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'text/plain' }, body: 'Hi' })).status, 415)
      assert.deepEqual(await get(), { messages: [], nextCursor: null })
    })
    await t.test('session author and resolved room are used; finance sees the message', async () => {
      const response = await post({ content: '  준비물\n확인해 주세요  ' })
      assert.equal(response.status, 201)
      const { message } = await response.json() as MessageResponse
      assert.equal(message.content, '준비물\n확인해 주세요')
      assert.equal(message.chatRoomId, 'r1')
      assert.deepEqual(message.author, { id: 'p', name: 'Planner' })
      assert.ok(message.id)
      assert.ok(Number.isFinite(Date.parse(message.createdAt)))
      assert.notEqual(message.createdAt, '2000-01-01T00:00:00.000Z')
      userId = 'f'
      assert.deepEqual((await get()).messages, [message])
      assert.equal((await post({ content: '확인했어요' })).status, 201)
      assert.equal((await post({ content: '😀'.repeat(2000) })).status, 201)
      assert.deepEqual(await get('/api/organizations/a/events/e2/messages'), { messages: [], nextCursor: null })
      assert.equal((await app.request(`${path}?before=missing`)).status, 400)
      assert.equal((await app.request(`${path}?before=`)).status, 400)
      assert.equal((await app.request(`${path}?before=%00`)).status, 400)
      assert.equal((await app.request(`/api/organizations/a/events/e2/messages?before=${message.id}`)).status, 400)
    })
    await t.test('50-message pages have no gaps even with equal timestamps and microseconds', async () => {
      await pg.exec(`DELETE FROM messages;
        INSERT INTO messages(id,chat_room_id,author_id,content,created_at)
        SELECT 'm'||lpad(i::text,3,'0'),'r1','p','Message '||i,'2026-01-01 00:00:00.123456+00'::timestamptz
        FROM generate_series(1,105) AS i;
        INSERT INTO messages(id,chat_room_id,author_id,content) VALUES ('foreign','r2','p','Other event');`)
      const first = await get()
      assert.equal(first.messages.length, 50)
      assert.equal(first.messages[0]?.id, 'm056')
      assert.equal(first.messages[49]?.id, 'm105')
      assert.equal(first.nextCursor, 'm056')
      const second = await get(`${path}?before=${first.nextCursor}`)
      assert.equal(second.messages.length, 50)
      assert.equal(second.messages[0]?.id, 'm006')
      const third = await get(`${path}?before=${second.nextCursor}`)
      assert.deepEqual(third.messages.map(message => message.id), ['m001', 'm002', 'm003', 'm004', 'm005'])
      assert.equal(third.nextCursor, null)
      assert.equal(new Set([...first.messages, ...second.messages, ...third.messages].map(message => message.id)).size, 105)
      assert.equal((await app.request(`${path}?before=foreign`)).status, 400)
      assert.deepEqual(await get(`${path}?before=m001`), { messages: [], nextCursor: null })
    })
    await t.test('revoked membership immediately blocks reading and sending', async () => {
      await pg.exec("DELETE FROM memberships WHERE id='f'")
      assert.equal((await app.request(path)).status, 403)
      assert.equal((await post({ content: 'No' })).status, 403)
    })
  } finally {
    await pg.close()
  }
})

test('쿠팡 링크가 있는 메시지는 같은 트랜잭션에서 후보·공유로 기록하고, 저장 뒤 조회를 부른다', async () => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder })
    await pg.exec(`
      INSERT INTO users(id,name,email) VALUES ('p','Planner','p@test.local'),('q','Second','q@test.local');
      INSERT INTO organizations(id,name) VALUES ('a','A');
      INSERT INTO memberships(id,user_id,organization_id) VALUES ('p','p','a'),('q','q','a');
      INSERT INTO events(id,organization_id,name,created_by) VALUES ('e1','a','First','p');
      INSERT INTO chat_rooms(id,organization_id,event_id) VALUES ('r1','a','e1');
    `)
    let userId = 'p'
    let kicks = 0
    const session = async () => ({ user: { id: userId } })
    const origin = 'http://127.0.0.1:5180'
    const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, chat: createChatRoutes(db, session, () => { kicks++ }) })
    const post = (content: string) => app.request('/api/organizations/a/events/e1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ content }) })
    const link = (vendor: string | null, item = '7') => `https://www.coupang.com/vp/products/1?itemId=${item}${vendor ? `&vendorItemId=${vendor}` : ''}`
    const candidates = async () => (await pg.query<{ vendor_item_id: string | null; item_id: string | null; shares: number; hidden: boolean }>(
      `SELECT c.vendor_item_id, c.item_id, count(s.*)::int AS shares, c.hidden_at IS NOT NULL AS hidden FROM purchase_candidates c
       JOIN purchase_candidate_shares s ON s.candidate_id = c.id GROUP BY c.id ORDER BY c.vendor_item_id NULLS LAST`)).rows
    const product = async () => (await pg.query<{ status: string; attempts: number }>("SELECT status, attempts FROM coupang_products WHERE id = '1'")).rows[0]

    assert.equal((await post('링크 없는 메시지')).status, 201)
    assert.equal(kicks, 0)
    assert.equal((await post(`이거 ${link('11')} 그리고 ${link('12')} 또 ${link('11')}`)).status, 201)
    assert.equal(kicks, 1)
    userId = 'q'
    // 옵션 정보가 없는 링크는 상품마다 "옵션 미정" 후보 하나로 모인다.
    assert.equal((await post(`나도 ${link('11')} ${link(null)} ${link(null, '8')}`)).status, 201)
    // 같은 링크를 거의 동시에 올려도 후보는 하나다(Review Focus 1).
    await Promise.all([post(link('13')), post(link('13'))])
    assert.deepEqual(await candidates(), [
      { vendor_item_id: '11', item_id: '7', shares: 3, hidden: false }, { vendor_item_id: '12', item_id: '7', shares: 1, hidden: false },
      { vendor_item_id: '13', item_id: '7', shares: 2, hidden: false }, { vendor_item_id: null, item_id: '7', shares: 2, hidden: false }])
    assert.deepEqual(await product(), { status: 'pending', attempts: 0 })

    // 실패했던 상품은 다시 공유되면 다시 조회하고(NOT_FOUND 제외), 숨긴 후보는 숨김을 푼다.
    await pg.exec(`UPDATE coupang_products SET status = 'failed', error_code = 'TIMEOUT', attempts = 4 WHERE id = '1';
      UPDATE purchase_candidates SET hidden_by = 'p', hidden_at = now() WHERE vendor_item_id = '12'`)
    await post(link('12'))
    assert.deepEqual(await product(), { status: 'pending', attempts: 0 })
    assert.equal((await candidates())[1]!.hidden, false)
    await pg.exec("UPDATE coupang_products SET status = 'failed', error_code = 'NOT_FOUND' WHERE id = '1'")
    await post(link('12'))
    assert.equal((await product())!.status, 'failed')
  } finally { await pg.close() }
})
