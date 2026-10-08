import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { createApp } from '../app.js'
import { createOrganizationRoutes } from './routes.js'

const origin = 'http://127.0.0.1:5180'
type Body = Record<string, unknown>

async function setup() {
  const pg = new PGlite()
  const db = drizzle(pg)
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
  await pg.exec(`
    INSERT INTO users (id,name,email) VALUES ('lead','김바다','lead@example.test'),('treasurer','김민준','treasurer@example.test'),
      ('newbie','정하늘','newbie@example.test'),('other','다른 학생회','other@example.test'),('loner','혼자','loner@example.test');
    INSERT INTO organizations (id,name,invite_code) VALUES ('org1','Council 1','AAAA2222'),('org2','Council 2','BBBB3333');
    INSERT INTO departments (id,organization_id,name,is_leadership,handles_finance) VALUES
      ('lead1','org1','회장단',true,false),('fin1','org1','총무부',false,true),('plan1','org1','기획부',false,false),
      ('lead2','org2','회장단',true,false),('plan2','org2','기획부',false,false);
    INSERT INTO memberships (id,user_id,organization_id,department_id,title) VALUES
      ('m-lead','lead','org1','lead1','회장'),('m-treasurer','treasurer','org1','fin1','총무'),('m-newbie','newbie','org1',NULL,NULL),
      ('m-other','other','org2','lead2',NULL);
  `)
  let userId: string | null = 'lead'
  let sessionReads = 0
  const session = async () => { sessionReads++; return userId ? { user: { id: userId } } : null }
  const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, organization: createOrganizationRoutes(db, session) })
  const send = (method: string, path: string, body: unknown) => app.request(`/api${path}`, { method,
    headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { pg, send, get: (path: string) => app.request(`/api${path}`), as: (id: string | null) => { userId = id }, sessionReads: () => sessionReads }
}

test('학생회를 만들면 만든 사람이 회장단이 되고, 고른 부서가 생긴다', async () => {
  const { pg, send, as } = await setup()
  try {
    as('loner')
    const response = await send('POST', '/organizations/create', { name: ' 제12대 학생회 ',
      departments: [{ name: ' 총무부 ', handlesFinance: true }, { name: '기획부', handlesFinance: false }] })
    assert.equal(response.status, 201)
    const { membership } = await response.json()
    assert.equal(membership.organization.name, '제12대 학생회')
    assert.match(membership.organization.inviteCode, /^[2-9A-HJ-NP-Z]{8}$/)
    assert.deepEqual({ ...membership.department, id: 'x' }, { id: 'x', name: '회장단', isLeadership: true, handlesFinance: false })
    assert.equal(membership.title, null)
    assert.deepEqual(membership.permissions, { manageOrganization: true, approvePurchases: true })
    const rows = await pg.query('SELECT name, is_leadership, handles_finance FROM departments WHERE organization_id = $1 ORDER BY name', [membership.organization.id])
    assert.deepEqual(rows.rows, [
      { name: '기획부', is_leadership: false, handles_finance: false },
      { name: '총무부', is_leadership: false, handles_finance: true },
      { name: '회장단', is_leadership: true, handles_finance: false },
    ])
    const empty = await send('POST', '/organizations/create', { name: '빈 학생회', departments: [] })
    assert.equal(empty.status, 201)
    const created = await empty.json()
    const count = await pg.query<{ n: number }>('SELECT count(*)::int AS n FROM departments WHERE organization_id = $1', [created.membership.organization.id])
    assert.equal(count.rows[0]?.n, 1)
    as(null)
    assert.equal((await send('POST', '/organizations/create', { name: '학생회', departments: [] })).status, 401)
  } finally {
    await pg.close()
  }
})

test('형식이 틀린 본문은 인증 전에 400이다', async () => {
  const { pg, send, sessionReads } = await setup()
  try {
    const long = (max: number) => '😀'.repeat(max + 1)
    const cases: [string, string, Body[]][] = [
      ['POST', '/organizations/create', [{}, { name: '', departments: [] }, { name: '   ', departments: [] }, { name: long(50), departments: [] },
        { name: 'a\u0000', departments: [] }, { name: '\uD800', departments: [] }, { name: '학생회', departments: [], extra: 1 },
        { name: '학생회', departments: [{ name: '기획부', handlesFinance: false }, { name: '기획부', handlesFinance: false }] },
        { name: '학생회', departments: [{ name: '회장단', handlesFinance: false }] }]],
      ['POST', '/organizations/org1/departments', [{}, { name: '' }, { name: '  ' }, { name: long(20) }, { name: 'a\u0000' }, { name: '\uD800' }, { name: '홍보부', extra: 1 }]],
      ['PATCH', '/organizations/org1/departments/plan1', [{ name: '기획국' }, { name: '', handlesFinance: false }, { name: long(20), handlesFinance: false },
        { name: '기획국', handlesFinance: false, extra: 1 }]],
      ['POST', '/organizations/org1/departments/plan1/delete', [{ extra: 1 }]],
      ['POST', '/organizations/org1/members/m-newbie/department', [{}, { departmentId: '' }, { departmentId: 'd'.repeat(65) }, { departmentId: 'd\u0001' },
        { departmentId: null, extra: 1 }]],
      ['POST', '/organizations/org1/members/m-newbie/title', [{}, { title: '' }, { title: '  ' }, { title: long(20) }, { title: 'a\u0000' }, { title: '\uD800' },
        { title: null, extra: 1 }]],
    ]
    const before = sessionReads()
    for (const [method, path, bodies] of cases) {
      for (const body of bodies) {
        const response = await send(method, path, body)
        assert.equal(response.status, 400, `${method} ${path} ${JSON.stringify(body)}`)
        assert.deepEqual(await response.json(), { error: 'INVALID_INPUT' })
      }
    }
    assert.equal(sessionReads(), before)
  } finally {
    await pg.close()
  }
})

test('구성원 목록은 같은 학생회 소속만 보고, 이메일은 없다', async () => {
  const { pg, get, as } = await setup()
  try {
    as(null)
    assert.equal((await get('/organizations/org1/members')).status, 401)
    as('other')
    assert.equal((await get('/organizations/org1/members')).status, 403)
    as('newbie')
    const response = await get('/organizations/org1/members')
    assert.equal(response.status, 200)
    const text = await response.text()
    assert.equal(text.includes('@example.test'), false)
    const body = JSON.parse(text)
    assert.deepEqual(body.viewer.permissions, { manageOrganization: false, approvePurchases: false })
    assert.deepEqual(body.departments.map((department: { id: string }) => department.id), ['fin1', 'lead1', 'plan1'])
    assert.deepEqual(body.members, [
      { id: 'm-lead', name: '김바다', title: '회장', departmentId: 'lead1' },
      { id: 'm-newbie', name: '정하늘', title: null, departmentId: null },
      { id: 'm-treasurer', name: '김민준', title: '총무', departmentId: 'fin1' },
    ])
  } finally {
    await pg.close()
  }
})

test('회장단이 아니면 조직을 바꿀 수 없다', async () => {
  const { pg, send, as } = await setup()
  try {
    const changes: [string, string, Body][] = [
      ['POST', '/organizations/org1/departments', { name: '홍보부' }],
      ['PATCH', '/organizations/org1/departments/plan1', { name: '기획국', handlesFinance: false }],
      ['POST', '/organizations/org1/departments/plan1/delete', {}],
      ['POST', '/organizations/org1/members/m-newbie/department', { departmentId: 'plan1' }],
      ['POST', '/organizations/org1/members/m-newbie/title', { title: '국장' }],
    ]
    for (const user of ['treasurer', 'newbie', 'other']) {
      as(user)
      for (const [method, path, body] of changes) assert.equal((await send(method, path, body)).status, 403, `${user} ${method} ${path}`)
    }
    as(null)
    for (const [method, path, body] of changes) assert.equal((await send(method, path, body)).status, 401, `${method} ${path}`)
    const departments = await pg.query<{ n: number }>("SELECT count(*)::int AS n FROM departments WHERE organization_id = 'org1'")
    assert.equal(departments.rows[0]?.n, 3)
  } finally {
    await pg.close()
  }
})

test('회장단은 부서를 추가·변경·삭제하고, 규칙에 어긋나면 409다', async () => {
  const { pg, send } = await setup()
  try {
    const added = await send('POST', '/organizations/org1/departments', { name: ' 홍보부 ' })
    assert.equal(added.status, 200)
    const addedBody = await added.json()
    const promo = addedBody.departments.find((department: { name: string }) => department.name === '홍보부')
    assert.deepEqual({ ...promo, id: 'x' }, { id: 'x', name: '홍보부', isLeadership: false, handlesFinance: false })
    assert.deepEqual(addedBody.viewer.permissions, { manageOrganization: true, approvePurchases: true })
    for (const name of ['기획부', ' 기획부 ', '회장단']) {
      const response = await send('POST', '/organizations/org1/departments', { name })
      assert.equal(response.status, 409, name)
      assert.deepEqual(await response.json(), { error: 'DEPARTMENT_NAME_TAKEN' })
    }
    const renamed = await send('PATCH', '/organizations/org1/departments/plan1', { name: '기획국', handlesFinance: true })
    assert.equal(renamed.status, 200)
    assert.deepEqual((await renamed.json()).departments.find((department: { id: string }) => department.id === 'plan1'),
      { id: 'plan1', name: '기획국', isLeadership: false, handlesFinance: true })
    assert.equal((await send('PATCH', '/organizations/org1/departments/plan1', { name: '기획국', handlesFinance: false })).status, 200)
    assert.deepEqual(await (await send('PATCH', '/organizations/org1/departments/plan1', { name: '총무부', handlesFinance: false })).json(),
      { error: 'DEPARTMENT_NAME_TAKEN' })
    assert.equal((await send('PATCH', '/organizations/org1/departments/lead1', { name: '비상대책위원회', handlesFinance: false })).status, 200)
    const fixed = await send('PATCH', '/organizations/org1/departments/lead1', { name: '비상대책위원회', handlesFinance: true })
    assert.equal(fixed.status, 409)
    assert.deepEqual(await fixed.json(), { error: 'LEADERSHIP_FIXED' })
    for (const id of ['plan2', 'missing', '%00', 'd'.repeat(65)]) {
      assert.equal((await send('PATCH', `/organizations/org1/departments/${id}`, { name: '새 이름', handlesFinance: false })).status, 404, id)
      assert.equal((await send('POST', `/organizations/org1/departments/${id}/delete`, {})).status, 404, id)
    }
    const remove = (id: string) => send('POST', `/organizations/org1/departments/${id}/delete`, {})
    assert.deepEqual(await (await remove('lead1')).json(), { error: 'LEADERSHIP_FIXED' })
    assert.deepEqual(await (await remove('fin1')).json(), { error: 'DEPARTMENT_NOT_EMPTY' })
    await pg.exec(`
      INSERT INTO events (id,organization_id,name,created_by) VALUES ('e1','org1','Festival','lead');
      INSERT INTO purchase_requests (id,organization_id,event_id,requester_id,department_id,idempotency_key) VALUES ('r1','org1','e1','lead','plan1','k1');
    `)
    const inUse = await remove('plan1')
    assert.equal(inUse.status, 409)
    assert.deepEqual(await inUse.json(), { error: 'DEPARTMENT_IN_USE' })
    const deleted = await remove(promo.id)
    assert.equal(deleted.status, 200)
    assert.equal((await deleted.json()).departments.some((department: { id: string }) => department.id === promo.id), false)
  } finally {
    await pg.close()
  }
})

test('배정은 직책을 지우고, 마지막 회장단은 옮길 수 없으며, 넘긴 뒤에는 관리할 수 없다', async () => {
  const { pg, send } = await setup()
  try {
    const assign = (membershipId: string, departmentId: string | null) =>
      send('POST', `/organizations/org1/members/${membershipId}/department`, { departmentId })
    const title = (membershipId: string, value: string | null) => send('POST', `/organizations/org1/members/${membershipId}/title`, { title: value })
    const memberOf = async (response: Response, id: string) => (await response.json()).members.find((member: { id: string }) => member.id === id)
    assert.deepEqual(await memberOf(await assign('m-newbie', 'plan1'), 'm-newbie'), { id: 'm-newbie', name: '정하늘', title: null, departmentId: 'plan1' })
    assert.deepEqual(await memberOf(await title('m-newbie', ' 국장 '), 'm-newbie'), { id: 'm-newbie', name: '정하늘', title: '국장', departmentId: 'plan1' })
    assert.equal((await memberOf(await assign('m-newbie', 'plan1'), 'm-newbie')).title, '국장')
    assert.deepEqual(await memberOf(await assign('m-newbie', 'fin1'), 'm-newbie'), { id: 'm-newbie', name: '정하늘', title: null, departmentId: 'fin1' })
    assert.equal((await memberOf(await assign('m-newbie', null), 'm-newbie')).departmentId, null)
    assert.equal((await memberOf(await title('m-lead', null), 'm-lead')).title, null)
    for (const [membershipId, departmentId] of [['m-newbie', 'plan2'], ['m-newbie', 'missing'], ['m-other', 'plan1'], ['missing', 'plan1'], ['%00', 'plan1']] as const) {
      assert.equal((await assign(membershipId, departmentId)).status, 404, `${membershipId} ${departmentId}`)
    }
    assert.equal((await title('m-other', '회장')).status, 404)
    const last = await assign('m-lead', 'plan1')
    assert.equal(last.status, 409)
    assert.deepEqual(await last.json(), { error: 'LAST_LEADER' })
    assert.equal((await assign('m-newbie', 'lead1')).status, 200)
    const handover = await assign('m-lead', 'plan1')
    assert.equal(handover.status, 200)
    const body = await handover.json()
    assert.deepEqual(body.viewer.permissions, { manageOrganization: false, approvePurchases: false })
    assert.equal(body.viewer.department.id, 'plan1')
    assert.equal((await send('POST', '/organizations/org1/departments', { name: '홍보부' })).status, 403)
    const leaders = await pg.query<{ n: number }>("SELECT count(*)::int AS n FROM memberships WHERE department_id = 'lead1'")
    assert.equal(leaders.rows[0]?.n, 1)
  } finally {
    await pg.close()
  }
})
