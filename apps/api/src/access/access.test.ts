import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { createAccessRoutes } from './access.js'
import { Hono } from 'hono'
import { createApp } from '../app.js'
import { createEventRoutes } from '../events/events.js'

test('membership access uses authenticated identity and current database membership', async (t) => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('planner','Planner','p@example.test'),('finance','Finance','f@example.test'),('outsider','Outsider','o@example.test'),('newbie','Newbie','n@example.test');
      INSERT INTO organizations (id,name,invite_code) VALUES ('org1','Council 1','AAAA2222'),('org2','Council 2','BBBB3333');
      INSERT INTO departments (id,organization_id,name,handles_finance) VALUES ('d1','org1','Finance',false),('d2','org1','Operations',true),('d3','org2','Planning',false);
      INSERT INTO memberships (id,user_id,organization_id,department_id) VALUES ('m1','planner','org1','d1'),('m2','finance','org1','d2'),('m3','newbie','org1',NULL);
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
      assert.deepEqual(await response.json(), { memberships: [{ id: 'm1', organization: { id: 'org1', name: 'Council 1', inviteCode: 'AAAA2222' }, department: { id: 'd1', name: 'Finance', handlesFinance: false, isLeadership: false }, title: null, permissions: { manageOrganization: false, approvePurchases: false } }] })
      assert.equal((await routes.request('/organizations/org1/membership')).status, 200)
      assert.equal((await routes.request('/organizations/org2/membership')).status, 403)
      assert.equal((await routes.request('/organizations/missing/membership')).status, 403)
    })
    await t.test('finance capability comes from the database flag, not the department name', async () => {
      userId = 'finance'
      const response = await routes.request('/organizations/org1/membership')
      const body = await response.json() as { membership: { department: { handlesFinance: boolean }; permissions: { manageOrganization: boolean; approvePurchases: boolean } } }
      assert.equal(body.membership.department.handlesFinance, true)
      assert.deepEqual(body.membership.permissions, { manageOrganization: false, approvePurchases: true })
    })
    await t.test('membership removal takes effect without changing the login session', async () => {
      await pg.query("DELETE FROM memberships WHERE id='m2'")
      assert.equal((await routes.request('/organizations/org1/membership')).status, 403)
    })
    await t.test('unassigned member keeps access with a null department', async () => {
      userId = 'newbie'
      const response = await routes.request('/organizations/org1/membership')
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { membership: { id: 'm3', organization: { id: 'org1', name: 'Council 1', inviteCode: 'AAAA2222' }, department: null, title: null, permissions: { manageOrganization: false, approvePurchases: false } } })
      assert.equal((await routes.request('/organizations/org2/membership')).status, 403)
    })
  } finally {
    await pg.close()
  }
})

test('초대 코드로 미배정 구성원이 되고, 잘못된 입력은 인증 전에 거절된다', async (t) => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('member','Member','m@example.test'),('newbie','Newbie','n@example.test'),('other','Other','o@example.test');
      INSERT INTO organizations (id,name,invite_code) VALUES ('org1','Council 1','AAAA2222'),('org2','Council 2','BBBB3333');
      INSERT INTO departments (id,organization_id,name,handles_finance) VALUES ('d1','org1','Planning',false),('d2','org2','Planning',false);
      INSERT INTO memberships (id,user_id,organization_id,department_id) VALUES ('m1','member','org1','d1'),('m2','other','org2','d2');
    `)
    let userId: string | null = null
    let sessionReads = 0
    const session = async () => { sessionReads++; return userId ? { user: { id: userId } } : null }
    const origin = 'http://127.0.0.1:5180'
    const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin,
      access: createAccessRoutes(db, session), events: createEventRoutes(db, session) })
    const join = (body: unknown, requestOrigin = origin) => app.request('/api/organizations/join', { method: 'POST',
      headers: { Origin: requestOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const count = async (user: string) =>
      (await pg.query<{ n: number }>('SELECT count(*)::int AS n FROM memberships WHERE user_id = $1', [user])).rows[0]?.n

    await t.test('미인증은 401이다', async () => {
      assert.equal((await app.request('/api/invites/AAAA2222')).status, 401)
      assert.equal((await join({ code: 'AAAA2222' })).status, 401)
    })
    await t.test('본문 형식 오류는 인증보다 먼저 400이다', async () => {
      userId = 'newbie'
      const before = sessionReads
      for (const body of [{}, { code: '' }, { code: '   ' }, { code: 'A'.repeat(17) }, { code: '😀'.repeat(17) },
        { code: 'AAAA\u00002222' }, { code: '\uD800AAAA' }, { code: 'AAAA2222', extra: 1 }, { code: 1 }]) {
        const response = await join(body)
        assert.equal(response.status, 400, JSON.stringify(body))
        assert.deepEqual(await response.json(), { error: 'INVALID_INPUT' })
      }
      assert.equal(sessionReads, before)
      assert.equal(await count('newbie'), 0)
    })
    await t.test('다른 사이트에서 보낸 참여 요청은 403이다', async () => {
      assert.equal((await join({ code: 'AAAA2222' }, 'https://evil.test')).status, 403)
    })
    await t.test('모르는 코드와 형식이 틀린 경로 코드는 500이 아니라 404다', async () => {
      for (const code of ['ZZZZ9999', '%00', 'A'.repeat(17), '%E0%A4%A']) {
        const response = await app.request(`/api/invites/${code}`)
        assert.equal(response.status, 404, code)
        assert.deepEqual(await response.json(), { error: 'NOT_FOUND' })
      }
      assert.equal((await join({ code: 'ZZZZ9999' })).status, 404)
    })
    await t.test('코드를 확인하면 학생회 이름만 보이고, 소문자·하이픈도 같은 코드다', async () => {
      const response = await app.request('/api/invites/aaaa-2222')
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('Cache-Control'), 'no-store')
      assert.deepEqual(await response.json(), { organization: { id: 'org1', name: 'Council 1' }, joined: false })
    })
    await t.test('참여하면 부서 없는 소속이 생기고 학생회 라우트를 쓸 수 있다', async () => {
      const response = await join({ code: ' aaaa2222 ' })
      assert.equal(response.status, 200)
      const { membership } = await response.json() as { membership: { id: string } }
      assert.deepEqual({ ...membership, id: 'x' }, { id: 'x', organization: { id: 'org1', name: 'Council 1', inviteCode: 'AAAA2222' }, department: null, title: null, permissions: { manageOrganization: false, approvePurchases: false } })
      assert.equal((await app.request('/api/organizations/org1/events')).status, 200)
      assert.deepEqual(await (await app.request('/api/invites/AAAA2222')).json(), { organization: { id: 'org1', name: 'Council 1' }, joined: true })
    })
    await t.test('이미 소속이면 새로 만들지 않고 기존 부서를 유지한다', async () => {
      userId = 'member'
      const response = await join({ code: 'AAAA2222' })
      assert.equal(response.status, 200)
      assert.deepEqual((await response.json()).membership, { id: 'm1', organization: { id: 'org1', name: 'Council 1', inviteCode: 'AAAA2222' }, department: { id: 'd1', name: 'Planning', handlesFinance: false, isLeadership: false }, title: null, permissions: { manageOrganization: false, approvePurchases: false } })
      assert.equal(await count('member'), 1)
    })
    await t.test('동시에 두 번 보내도 소속은 하나이고, 다른 학생회 소속은 그대로다', async () => {
      userId = 'other'
      const responses = await Promise.all([join({ code: 'AAAA2222' }), join({ code: 'AAAA2222' })])
      assert.deepEqual(responses.map(response => response.status), [200, 200])
      const ids = await Promise.all(responses.map(async response => (await response.json()).membership.id))
      assert.equal(ids[0], ids[1])
      const rows = await pg.query<{ organization_id: string; department_id: string | null }>(
        "SELECT organization_id, department_id FROM memberships WHERE user_id = 'other' ORDER BY organization_id")
      assert.deepEqual(rows.rows, [{ organization_id: 'org1', department_id: null }, { organization_id: 'org2', department_id: 'd2' }])
    })
  } finally {
    await pg.close()
  }
})

test('회장단 소속은 조직 관리와 구매 승인 권한을 받고, 직책을 함께 준다', async () => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('leader','Leader','l@example.test'),('treasurer','Treasurer','t@example.test');
      INSERT INTO organizations (id,name,invite_code) VALUES ('org1','Council 1','AAAA2222');
      INSERT INTO departments (id,organization_id,name,is_leadership,handles_finance) VALUES ('lead','org1','회장단',true,false),('fin','org1','총무부',false,true);
      INSERT INTO memberships (id,user_id,organization_id,department_id,title) VALUES ('m1','leader','org1','lead','회장'),('m2','treasurer','org1','fin',NULL);
    `)
    let userId = 'leader'
    const routes = createAccessRoutes(db, async () => ({ user: { id: userId } }))
    assert.deepEqual(await (await routes.request('/organizations/org1/membership')).json(), { membership: {
      id: 'm1', organization: { id: 'org1', name: 'Council 1', inviteCode: 'AAAA2222' },
      department: { id: 'lead', name: '회장단', handlesFinance: false, isLeadership: true }, title: '회장',
      permissions: { manageOrganization: true, approvePurchases: true } } })
    userId = 'treasurer'
    const { membership } = await (await routes.request('/organizations/org1/membership')).json() as { membership: { permissions: unknown } }
    assert.deepEqual(membership.permissions, { manageOrganization: false, approvePurchases: true })
  } finally {
    await pg.close()
  }
})
