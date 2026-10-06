import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { createEventRoutes } from './events.js'
import { createAccessRoutes } from '../access/access.js'
import { createApp } from '../app.js'

test('event API validates input and shares events only within the authenticated council', async (t) => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('p','Planner','p@test.local'),('f','Finance','f@test.local'),('x','Other','x@test.local');
      INSERT INTO organizations (id,name) VALUES ('a','A'),('b','B');
      INSERT INTO departments (id,organization_id,name,handles_finance) VALUES ('p','a','Planning',false),('f','a','Finance',true),('x','b','Other',false);
      INSERT INTO memberships (id,user_id,organization_id,department_id) VALUES ('p','p','a','p'),('f','f','a','f'),('x','x','b','x');
    `)
    let userId: string | null = null
    const session = async () => userId ? { user: { id: userId } } : null
    const origin = 'http://127.0.0.1:5180'
    const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, access: createAccessRoutes(db, session), events: createEventRoutes(db, session) })
    const path = '/api/organizations/a/events'
    const post = (body: unknown, target = path, requestOrigin = origin) => app.request(target, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: requestOrigin }, body: JSON.stringify(body),
    })
    await t.test('anonymous and other-council users cannot read or create', async () => {
      assert.equal((await app.request(path)).status, 401)
      assert.equal((await post({ name: 'Event' })).status, 401)
      userId = 'x'
      assert.equal((await app.request(path)).status, 403)
      assert.equal((await post({ name: 'Event' })).status, 403)
    })
    await t.test('invalid input and cross-site mutations do not create events', async () => {
      userId = 'p'
      for (const body of [null, [], {}, { name: 1 }, { name: '' }, { name: ' \t\n ' },
        { name: 'a'.repeat(101) }, { name: '😀'.repeat(101) }, { name: 'a\u0000b' }, { name: '\ud800' }, { name: 'Event', extra: 1 }]) {
        assert.equal((await post(body)).status, 400)
      }
      assert.deepEqual(await (await post({ name: 'a\u0000b' })).json(), { error: 'INVALID_INPUT' })
      assert.equal((await app.request(path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{' })).status, 400)
      assert.equal((await post({ name: 'Event' }, path, 'https://evil.test')).status, 403)
      assert.equal((await app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"name":"Event"}' })).status, 403)
      assert.equal((await app.request(path, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'text/plain' }, body: '{"name":"Event"}' })).status, 415)
      assert.deepEqual(await (await app.request(path)).json(), { events: [] })
    })
    await t.test('creation trims names and takes identity and council from the session', async () => {
      const response = await post({ name: '  Festival  ' })
      assert.equal(response.status, 201)
      const { event } = await response.json()
      assert.equal(event.name, 'Festival')
      assert.equal(event.createdBy, 'p')
      assert.equal(event.organizationId, 'a')
      assert.ok(event.id)
      assert.ok(Number.isFinite(Date.parse(event.createdAt)))
      const rooms = await pg.query('SELECT organization_id, event_id FROM chat_rooms WHERE event_id=$1', [event.id])
      assert.deepEqual(rooms.rows, [{ organization_id: 'a', event_id: event.id }])
      await pg.query("UPDATE events SET created_at='2020-01-01' WHERE id=$1", [event.id])
      await assert.rejects(pg.query("INSERT INTO events (id,organization_id,name,created_by) VALUES ('long','a',repeat('a',101),'p')"))
    })
    await t.test('finance can create duplicate names and both departments see latest-first events', async () => {
      userId = 'f'
      const { event } = await (await post({ name: 'Festival' })).json()
      assert.equal(event.createdBy, 'f')
      const response = await app.request(path)
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('Cache-Control'), 'no-store')
      const body = await response.json()
      assert.equal(body.events.length, 2)
      assert.equal(body.events[0].id, event.id)
      userId = 'p'
      assert.deepEqual(await (await app.request(path)).json(), body)
      assert.equal((await app.request('/api/me/memberships')).status, 200)
      assert.equal((await app.request('/api/organizations/b/events')).status, 403)
      assert.equal((await post({ name: 'No' }, '/api/organizations/missing/events')).status, 403)
      assert.equal((await post({ name: '😀'.repeat(100) })).status, 201)
      userId = 'x'
      assert.deepEqual(await (await app.request('/api/organizations/b/events')).json(), { events: [] })
    })
    await t.test('a room insertion failure rolls back the event too', async () => {
      userId = 'p'
      const before = await pg.query('SELECT id FROM events ORDER BY id')
      await pg.exec(`CREATE FUNCTION reject_test_room() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test room failure'; END $$;
        CREATE TRIGGER reject_test_room BEFORE INSERT ON chat_rooms FOR EACH ROW EXECUTE FUNCTION reject_test_room();`)
      try {
        assert.equal((await post({ name: 'Must roll back' })).status, 500)
        assert.deepEqual((await pg.query('SELECT id FROM events ORDER BY id')).rows, before.rows)
      } finally {
        await pg.exec('DROP TRIGGER reject_test_room ON chat_rooms; DROP FUNCTION reject_test_room();')
      }
    })
    await t.test('removing membership immediately revokes read and create', async () => {
      userId = 'p'
      await pg.exec("DELETE FROM memberships WHERE id='p'")
      assert.equal((await app.request(path)).status, 403)
      assert.equal((await post({ name: 'No' })).status, 403)
    })
  } finally {
    await pg.close()
  }
})
