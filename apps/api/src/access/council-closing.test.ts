import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PublicRegistrationForm, RoomListResponse } from '@vada/contracts'
import { appModulesOf } from '../app-modules.js'
import { createApp } from '../app.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { createPurchaseWriteLimiter } from '../purchases/write-limit.js'
import { createRecord } from '../records/records.js'
import { addUser, seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { fakeStorage } from '../test-support/storage.js'

// 학생회 그만두기(기능 021 조각 9, 정한 것 15, DEC-55): 그만둔다고 알린 학생회는 읽기만 된다.
// 두 학생회를 같은 모양으로 두고 한쪽만 표시해, 학생회 거르기가 빠지면 다른 학생회의 쓰기가 막혀 시험이 실패하게 한다.
const NOON = new Date('2026-10-25T03:00:00Z')
const MISSING = '019e0000-0000-7000-8000-000000000000'
const CODES = { s: 'SSSS2345', o: 'QQQQ2345' }
const FORM_CODES = { s: 'SFRM2345', o: 'QFRM2345' }
const SETTINGS = {
  unit: 'department',
  schoolName: '한양대학교 ERICA',
  titles: { president: '회장', vicePresident: '부회장', head: '부장', viceHead: '부부장' },
}

async function seed(testDb: TestDb) {
  const { db, pg } = testDb
  const councils = { s: await seedCouncil(db, pg, 's'), o: await seedCouncil(db, pg, 'o') }
  for (const key of ['s', 'o'] as const) {
    const council = councils[key]
    await pg.query('INSERT INTO invite_code (council_id, code, created_by) VALUES ($1, $2, $3)', [
      council.councilId,
      CODES[key],
      council.people.president.memberId,
    ])
    await db.transaction(async tx => {
      const eventId = await createRecord(tx, {
        kind: 'event',
        councilId: council.councilId,
        actor: council.people.president.memberId,
        values: { name: '가을 축제' },
      })
      await createRecord(tx, {
        kind: 'registration_form',
        councilId: council.councilId,
        actor: council.people.president.memberId,
        values: {
          eventId,
          name: '신청',
          closesAt: new Date('2026-11-01T09:00:00Z'),
          publicCode: FORM_CODES[key],
          collectsStudentId: false,
        },
      })
    })
  }
  await addUser(pg, 'newcomer')
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      ...appModulesOf(db, testSession, {
        clock: () => NOON,
        writeLimiter: createPurchaseWriteLimiter(),
        receiptKey: 'test-receipt-key',
        storage: fakeStorage().storage,
      }),
    }),
  )
  const base = (key: 's' | 'o') => `/api/organizations/${councils[key].councilId}`
  // 방은 처음 읽을 때 만든다. 표시하기 전에 읽어 둔다.
  const roomOf = async (key: 's' | 'o') => {
    const response = await api.get(`${base(key)}/rooms`, `${key}-president`)
    assert.equal(response.status, 200)
    return ((await response.json()) as RoomListResponse).rooms[0]!.id
  }
  const rooms = { s: await roomOf('s'), o: await roomOf('o') }
  const setClosing = (at: string | null) =>
    pg.query('UPDATE council SET closing_requested_at = $2 WHERE id = $1', [
      councils.s.councilId,
      at,
    ])
  return { api, councils, base, rooms, setClosing }
}
type Kit = Awaited<ReturnType<typeof seed>>

async function withSeed(run: (kit: Kit) => Promise<void>) {
  const testDb = await createTestDb()
  try {
    await run(await seed(testDb))
  } finally {
    await testDb.close()
  }
}

const errorOf = async (response: Response) => ((await response.json()) as { error: string }).error

// 학생회 하나에 보내는 바꾸기들. 권한을 본 뒤 잠그고 바꾸는 길(authorizeChange)과 잠그지 않는 길(대화 보내기, 사진·증빙 올리기 주소)을 함께 본다.
function writesOf({ api, base, rooms }: Kit, key: 's' | 'o') {
  const user = (name: string) => `${key}-${name}`
  return [
    [
      '학생회 설정',
      () =>
        api.post(
          `${base(key)}/settings`,
          { name: `${key} 새 이름`, ...SETTINGS },
          user('president'),
        ),
    ],
    [
      '행사 만들기',
      () => api.post(`${base(key)}/events`, { name: '겨울 축제' }, user('president')),
    ],
    [
      '대화 보내기',
      () =>
        api.post(`${base(key)}/rooms/${rooms[key]}/messages`, { body: '안녕' }, user('president')),
    ],
    [
      '사진 올리기 주소',
      () => api.post(`${base(key)}/rooms/${rooms[key]}/uploads`, {}, user('president')),
    ],
    [
      '증빙 올리기 주소',
      () => api.post(`${base(key)}/expenses/${MISSING}/uploads`, {}, user('financeMember')),
    ],
  ] as const
}

test('그만두는 학생회의 바꾸기는 모두 409 COUNCIL_CLOSING이고 읽기는 된다. 다른 학생회와 운영진이 아닌 사람은 그대로다', () =>
  withSeed(async kit => {
    const { api, base, setClosing } = kit
    await setClosing(NOON.toISOString())
    for (const [name, send] of writesOf(kit, 's')) {
      const response = await send()
      assert.equal(response.status, 409, name)
      assert.equal(await errorOf(response), 'COUNCIL_CLOSING', name)
    }
    for (const path of ['', '/rooms', '/events'])
      assert.equal((await api.get(`${base('s')}${path}`, 's-president')).status, 200, path)
    // 운영진이 아니면 학생회가 그만두는지 드러내지 않는다(403이 먼저다).
    const outsider = await api.post(
      `${base('s')}/settings`,
      { name: '남의 학생회', ...SETTINGS },
      'o-president',
    )
    assert.equal(outsider.status, 403)
    // 다른 학생회는 그대로 쓴다. 증빙은 없는 지출이라 404다(학생회가 열려 있으면 권한 다음의 검사로 간다).
    const expected = [200, 201, 201, 200, 404]
    for (const [index, [name, send]] of writesOf(kit, 'o').entries())
      assert.equal((await send()).status, expected[index], name)
  }))

test('그만두는 학생회의 공개 신청 양식은 마감과 같고, 초대 코드는 404다. 이어 쓰면 다시 된다', () =>
  withSeed(async kit => {
    const { api, setClosing } = kit
    const apply = (key: 's' | 'o') =>
      api.post(`/api/public/registration-forms/${FORM_CODES[key]}/apply`, {
        commandId: crypto.randomUUID(),
        name: '김학생',
      })
    const statusOf = async (key: 's' | 'o') =>
      (
        (await (
          await api.get(`/api/public/registration-forms/${FORM_CODES[key]}`)
        ).json()) as PublicRegistrationForm
      ).status
    await setClosing(NOON.toISOString())
    assert.equal(await statusOf('s'), 'closed')
    const closed = await apply('s')
    assert.equal(closed.status, 409)
    assert.equal(await errorOf(closed), 'REGISTRATION_NOT_OPEN')
    assert.equal((await api.get(`/api/invites/${CODES.s}`, 'newcomer')).status, 404)
    assert.equal(
      (await api.post('/api/organizations/join', { code: CODES.s }, 'newcomer')).status,
      404,
    )
    // 다른 학생회는 그대로다.
    assert.equal(await statusOf('o'), 'open')
    assert.equal((await apply('o')).status, 201)
    assert.equal((await api.get(`/api/invites/${CODES.o}`, 'newcomer')).status, 200)

    await setClosing(null)
    assert.equal(await statusOf('s'), 'open')
    assert.equal((await apply('s')).status, 201)
    assert.equal((await api.get(`/api/invites/${CODES.s}`, 'newcomer')).status, 200)
    assert.equal(
      (await api.post('/api/organizations/join', { code: CODES.s }, 'newcomer')).status,
      200,
    )
    for (const [name, send] of writesOf(kit, 's').slice(0, 3))
      assert.ok((await send()).status < 300, name)
  }))
