import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { createEventRoutes } from './events.js'
import { createAccessRoutes } from '../access/access.js'
import { createApp } from '../app.js'
import type { EventResponse, EventsResponse } from '@vada/contracts'
import { setupPurchases } from '../purchases/test-setup.js'
import { refused as refusedWith } from '../registrations/test-setup.js'

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
      // 새 행사는 완료하지 않았다(M5a).
      assert.equal(event.completedAt, null)
      assert.ok(event.id)
      assert.ok(Number.isFinite(Date.parse(event.createdAt)))
      const rooms = await pg.query('SELECT organization_id, event_id FROM chat_rooms WHERE event_id=$1', [event.id])
      assert.deepEqual(rooms.rows, [{ organization_id: 'a', event_id: event.id }])
      await pg.query("UPDATE events SET created_at='2020-01-01' WHERE id=$1", [event.id])
      await assert.rejects(pg.query("INSERT INTO events (id,organization_id,name,created_by) VALUES ('long','a',repeat('a',101),'p')"),
        (error: { code?: string; constraint?: string }) => error.code === '23514' && error.constraint === 'events_name_length')
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

test('행사 정보 수정: 부서가 있는 구성원이 일시·장소를 고치고, 참가 신청이 있으면 시작을 비우거나 마감보다 일찍 끝낼 수 없다', async () => {
  const pg = new PGlite()
  try {
    const db = drizzle(pg)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../migrations', import.meta.url)) })
    await pg.exec(`
      INSERT INTO users (id,name,email) VALUES ('p','Planner','p@test.local'),('n','New','n@test.local'),('x','Other','x@test.local');
      INSERT INTO organizations (id,name) VALUES ('a','A'),('b','B');
      INSERT INTO departments (id,organization_id,name) VALUES ('p','a','Planning'),('x','b','Other');
      INSERT INTO memberships (id,user_id,organization_id,department_id) VALUES ('p','p','a','p'),('n','n','a',NULL),('x','x','b','x');
      INSERT INTO events (id,organization_id,name,created_by) VALUES ('e','a','체육대회','p'),('ex','b','남의 행사','x');
    `)
    let userId: string | null = 'p'
    const session = async () => userId ? { user: { id: userId } } : null
    const origin = 'http://127.0.0.1:5180'
    const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, events: createEventRoutes(db, session) })
    const patch = (body: unknown, event = 'e') => app.request(`/api/organizations/a/events/${event}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) })
    const refused = async (pending: Response | Promise<Response>, status: number, error: string) => {
      const response = await pending
      assert.equal(response.status, status, error)
      assert.deepEqual(await response.json(), { error }, error)
    }
    const info = { version: 1, startsAt: '2026-08-20T10:00', endsAt: '2026-08-20T18:00', place: '  체육관 ', ownerDepartmentId: null,
      ownerMembershipId: null }

    const listed = await (await app.request('/api/organizations/a/events')).json() as EventsResponse
    assert.deepEqual(listed.events.map(event => [event.startsAt, event.endsAt, event.place, event.version, event.completedAt]), [[null, null, null, 1, null]])
    // 본문이 틀리면 인증 전에 거절한다.
    userId = null
    for (const body of [{}, { ...info, startsAt: null }, { ...info, place: 'a'.repeat(101) }, { ...info, place: '😀'.repeat(101) },
      { ...info, place: '   ' }, { ...info, place: `a${String.fromCharCode(0)}b` }, { ...info, place: `a${String.fromCharCode(0xd800)}` },
      { ...info, endsAt: '2026-08-20T09:00' }, { ...info, extra: 1 }]) await refused(patch(body), 400, 'INVALID_INPUT')
    assert.equal((await patch(info)).status, 401)
    // 미배정 구성원과 다른 학생회 사용자는 고치지 못한다.
    for (const user of ['n', 'x']) { userId = user; await refused(patch(info), 403, 'FORBIDDEN') }
    userId = 'p'
    // 다른 학생회 행사, 없는 행사, 제어 문자나 너무 긴 ID는 모두 찾을 수 없다.
    for (const event of ['ex', 'missing', '%00', 'a'.repeat(65)]) await refused(patch(info, event), 404, 'NOT_FOUND')

    const response = await patch(info)
    assert.equal(response.status, 200)
    const { event } = await response.json() as EventResponse
    assert.deepEqual([event.startsAt, event.endsAt, event.place, event.version], ['2026-08-20T10:00', '2026-08-20T18:00', '체육관', 2])
    const { rows } = await pg.query<{ starts_at: Date }>("SELECT starts_at FROM events WHERE id = 'e'")
    assert.equal(rows[0]!.starts_at.toISOString(), '2026-08-20T01:00:00.000Z')
    await refused(patch(info), 409, 'VERSION_CONFLICT')

    // 참가 신청이 있으면 시작을 비울 수 없고, 마감보다 일찍 끝낼 수 없다.
    await pg.exec("INSERT INTO registration_forms (id,organization_id,event_id,closes_at,created_by) VALUES ('f','a','e','2026-08-20T18:00+09','p')")
    await refused(patch({ ...info, version: 2, startsAt: null, endsAt: null, place: null }), 409, 'EVENT_TIME_REQUIRED')
    await refused(patch({ ...info, version: 2, endsAt: '2026-08-20T17:00' }), 409, 'DEADLINE_AFTER_EVENT')
    await refused(patch({ ...info, version: 2, startsAt: '2026-08-20T17:00', endsAt: null }), 409, 'DEADLINE_AFTER_EVENT')
    // 끝이 없으면 시작이 행사 끝이다. 마감과 같아도 된다.
    const moved = await patch({ ...info, version: 2, startsAt: '2026-08-20T18:00', endsAt: null, place: null })
    assert.equal(moved.status, 200)
    assert.deepEqual(((await moved.json()) as EventResponse).event.place, null)
  } finally {
    await pg.close()
  }
})

test('행사 담당: 부서가 있는 구성원이 담당 부서·책임자를 정하고 비운다. 다른 학생회·없는·미배정은 고를 수 없다', async () => {
  const env = await setupPurchases()
  try {
    const info = (version: number, ownerDepartmentId: string | null, ownerMembershipId: string | null) =>
      ({ version, startsAt: null, endsAt: null, place: null, ownerDepartmentId, ownerMembershipId })
    const patch = (body: unknown) => env.request('PATCH', '/events/e', body)
    env.as('p')
    for (const id of ['dx', 'nope']) await refusedWith(patch(info(1, id, null)), 409, 'EVENT_DEPARTMENT_INVALID', id)
    for (const id of ['mn', 'mx', 'nope']) await refusedWith(patch(info(1, null, id)), 409, 'EVENT_OWNER_INVALID', id)
    const { event } = await env.ok<EventResponse>(patch(info(1, 'dp', 'mq')))
    assert.deepEqual([event.ownerDepartment, event.owner, event.version], [{ id: 'dp', name: '기획부' }, { membershipId: 'mq', name: '기획2' }, 2])
    const listed = (await env.ok<EventsResponse>(env.request('GET', '/events'))).events
    assert.deepEqual([listed.find(item => item.id === 'e')?.ownerDepartment, listed.find(item => item.id === 'e')?.owner], [event.ownerDepartment, event.owner])
    assert.deepEqual([listed.find(item => item.id === 'e2')?.ownerDepartment, listed.find(item => item.id === 'e2')?.owner], [null, null])
    // 책임자가 미배정이 되어도 그대로 둘 수 있고, 다른 미배정은 새로 고를 수 없다.
    await env.pg.exec("UPDATE memberships SET department_id = NULL WHERE id = 'mq'")
    assert.equal((await env.ok<EventResponse>(patch(info(2, 'dp', 'mq')))).event.owner?.membershipId, 'mq')
    await refusedWith(patch(info(3, null, 'mn')), 409, 'EVENT_OWNER_INVALID')
    const cleared = (await env.ok<EventResponse>(patch(info(3, null, null)))).event
    assert.deepEqual([cleared.ownerDepartment, cleared.owner], [null, null])
    // 본문 경계: 키 누락, 빈 ID, 제어 문자, 너무 긴 ID, 숫자
    for (const body of [{ version: 4, startsAt: null, endsAt: null, place: null }, info(4, '', null), info(4, null, 'a\u0000'),
      info(4, 'a'.repeat(65), null), { ...info(4, null, null), ownerMembershipId: 1 }]) {
      await refusedWith(patch(body), 400, 'INVALID_INPUT', JSON.stringify(body))
    }
    // 완료한 행사는 담당도 바꾸지 않는다(M5a 잠금).
    await env.pg.exec(`INSERT INTO event_finances(event_id, organization_id, settled_at, settled_by) VALUES ('e','a', now(), 'f');
      UPDATE events SET completed_at = now(), completed_by = 'l' WHERE id = 'e'`)
    await refusedWith(patch(info(4, 'dp', null)), 409, 'EVENT_COMPLETED')
  } finally { await env.pg.close() }
})
