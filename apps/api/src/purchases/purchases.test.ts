import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { createPurchaseRoutes } from './purchases.js'
import { createApp } from '../app.js'
import type { DraftGenerator } from './generation.js'

const link = 'https://www.coupang.com/vp/products/7746622155?itemId=20782129073&vendorItemId=91657444188'
test('draft API protects ownership, persists atomically, and rejects stale edits', async t => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
    await pg.exec(`
      INSERT INTO users(id,name,email) VALUES ('p','Planner','p@test.local'),('f','Finance','f@test.local'),('x','Other','x@test.local');
      INSERT INTO organizations(id,name) VALUES ('a','A'),('b','B');
      INSERT INTO departments(id,organization_id,name,handles_finance) VALUES ('p','a','Planning',false),('f','a','Finance',true),('x','b','Other',false);
      INSERT INTO memberships(id,user_id,organization_id,department_id) VALUES ('p','p','a','p'),('f','f','a','f'),('x','x','b','x');
      INSERT INTO events(id,organization_id,name,created_by) VALUES ('e','a','Festival','p'),('e2','a','Other event','p'),('x','b','Other council','x');
      INSERT INTO chat_rooms(id,organization_id,event_id) VALUES ('room','a','e'),('room2','a','e2'),('x','b','x');
      INSERT INTO messages(id,chat_room_id,author_id,content) VALUES ('m','room','p','테이블 2개'),('other','room2','p','다른 행사'),('secret','x','x','다른 학생회');
    `)
    let userId: string | null = null
    let calls = 0
    let behavior: 'ok' | 'fail' | 'foreign-source' | 'revoke' | 'blocked' = 'ok'
    let started = () => {}
    let release = () => {}
    let blocked: Promise<void>
    const generate: DraftGenerator = async input => {
      calls++
      assert.equal(input.eventName, 'Festival')
      assert.deepEqual(input.messages.map(m => m.id), ['m'])
      if (behavior === 'blocked') { started(); await blocked!; throw new Error('blocked failure') }
      if (behavior === 'fail') throw new Error('secret-provider-error')
      if (behavior === 'revoke') await pg.exec("DELETE FROM memberships WHERE id='p'")
      return {
        purpose: '행사 접수', neededBy: '2026-10-09', sourceMessageIds: [behavior === 'foreign-source' ? 'other' : 'm'],
        warnings: [], items: input.links.map(productUrl => ({ productUrl, productName: '테이블', selectedOption: '화이트',
          optionRequired: true, quantity: 2, packagingUnit: null, estimatedUnitPrice: 11590,
          productSnapshot: { price: 11590 }, productFetchedAt: new Date('2026-09-29T00:00:00Z') })),
      }
    }
    const origin = 'http://127.0.0.1:5180'
    const routes = createPurchaseRoutes(db, async () => userId ? { user: { id: userId } } : null, origin, generate)
    const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, purchases: routes })
    const path = '/api/organizations/a/events/e/purchase-requests'
    const mutate = (target: string, body: unknown, method = 'POST', requestOrigin = origin) => app.request(target, {
      method, headers: { Origin: requestOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const create = (key = 'key-1', links = [link]) => mutate(`${path}/drafts`, { idempotencyKey: key, links })
    let id = ''
    let itemId = ''
    await t.test('authentication, membership, origin, body and links fail before external calls', async () => {
      assert.equal((await create()).status, 401)
      userId = 'x'
      assert.equal((await create()).status, 403)
      userId = 'p'
      assert.equal((await mutate(`${path}/drafts`, {}, 'POST', 'https://evil.test')).status, 403)
      for (const body of [null, {}, { links: [] }, { idempotencyKey: 'k', links: [link], requesterId: 'f' }]) {
        assert.equal((await mutate(`${path}/drafts`, body)).status, 400)
      }
      for (const links of [[], ['http://localhost/'], ['https://www.coupang.com.evil.test/vp/products/1'], [link, link], Array(6).fill(link)]) {
        assert.equal((await create('invalid', links)).status, 400)
      }
      assert.equal((await mutate(path.replace('/e/', '/x/') + '/drafts', { idempotencyKey: 'k', links: [link] })).status, 404)
      assert.equal(calls, 0)
      assert.equal((await app.request(`${path}/drafts`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{' })).status, 400)
      assert.equal((await app.request(`${path}/drafts`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'text/plain' }, body: '{}' })).status, 415)
      assert.equal((await mutate(`${path}/drafts`, { idempotencyKey: 'huge', links: [link], extra: 'x'.repeat(33000) })).status, 413)
    })
    await t.test('creates a private draft with server identity, sources, snapshot and creation history', async () => {
      const response = await create()
      assert.equal(response.status, 201)
      assert.equal(response.headers.get('Cache-Control'), 'no-store')
      const { request } = await response.json()
      id = request.id; itemId = request.items[0].id
      assert.equal(request.requesterId, 'p')
      assert.equal(request.departmentId, 'p')
      assert.equal(request.status, 'draft')
      assert.equal(request.version, 1)
      assert.equal(request.items[0].estimatedUnitPrice, 11590)
      assert.equal(request.estimatedTotal, null)
      assert.deepEqual(request.sources.map((m: { id: string }) => m.id), ['m'])
      assert.equal(request.history[0].action, 'created')
    })
    await t.test('same key returns original request, changed input conflicts without a new AI call', async () => {
      const response = await create()
      assert.equal(response.status, 200)
      assert.equal((await response.json()).request.id, id)
      assert.equal((await create('key-1', [link.replace('7746622155', '7746622156')])).status, 409)
      assert.equal(calls, 1)
    })
    await t.test('finance and another event cannot see or mutate a draft', async () => {
      userId = 'f'
      assert.deepEqual((await (await app.request(path)).json()).requests, [])
      assert.equal((await app.request(`${path}/${id}`)).status, 404)
      assert.equal((await mutate(`${path}/${id}/discard`, { version: 1 })).status, 404)
      userId = 'p'
      assert.equal((await app.request(`${path.replace('/e/', '/e2/')}/${id}`)).status, 404)
      assert.equal((await app.request(`${path}/${id}`)).status, 200)
    })
    await t.test('strict editable fields, real dates and positive quantities are enforced', async () => {
      for (const body of [
        { version: 1, status: 'approved' }, { version: 1, neededBy: '2026-02-30' },
        { version: 1, items: [{ id: itemId, quantity: 0 }] }, { version: 1, estimatedShippingCost: -1 },
        { version: 1, items: [{ id: itemId, productSnapshot: {} }] }, { version: 1 },
      ]) assert.equal((await mutate(`${path}/${id}`, body, 'PATCH')).status, 400)
      const response = await mutate(`${path}/${id}`, { version: 1, purpose: '수정 목적', estimatedShippingCost: 0, items: [{ id: itemId, quantity: 3 }] }, 'PATCH')
      assert.equal(response.status, 200)
      const { request } = await response.json()
      assert.equal(request.version, 2)
      assert.equal(request.estimatedTotal, 34770)
      assert.deepEqual(request.items[0].productSnapshot, { price: 11590 })
      assert.equal(request.history[1].action, 'updated')
      assert.equal((await mutate(`${path}/${id}`, { version: 1, purpose: 'stale' }, 'PATCH')).status, 409)
    })
    await t.test('concurrent edits yield one success and one conflict with one new history row', async () => {
      const responses = await Promise.all(['one', 'two'].map(purpose => mutate(`${path}/${id}`, { version: 2, purpose }, 'PATCH')))
      assert.deepEqual(responses.map(r => r.status).sort(), [200, 409])
      assert.equal((await pg.query('SELECT id FROM purchase_request_history WHERE request_id=$1', [id])).rows.length, 3)
    })
    await t.test('discard is terminal and retained, never a physical delete', async () => {
      assert.equal((await mutate(`${path}/${id}/discard`, { version: 3 })).status, 200)
      const { request } = await (await app.request(`${path}/${id}`)).json()
      assert.equal(request.status, 'discarded')
      assert.equal(request.version, 4)
      assert.equal(request.items.length, 1)
      assert.equal((await mutate(`${path}/${id}`, { version: 4, purpose: 'no' }, 'PATCH')).status, 409)
      assert.equal((await mutate(`${path}/${id}/discard`, { version: 4 })).status, 409)
      assert.equal((await create()).status, 200)
      assert.equal(calls, 1)
    })
    await t.test('generator failures and foreign source IDs save no partial rows', async () => {
      for (const mode of ['fail', 'foreign-source'] as const) {
        behavior = mode
        const response = await create(mode)
        assert.equal(response.status, 502)
        assert.ok(!(await response.text()).includes('secret-provider-error'))
      }
      assert.equal((await pg.query('SELECT id FROM purchase_requests')).rows.length, 1)
      behavior = 'ok'
    })
    await t.test('in-flight duplicate generation does not call AI twice, and failure releases the guard', async () => {
      behavior = 'blocked'
      blocked = new Promise<void>(resolve => { release = resolve })
      const entered = new Promise<void>(resolve => { started = resolve })
      const first = create('in-flight')
      await entered
      const count = calls
      try {
        assert.equal((await create('in-flight')).status, 409)
        assert.equal((await create('another-key')).status, 409)
        assert.equal(calls, count)
      } finally { release() }
      assert.equal((await first).status, 502)
      behavior = 'fail'
      assert.equal((await create('in-flight')).status, 502)
      assert.equal(calls, count + 1)
      behavior = 'ok'
    })
    await t.test('history write failure rolls back generated request and items', async () => {
      await pg.exec(`CREATE FUNCTION reject_purchase_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fail'; END $$;
        CREATE TRIGGER reject_purchase_history BEFORE INSERT ON purchase_request_history FOR EACH ROW EXECUTE FUNCTION reject_purchase_history();`)
      try { assert.equal((await create('rollback')).status, 500) }
      finally { await pg.exec('DROP TRIGGER reject_purchase_history ON purchase_request_history; DROP FUNCTION reject_purchase_history();') }
      assert.equal((await pg.query('SELECT id FROM purchase_requests')).rows.length, 1)
      assert.equal((await pg.query('SELECT id FROM purchase_items')).rows.length, 1)
    })
    await t.test('revoking membership during AI work prevents persistence and further reads', async () => {
      behavior = 'revoke'
      assert.equal((await create('revoked')).status, 403)
      assert.equal((await pg.query('SELECT id FROM purchase_requests')).rows.length, 1)
      assert.equal((await app.request(path)).status, 403)
    })
    await t.test('submission validates saved fields, ownership and version; records once and freezes edits', async () => {
      await pg.exec("INSERT INTO memberships(id,user_id,organization_id,department_id) VALUES ('p','p','a','p')")
      behavior = 'ok'; userId = 'p'
      const { request: initial } = await (await create('submit')).json()
      const target = `${path}/${initial.id}`
      let version = initial.version
      const patch = async (fields: object) => {
        const response = await mutate(target, { version, ...fields }, 'PATCH')
        assert.equal(response.status, 200)
        version = (await response.json()).request.version
      }
      userId = null
      assert.equal((await mutate(`${target}/submit`, { version })).status, 401)
      userId = 'x'
      assert.equal((await mutate(`${target}/submit`, { version })).status, 403)
      userId = 'f'
      assert.equal((await mutate(`${target}/submit`, { version })).status, 404)
      userId = 'p'
      assert.equal((await mutate(`${target.replace('/e/', '/e2/')}/submit`, { version })).status, 404)
      assert.equal((await mutate(`${target}/submit`, { version }, 'POST', 'https://evil.test')).status, 403)
      assert.equal((await mutate(`${target}/submit`, { version, purpose: 'injected' })).status, 400)
      const itemKey = initial.items[0].id
      for (const [missing, restore] of [
        [{ purpose: null }, { purpose: '행사 접수' }],
        [{ neededBy: null }, { neededBy: '2026-10-09' }],
        [{ items: [{ id: itemKey, productName: null }] }, { items: [{ id: itemKey, productName: '테이블' }] }],
        [{ items: [{ id: itemKey, quantity: null }] }, { items: [{ id: itemKey, quantity: 2 }] }],
        [{ items: [{ id: itemKey, optionRequired: null }] }, { items: [{ id: itemKey, optionRequired: true }] }],
        [{ items: [{ id: itemKey, selectedOption: null }] }, { items: [{ id: itemKey, selectedOption: '화이트' }] }],
      ]) {
        await patch(missing!)
        const response = await mutate(`${target}/submit`, { version })
        assert.equal(response.status, 400)
        assert.equal((await response.json()).error, 'SUBMISSION_INCOMPLETE')
        assert.equal((await (await app.request(target)).json()).request.version, version)
        await patch(restore!)
      }
      await patch({ estimatedShippingCost: null, items: [{ id: itemKey, estimatedUnitPrice: null, optionRequired: false, selectedOption: null }] })
      assert.equal((await mutate(`${target}/submit`, { version: version - 1 })).status, 409)
      await pg.exec(`CREATE FUNCTION reject_submit_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fail'; END $$;
        CREATE TRIGGER reject_submit_history BEFORE INSERT ON purchase_request_history FOR EACH ROW EXECUTE FUNCTION reject_submit_history();`)
      try { assert.equal((await mutate(`${target}/submit`, { version })).status, 500) }
      finally { await pg.exec('DROP TRIGGER reject_submit_history ON purchase_request_history; DROP FUNCTION reject_submit_history();') }
      assert.equal((await (await app.request(target)).json()).request.status, 'draft')
      const responses = await Promise.all([1, 2].map(() => mutate(`${target}/submit`, { version })))
      assert.deepEqual(responses.map(r => r.status).sort(), [200, 409])
      const { request: submitted } = await (await app.request(target)).json()
      assert.equal(submitted.status, 'submitted')
      assert.equal(submitted.version, version + 1)
      assert.equal(submitted.estimatedTotal, null)
      const entries = submitted.history.filter((entry: { action: string }) => entry.action === 'submitted')
      assert.equal(entries.length, 1)
      assert.equal(entries[0].actorId, 'p')
      assert.ok(Number.isFinite(Date.parse(entries[0].createdAt)))
      assert.equal((await mutate(target, { version: submitted.version, purpose: 'no' }, 'PATCH')).status, 409)
      assert.equal((await mutate(`${target}/discard`, { version: submitted.version })).status, 409)
      assert.equal((await mutate(`${path}/${id}/submit`, { version: 4 })).status, 409)
    })
    await t.test('finance inbox exposes submitted requests only and rechecks role on every read', async () => {
      const inbox = `${path}/finance`
      const rows = await pg.query<{id: string}>('SELECT id FROM purchase_requests WHERE status=$1', ['submitted'])
      const submittedId = rows.rows[0]!.id
      userId = null
      assert.equal((await app.request(inbox)).status, 401)
      userId = 'p'
      assert.equal((await app.request(inbox)).status, 403)
      userId = 'x'
      assert.equal((await app.request(inbox)).status, 403)
      userId = 'f'
      const response = await app.request(inbox)
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('Cache-Control'), 'no-store')
      assert.deepEqual((await response.json()).requests.map((r: {id: string}) => r.id), [submittedId])
      const detail = await (await app.request(`${inbox}/${submittedId}`)).json()
      assert.equal(detail.request.items.length, 1)
      assert.equal(detail.request.sources[0].id, 'm')
      assert.equal((await app.request(`${inbox}/${id}`)).status, 404)
      userId = 'p'
      const { request: privateDraft } = await (await create('private-finance-test')).json()
      userId = 'f'
      assert.equal((await app.request(`${inbox}/${privateDraft.id}`)).status, 404)
      assert.equal((await app.request(`${inbox}?before=${privateDraft.id}`)).status, 400)
      assert.equal((await app.request(`${inbox.replace('/e/', '/e2/')}/${submittedId}`)).status, 404)
      assert.equal((await mutate(`${path}/${submittedId}/discard`, { version: detail.request.version })).status, 404)
      for (const status of ['approved', 'rejected']) {
        await pg.query('UPDATE purchase_requests SET status=$1 WHERE id=$2', [status, submittedId])
        assert.equal((await (await app.request(`${inbox}/${submittedId}`)).json()).request.status, status)
      }
      await pg.exec(`INSERT INTO purchase_requests(id,organization_id,event_id,requester_id,department_id,idempotency_key,status)
        SELECT 'page-'||n, 'a', 'e', 'p', 'p', 'page-'||n, 'submitted' FROM generate_series(1,51) AS n;`)
      const first = await (await app.request(inbox)).json()
      assert.equal(first.requests.length, 50)
      assert.ok(first.nextCursor)
      const second = await (await app.request(`${inbox}?before=${first.nextCursor}`)).json()
      assert.equal(second.requests.length, 2)
      assert.equal(second.nextCursor, null)
      assert.equal(new Set([...first.requests, ...second.requests].map(r => r.id)).size, 52)
      assert.ok([...first.requests, ...second.requests].every(r => ['submitted', 'approved', 'rejected'].includes(r.status)))
      await pg.exec("UPDATE departments SET handles_finance=false WHERE id='f'")
      assert.equal((await app.request(inbox)).status, 403)
      assert.equal((await app.request(`${inbox}/${submittedId}`)).status, 403)
    })
    await t.test('finance decisions are authorized, atomic, versioned and terminal; requester sees the reason', async () => {
      const target = `${path}/finance/page-1/decision`
      const approval = { version: 1, decision: 'approved' }
      userId = null
      assert.equal((await mutate(target, approval)).status, 401)
      for (const user of ['p', 'x', 'f']) {
        userId = user
        assert.equal((await mutate(target, approval)).status, 403)
      }
      await pg.exec("UPDATE departments SET handles_finance=true WHERE id='f'")
      assert.equal((await mutate(target, approval, 'POST', 'https://evil.test')).status, 403)
      assert.equal((await mutate(target.replace('/e/', '/e2/'), approval)).status, 404)
      for (const body of [{ version: 1, decision: 'rejected' }, { version: 1, decision: 'rejected', reason: '  ' },
        { version: 1, decision: 'rejected', reason: 'a'.repeat(2001) }, { ...approval, actorId: 'p' }, { version: 1, decision: 'draft' }]) {
        assert.equal((await mutate(target, body)).status, 400)
      }
      assert.equal((await mutate(target, { ...approval, version: 2 })).status, 409)
      assert.equal((await mutate(`${path}/finance/${id}/decision`, { version: 4, decision: 'approved' })).status, 404)
      await pg.exec(`CREATE FUNCTION reject_decision_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fail'; END $$;
        CREATE TRIGGER reject_decision_history BEFORE INSERT ON purchase_request_history FOR EACH ROW EXECUTE FUNCTION reject_decision_history();`)
      try { assert.equal((await mutate(target, approval)).status, 500) }
      finally { await pg.exec('DROP TRIGGER reject_decision_history ON purchase_request_history; DROP FUNCTION reject_decision_history();') }
      const results = await Promise.all([mutate(target, approval), mutate(target, { version: 1, decision: 'rejected', reason: '예산 초과' })])
      assert.deepEqual(results.map(r => r.status).sort(), [200, 409])
      const { request } = await (await app.request(`${path}/finance/page-1`)).json()
      assert.equal(request.version, 2)
      assert.equal(request.history.length, 1)
      assert.equal(request.history[0].actorId, 'f')
      assert.equal(request.history[0].action, request.status)
      assert.ok(Number.isFinite(Date.parse(request.history[0].createdAt)))
      assert.equal((await mutate(target, { ...approval, version: 2 })).status, 409)
      const approved = await mutate(`${path}/finance/page-3/decision`, approval)
      assert.equal(approved.status, 200)
      const approvedBody = await approved.json()
      assert.equal(approvedBody.request.status, 'approved')
      assert.equal(approvedBody.request.history[0].reason, null)
      const rejected = await mutate(`${path}/finance/page-2/decision`, { version: 1, decision: 'rejected', reason: '  수량 재확인  ' })
      assert.equal(rejected.status, 200)
      userId = 'p'
      const own = await (await app.request(`${path}/page-2`)).json()
      assert.equal(own.request.status, 'rejected')
      assert.equal(own.request.history[0].reason, '수량 재확인')
      assert.equal((await mutate(`${path}/page-2`, { version: 2, purpose: 'no' }, 'PATCH')).status, 409)
      assert.equal((await mutate(`${path}/page-2/submit`, { version: 2 })).status, 409)
    })
  } finally { await pg.close() }
})
