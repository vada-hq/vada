import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CouncilView, CreateCouncilResponse, InviteCodeResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { createInviteRoutes } from '../invites/routes.js'
import { createRecord } from '../records/records.js'
import { addUser } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createCouncilRoutes } from './routes.js'

const body = {
  name: '컴퓨터학부 학생회',
  unit: 'department',
  schoolName: '한양대학교 ERICA',
  year: 2026,
}
const settings = {
  name: '소프트웨어학부 학생회',
  unit: 'college',
  schoolName: '한양대학교 ERICA',
  titles: { president: '위원장', vicePresident: '부위원장', head: '국장', viceHead: '차장' },
}

// 회장 u1의 학생회에 u2가 들어온다. u3은 다른 학생회의 회장이다.
async function setup(testDb: TestDb) {
  const clock = () => new Date('2026-10-19T03:00:00Z')
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      councils: createCouncilRoutes(testDb.db, testSession, clock),
      invites: createInviteRoutes(testDb.db, testSession, clock),
    }),
  )
  for (const user of ['u1', 'u2', 'u3']) await addUser(testDb.pg, user)
  const { council } = (await (
    await api.post('/api/organizations/create', body, 'u1')
  ).json()) as CreateCouncilResponse
  const { code } = (await (
    await api.get(`/api/organizations/${council.id}/invite`, 'u1')
  ).json()) as InviteCodeResponse
  await api.post('/api/organizations/join', { code }, 'u2')
  await api.post('/api/organizations/create', { ...body, name: '경영학부 학생회' }, 'u3')
  return { api, council, base: `/api/organizations/${council.id}` }
}

test('학생회 정보와 직급 표시 이름은 회장단이 고치고, 모든 운영진이 본다. 바뀐 것이 없으면 판을 만들지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base, council } = await setup(testDb)
    const response = await api.post(`${base}/settings`, settings, 'u1')
    assert.equal(response.status, 200)
    const view = (await response.json()) as CouncilView
    assert.deepEqual(view.council, { id: council.id, ...settings })
    assert.deepEqual(
      ((await (await api.get(base, 'u2')).json()) as CouncilView).council.titles,
      settings.titles,
    )
    assert.equal((await api.post(`${base}/settings`, settings, 'u1')).status, 200)
    const versions = await testDb.pg.query<{ name: string; president_title: string }>(
      "SELECT data->>'name' AS name, data->>'president_title' AS president_title FROM record_version WHERE record_id = $1 ORDER BY version_no",
      [council.id],
    )
    assert.deepEqual(versions.rows, [
      { name: '컴퓨터학부 학생회', president_title: '회장' },
      { name: '소프트웨어학부 학생회', president_title: '위원장' },
    ])
  } finally {
    await testDb.close()
  }
})

test('지금 기수의 이름과 기간은 회장단이 고친다. 임기 시작이 오늘 뒤면 409 COHORT_NOT_STARTED이고, 끝 날짜는 지나도 된다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base } = await setup(testDb)
    const view = (await (
      await api.post(
        `${base}/cohort`,
        { name: '제38대', startsOn: '2026-03-01', endsOn: '2027-02-28' },
        'u1',
      )
    ).json()) as CouncilView
    assert.deepEqual(
      { ...view.cohort, id: undefined },
      { id: undefined, name: '제38대', startsOn: '2026-03-01', endsOn: '2027-02-28' },
    )
    const outside = await api.post(
      `${base}/cohort`,
      { name: '제39대', startsOn: '2027-03-01', endsOn: '2028-02-29' },
      'u1',
    )
    assert.equal(outside.status, 409)
    assert.deepEqual(await outside.json(), { error: 'COHORT_NOT_STARTED' })
    assert.equal(((await (await api.get(base, 'u2')).json()) as CouncilView).cohort.name, '제38대')
    // 끝 날짜가 오늘 전이어도 받고, 모두 계속 연다(DEC-57).
    const ended = { name: '제38대', startsOn: '2026-03-01', endsOn: '2026-08-31' }
    assert.equal((await api.post(`${base}/cohort`, ended, 'u1')).status, 200)
    assert.deepEqual(
      { ...((await (await api.get(base, 'u2')).json()) as CouncilView).cohort, id: undefined },
      { id: undefined, ...ended },
    )
  } finally {
    await testDb.close()
  }
})

test('지금 기수의 시작일을 이미 시작한 다른 기수보다 앞으로 옮기면 409 COHORT_NOT_LATEST다(지난 기수가 다시 지금 기수가 되지 않게)', async () => {
  const testDb = await createTestDb()
  try {
    const { api, council, base } = await setup(testDb)
    // 지금 기수는 2026(2026-01-01~2026-12-31)이고, 앞에 끝난 2025 기수가 있다.
    await testDb.db.transaction(tx =>
      createRecord(tx, {
        kind: 'cohort',
        councilId: council.id,
        actor: null,
        values: { name: '2025', startsOn: '2025-01-01', endsOn: '2025-06-30' },
      }),
    )
    // 기간이 겹치지 않아 EXCLUDE에 걸리지 않지만, 옮기면 2025 기수가 가장 늦게 시작한 기수가 된다.
    const moved = await api.post(
      `${base}/cohort`,
      { name: '2026', startsOn: '2024-01-01', endsOn: '2024-06-30' },
      'u1',
    )
    assert.equal(moved.status, 409)
    assert.deepEqual(await moved.json(), { error: 'COHORT_NOT_LATEST' })
    const view = (await (await api.get(base, 'u2')).json()) as CouncilView
    assert.deepEqual(
      { ...view.cohort, id: undefined },
      { id: undefined, name: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' },
    )
    // 앞 기수 뒤로는 시작일을 앞당길 수 있다.
    const earlier = { name: '2026', startsOn: '2025-07-01', endsOn: '2026-12-31' }
    assert.equal((await api.post(`${base}/cohort`, earlier, 'u1')).status, 200)
    assert.equal(
      ((await (await api.get(base, 'u2')).json()) as CouncilView).cohort.startsOn,
      '2025-07-01',
    )
  } finally {
    await testDb.close()
  }
})

test('기수를 같은 값으로 다시 저장하면 판을 만들지 않고, 바뀐 값만 새 판을 만든다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base } = await setup(testDb)
    const same = { name: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' }
    const cohortId = ((await (await api.get(base, 'u1')).json()) as CouncilView).cohort.id
    const versions = async () =>
      (
        await testDb.pg.query<{ count: number }>(
          'SELECT count(*)::int AS count FROM record_version WHERE record_id = $1',
          [cohortId],
        )
      ).rows[0]?.count
    assert.equal(await versions(), 1)
    assert.equal((await api.post(`${base}/cohort`, same, 'u1')).status, 200)
    assert.equal(await versions(), 1)
    const changed = { ...same, name: '제38대' }
    assert.equal((await api.post(`${base}/cohort`, changed, 'u1')).status, 200)
    assert.equal(await versions(), 2)
    assert.equal((await api.post(`${base}/cohort`, changed, 'u1')).status, 200)
    assert.equal(await versions(), 2)
  } finally {
    await testDb.close()
  }
})

test('권한이 없으면 기간이 어긋난 본문이어도 409보다 403이 먼저다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base } = await setup(testDb)
    const outside = { name: '제39대', startsOn: '2027-03-01', endsOn: '2028-02-29' }
    // u2는 운영진이지만 회장단이 아니고, u3은 다른 학생회의 회장이다.
    for (const user of ['u2', 'u3'])
      assert.equal((await api.post(`${base}/cohort`, outside, user)).status, 403, user)
    assert.equal((await api.post(`${base}/cohort`, outside)).status, 401)
    assert.equal((await api.post(`${base}/cohort`, outside, 'u1')).status, 409)
  } finally {
    await testDb.close()
  }
})

test('설정과 기수는 회장단만 바꾼다. 형식이 틀리면 400, 로그인하지 않으면 401이다', async () => {
  const testDb = await createTestDb()
  try {
    const { api, base } = await setup(testDb)
    const cohort = { name: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' }
    for (const user of ['u2', 'u3']) {
      assert.equal((await api.post(`${base}/settings`, settings, user)).status, 403, user)
      assert.equal((await api.post(`${base}/cohort`, cohort, user)).status, 403, user)
    }
    assert.equal((await api.post(`${base}/settings`, settings)).status, 401)
    for (const payload of [
      { ...settings, titles: { ...settings.titles, head: '' } },
      { ...settings, titles: undefined },
      { ...settings, unit: 'club' },
      { ...settings, name: '😀'.repeat(51) },
      { ...settings, schoolName: 'a\u0000' },
      { ...settings, extra: 1 },
    ]) {
      assert.equal(
        (await api.post(`${base}/settings`, payload, 'u1')).status,
        400,
        JSON.stringify(payload),
      )
    }
    for (const payload of [
      { ...cohort, endsOn: '2026-01-01' },
      { ...cohort, name: '\uD800' },
      { ...cohort, startsOn: '2026-02-30' },
      { name: '2026' },
    ]) {
      assert.equal(
        (await api.post(`${base}/cohort`, payload, 'u1')).status,
        400,
        JSON.stringify(payload),
      )
    }
  } finally {
    await testDb.close()
  }
})
