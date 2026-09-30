import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { createAccessRoutes } from './access.js'
import { Hono } from 'hono'

test('membership access uses authenticated identity and current database membership', async (t) => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('planner','Planner','p@example.test'),('finance','Finance','f@example.test'),('outsider','Outsider','o@example.test');
      INSERT INTO organizations (id,name) VALUES ('org1','Council 1'),('org2','Council 2');
      INSERT INTO departments (id,organization_id,name,handles_finance) VALUES ('d1','org1','Finance',false),('d2','org1','Operations',true),('d3','org2','Planning',false);
      INSERT INTO memberships (id,user_id,organization_id,department_id) VALUES ('m1','planner','org1','d1'),('m2','finance','org1','d2');
    `)
    let userId: string | null = null
    const routes = createAccessRoutes(db, async () => userId ? { user: { id: userId } } : null)
    await t.test('access middleware does not intercept unrelated routes registered after it', async () => {
      let sessionReads = 0
      const app = new Hono()
      app.route('/api', createAccessRoutes(db, async () => { sessionReads++; return null }))
      app.get('/api/public', c => c.json({ public: true }))
      assert.equal((await app.request('/api/public')).status, 200)
      assert.equal((await app.request('/api/unknown')).status, 404)
      assert.equal(sessionReads, 0)
    })
    await t.test('anonymous requests return 401', async () => {
      for (const path of ['/me/memberships', '/organizations/org1/membership']) {
        assert.equal((await routes.request(path)).status, 401)
      }
    })
    await t.test('authenticated but unassigned users have no membership or organization access', async () => {
      userId = 'outsider'
      assert.deepEqual(await (await routes.request('/me/memberships')).json(), { memberships: [] })
      assert.equal((await routes.request('/organizations/org1/membership')).status, 403)
    })
    await t.test('client-supplied identity cannot override the session', async () => {
      userId = 'planner'
      const response = await routes.request('/me/memberships?userId=finance', { headers: { 'X-User-Id': 'finance' } })
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('Cache-Control'), 'no-store')
      assert.deepEqual(await response.json(), { memberships: [{ id: 'm1', organization: { id: 'org1', name: 'Council 1' }, department: { id: 'd1', name: 'Finance', handlesFinance: false } }] })
      assert.equal((await routes.request('/organizations/org1/membership')).status, 200)
      assert.equal((await routes.request('/organizations/org2/membership')).status, 403)
      assert.equal((await routes.request('/organizations/missing/membership')).status, 403)
    })
    await t.test('finance capability comes from the database flag, not the department name', async () => {
      userId = 'finance'
      const response = await routes.request('/organizations/org1/membership')
      const body = await response.json() as { membership: { department: { handlesFinance: boolean } } }
      assert.equal(body.membership.department.handlesFinance, true)
    })
    await t.test('membership removal takes effect without changing the login session', async () => {
      await pg.query("DELETE FROM memberships WHERE id='m2'")
      assert.equal((await routes.request('/organizations/org1/membership')).status, 403)
    })
  } finally {
    await pg.close()
  }
})
