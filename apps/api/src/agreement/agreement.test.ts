import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { AgreementResponse, Terms } from '@vada/contracts'
import { createApp } from '../app.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { createCouncilRoutes } from '../councils/routes.js'
import { createInviteRoutes } from '../invites/routes.js'
import { addUser } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createAgreement } from './routes.js'

const terms: Terms = {
  termsVersion: '2026-11-01',
  privacyVersion: '2026-11-01',
  termsUrl: 'https://vada.example.test/terms',
  privacyUrl: 'https://vada.example.test/privacy',
}
// 주소 상수가 비어 있는 때(#32 전)
const noUrls: Terms = { ...terms, termsUrl: '', privacyUrl: '' }
const current = { termsVersion: terms.termsVersion, privacyVersion: terms.privacyVersion }
const council = {
  name: '컴퓨터학부 학생회',
  unit: 'department',
  schoolName: '한양대학교 ERICA',
  year: 2026,
}

async function setup(testDb: TestDb, using: Terms = terms) {
  for (const user of ['u1', 'u2']) await addUser(testDb.pg, user)
  return caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      councils: createCouncilRoutes(testDb.db, testSession),
      invites: createInviteRoutes(testDb.db, testSession),
      agreement: createAgreement(testDb.db, testSession, using),
    }),
  )
}
const rowsOf = (testDb: TestDb) =>
  testDb.pg.query<{ user_id: string; terms_version: string; privacy_version: string }>(
    'SELECT user_id, terms_version, privacy_version FROM terms_agreement ORDER BY user_id',
  )
const councilCount = async (testDb: TestDb) =>
  (await testDb.pg.query('SELECT 1 FROM council')).rows.length

test('지금 판과 주소, 동의가 필요한지, 내가 동의했는지를 준다', async () => {
  const testDb = await createTestDb()
  try {
    const api = await setup(testDb)
    const before = await api.get('/api/me/agreement', 'u1')
    assert.equal(before.status, 200)
    assert.deepEqual(await before.json(), { ...terms, required: true, agreed: false })
    assert.equal((await api.post('/api/me/agreement', current, 'u1')).status, 200)
    const after = (await (await api.get('/api/me/agreement', 'u1')).json()) as AgreementResponse
    assert.equal(after.agreed, true)
    const other = (await (await api.get('/api/me/agreement', 'u2')).json()) as AgreementResponse
    assert.equal(other.agreed, false)
  } finally {
    await testDb.close()
  }
})

test('지금 두 판을 보내면 한 줄이 남고, 같은 판을 다시 보내도 줄이 늘지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const api = await setup(testDb)
    for (let i = 0; i < 2; i++) {
      const response = await api.post('/api/me/agreement', current, 'u1')
      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), { ...terms, required: true, agreed: true })
    }
    assert.deepEqual((await rowsOf(testDb)).rows, [
      { user_id: 'u1', terms_version: '2026-11-01', privacy_version: '2026-11-01' },
    ])
  } finally {
    await testDb.close()
  }
})

test('지난 판이나 모르는 판은 409 TERMS_OUTDATED이고 아무것도 남지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const api = await setup(testDb)
    for (const body of [
      { ...current, termsVersion: '2026-10-01' },
      { ...current, privacyVersion: '2026-10-01' },
      { termsVersion: '9999-99-99', privacyVersion: '9999-99-99' },
      { termsVersion: 'abc', privacyVersion: 'abc' },
    ]) {
      const response = await api.post('/api/me/agreement', body, 'u1')
      assert.equal(response.status, 409)
      assert.deepEqual(await response.json(), { error: 'TERMS_OUTDATED' })
    }
    assert.equal((await rowsOf(testDb)).rows.length, 0)
  } finally {
    await testDb.close()
  }
})

test('동의 본문 검사: 누락, 빈 문자열과 공백, 상한+1(이모지), NUL, 홀로 쓰인 서러게이트, 모르는 키', async () => {
  const testDb = await createTestDb()
  try {
    const api = await setup(testDb)
    const bad: unknown[] = [
      {},
      { termsVersion: current.termsVersion },
      { privacyVersion: current.privacyVersion },
      { ...current, termsVersion: '' },
      { ...current, privacyVersion: '   ' },
      { ...current, termsVersion: '😀'.repeat(11) },
      { ...current, termsVersion: '2026-11-0\u0000' },
      { ...current, privacyVersion: '2026-11-0\uD800' },
      { ...current, extra: 1 },
      { ...current, termsVersion: 20261101 },
    ]
    for (const body of bad) {
      const response = await api.post('/api/me/agreement', body, 'u1')
      assert.equal(response.status, 400, JSON.stringify(body))
      assert.deepEqual(await response.json(), { error: 'INVALID_INPUT' })
    }
    assert.equal((await rowsOf(testDb)).rows.length, 0)
  } finally {
    await testDb.close()
  }
})

test('로그인하지 않으면 읽기와 동의하기 모두 401이다', async () => {
  const testDb = await createTestDb()
  try {
    const api = await setup(testDb)
    assert.equal((await api.get('/api/me/agreement')).status, 401)
    assert.equal((await api.post('/api/me/agreement', current)).status, 401)
    assert.equal((await rowsOf(testDb)).rows.length, 0)
  } finally {
    await testDb.close()
  }
})

test('동의하지 않은 계정은 /api/organizations/ 아래 만들기, 참여, 읽기가 403 TERMS_REQUIRED이고 아무것도 쓰지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const api = await setup(testDb)
    const blocked = [
      await api.post('/api/organizations/create', council, 'u1'),
      await api.post('/api/organizations/join', { code: 'ABCDEFGH' }, 'u1'),
      await api.get('/api/organizations/00000000-0000-4000-8000-000000000000', 'u1'),
      // 형식이 틀린 본문도 동의가 먼저다
      await api.post('/api/organizations/create', {}, 'u1'),
    ]
    for (const response of blocked) {
      assert.equal(response.status, 403)
      assert.deepEqual(await response.json(), { error: 'TERMS_REQUIRED' })
    }
    assert.equal(await councilCount(testDb), 0)
    assert.equal((await testDb.pg.query('SELECT 1 FROM member')).rows.length, 0)
  } finally {
    await testDb.close()
  }
})

test('동의 전에도 /api/me/ 아래와 /api/invites/는 열려 있고, 로그인하지 않으면 403이 아니라 401이다', async () => {
  const testDb = await createTestDb()
  try {
    const api = await setup(testDb)
    assert.equal((await api.get('/api/me/councils', 'u1')).status, 200)
    assert.equal((await api.get('/api/me/agreement', 'u1')).status, 200)
    // 모르는 초대 코드는 404로 답한다. 동의 때문에 막히지 않았다는 뜻이다.
    assert.equal((await api.get('/api/invites/ABCDEFGH', 'u1')).status, 404)
    assert.equal((await api.post('/api/organizations/create', council)).status, 401)
  } finally {
    await testDb.close()
  }
})

test('동의한 계정은 통과하고, 동의는 계정마다다', async () => {
  const testDb = await createTestDb()
  try {
    const api = await setup(testDb)
    await api.post('/api/me/agreement', current, 'u1')
    assert.equal((await api.post('/api/organizations/create', council, 'u1')).status, 201)
    assert.equal((await api.post('/api/organizations/create', council, 'u2')).status, 403)
    assert.equal(await councilCount(testDb), 1)
  } finally {
    await testDb.close()
  }
})

test('판 상수를 올리면 동의한 계정도 다시 403이고, 새 판에 동의하면 다시 열린다', async () => {
  const testDb = await createTestDb()
  try {
    const old = await setup(testDb)
    await old.post('/api/me/agreement', current, 'u1')
    const bumped: Terms = { ...terms, termsVersion: '2026-12-01' }
    const api = caller(
      createApp({
        auth: { handler: async () => new Response() },
        trustedOrigin: ORIGIN,
        councils: createCouncilRoutes(testDb.db, testSession),
        agreement: createAgreement(testDb.db, testSession, bumped),
      }),
    )
    assert.equal((await api.post('/api/organizations/create', council, 'u1')).status, 403)
    const state = (await (await api.get('/api/me/agreement', 'u1')).json()) as AgreementResponse
    assert.deepEqual([state.required, state.agreed], [true, false])
    assert.equal((await api.post('/api/me/agreement', current, 'u1')).status, 409)
    const next = { termsVersion: '2026-12-01', privacyVersion: terms.privacyVersion }
    assert.equal((await api.post('/api/me/agreement', next, 'u1')).status, 200)
    assert.equal((await api.post('/api/organizations/create', council, 'u1')).status, 201)
    // 옛 판 기록은 남고 새 판이 한 줄 더해진다.
    assert.equal((await rowsOf(testDb)).rows.length, 2)
  } finally {
    await testDb.close()
  }
})

test('처리방침 판만 올려도 동의한 계정은 다시 403이다', async () => {
  const testDb = await createTestDb()
  try {
    const old = await setup(testDb)
    await old.post('/api/me/agreement', current, 'u1')
    const api = caller(
      createApp({
        auth: { handler: async () => new Response() },
        trustedOrigin: ORIGIN,
        councils: createCouncilRoutes(testDb.db, testSession),
        agreement: createAgreement(testDb.db, testSession, {
          ...terms,
          privacyVersion: '2026-12-01',
        }),
      }),
    )
    const response = await api.post('/api/organizations/create', council, 'u1')
    assert.equal(response.status, 403)
    assert.deepEqual(await response.json(), { error: 'TERMS_REQUIRED' })
  } finally {
    await testDb.close()
  }
})

test('주소 상수가 비면 막지 않고 동의가 필요 없다고 주며, 동의를 보내도 남기지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const api = await setup(testDb, noUrls)
    const state = (await (await api.get('/api/me/agreement', 'u1')).json()) as AgreementResponse
    assert.deepEqual([state.required, state.agreed], [false, false])
    assert.equal((await api.post('/api/organizations/create', council, 'u1')).status, 201)
    const posted = await api.post('/api/me/agreement', current, 'u1')
    assert.equal(posted.status, 200)
    assert.equal((await rowsOf(testDb)).rows.length, 0)
  } finally {
    await testDb.close()
  }
})
