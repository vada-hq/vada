import assert from 'node:assert/strict'
import { test } from 'node:test'
import { drizzle } from 'drizzle-orm/pglite'
import type { MessagePageResponse, RoomListResponse, TeamResponse } from '@vada/contracts'
import { inCouncilChange } from '../access/authorize.js'
import { appModulesOf } from '../app-modules.js'
import { createApp } from '../app.js'
import type { SessionReader } from '../auth/require-session.js'
import { syncRooms } from '../chat/rooms.js'
import { createTestDb, type TestDb } from '../db/test-db.js'
import { createPurchaseWriteLimiter } from '../purchases/write-limit.js'
import { clockNow, createRecord } from '../records/records.js'
import { addUser, seedCouncil } from '../test-support/council.js'
import { ORIGIN } from '../test-support/http.js'
import { seedLogins, sessionIdOf, traceOf, wholeStateOf } from '../test-support/withdrawal.js'
import { withdrawAccount } from './service.js'

// 한국 시각 2026-10-25 12:00. 시험 학생회의 기수는 2026-01-01부터 12-31까지다.
const NOW = new Date('2026-10-25T03:00:00Z')
const SECOND = 1000
const HOUR = 3600 * SECOND
const DAY = 24 * HOUR
const SESSION_HEADER = 'x-test-session'
// 탈퇴 응답이 지워야 하는 로그인 쿠키(better-auth 기본 이름)와 지우지 않을 다른 쿠키
const COOKIES =
  'better-auth.session_token=signed; __Secure-better-auth.session_data=cached; theme=dark'

type Council = Awaited<ReturnType<typeof seedCouncil>>

// 로그인 세션 읽기를 better-auth처럼 sessions 표에서 한다. 탈퇴로 세션 줄이 지워지면 같은 머리로 보내도 로그인하지 않은 요청이다.
function sessionFrom(testDb: TestDb): SessionReader {
  return async headers => {
    const id = headers.get(SESSION_HEADER)
    if (!id) return null
    const { rows } = await testDb.pg.query<{ user_id: string; created_at: string }>(
      'SELECT user_id, created_at FROM sessions WHERE id = $1',
      [id],
    )
    const row = rows[0]
    return row
      ? { user: { id: row.user_id }, session: { createdAt: new Date(row.created_at) } }
      : null
  }
}

async function roomsOf(testDb: TestDb, council: Council) {
  await inCouncilChange(
    testDb.db,
    {
      userId: council.people.president.userId,
      councilId: council.councilId,
      action: 'member.manage',
      now: NOW,
    },
    (tx, actor) => syncRooms(tx, actor),
  )
}

// 시험 학생회 s와, 같은 모양의 다른 학생회 o. 모든 사람이 한 시간 전에 로그인했다.
async function withWorld(run: (kit: Awaited<ReturnType<typeof worldOf>>) => Promise<void>) {
  const testDb = await createTestDb()
  try {
    await run(await worldOf(testDb))
  } finally {
    await testDb.close()
  }
}

async function worldOf(testDb: TestDb) {
  const ours = await seedCouncil(testDb.db, testDb.pg, 's')
  const other = await seedCouncil(testDb.db, testDb.pg, 'o')
  for (const council of [ours, other]) {
    await roomsOf(testDb, council)
    await seedLogins(
      testDb.pg,
      Object.values(council.people).map(person => person.userId),
      new Date(NOW.getTime() - HOUR),
    )
  }
  const modules = appModulesOf(testDb.db, sessionFrom(testDb), {
    trustedOrigin: ORIGIN,
    clock: () => NOW,
    writeLimiter: createPurchaseWriteLimiter(),
    receiptKey: 'test-receipt-key',
  })
  const app = createApp({
    auth: { handler: async () => new Response() },
    trustedOrigin: ORIGIN,
    ...modules,
  })
  const send = (method: 'GET' | 'POST', path: string, userId?: string, body: unknown = {}) =>
    app.request(`/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        Cookie: COOKIES,
        ...(userId ? { [SESSION_HEADER]: sessionIdOf(userId) } : {}),
      },
      ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
    })
  const withdraw = (userId?: string) => send('POST', '/me/withdrawal', userId)
  const loggedInAt = (userId: string, at: Date) =>
    testDb.pg.query('UPDATE sessions SET created_at = $2 WHERE user_id = $1', [
      userId,
      at.toISOString(),
    ])
  return { ...testDb, ours, other, send, withdraw, loggedInAt }
}

const json = async <T>(response: Response): Promise<T> => {
  assert.ok(response.ok, await response.clone().text())
  return (await response.json()) as T
}

const GONE = {
  users: 0,
  sessions: 0,
  devices: 0,
  accounts: 0,
  logins: 0,
  agreed: 0,
  withdrawn_agreements: 1,
  memberships: 0,
  placements: 0,
  named_versions: 0,
  seats: 0,
  departed: 1,
}

test('탈퇴하면 그 운영진의 모든 학생회 구독을 지우고 다른 운영진의 구독은 남긴다', () =>
  withWorld(async kit => {
    const leaving = kit.ours.people.planningMember
    const staying = kit.ours.people.financeMember
    for (const [member, council, hash] of [
      [leaving.memberId, kit.ours.councilId, 'a'],
      [leaving.memberId, kit.other.councilId, 'b'],
      [staying.memberId, kit.ours.councilId, 'c'],
    ] as const)
      await kit.pg.query(
        'INSERT INTO calendar_feed (member_id, council_id, token_hash) VALUES ($1, $2, $3)',
        [member, council, hash.repeat(64)],
      )
    assert.equal((await kit.withdraw(leaving.userId)).status, 200)
    assert.deepEqual(
      (await kit.pg.query<{ member_id: string }>('SELECT member_id FROM calendar_feed')).rows,
      [{ member_id: staying.memberId }],
    )
  }))

test('미인증 탈퇴는 401이고 아무것도 바뀌지 않는다', () =>
  withWorld(async kit => {
    const before = await wholeStateOf(kit.pg)
    const response = await kit.withdraw()
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { error: 'UNAUTHENTICATED' })
    assert.deepEqual(await wholeStateOf(kit.pg), before)
  }))

test('탈퇴하면 소속이 끝나고 이름·이메일이 모든 판에서 비며 로그인 자료가 지워지고, 쿠키는 401이 된다', () =>
  withWorld(async kit => {
    const { planningMember: leaving, president } = kit.ours.people
    const org = `/organizations/${kit.ours.councilId}`
    const rooms = await json<RoomListResponse>(
      await kit.send('GET', `${org}/rooms`, president.userId),
    )
    const all = rooms.rooms.find(room => room.type === 'all_members')!.id
    await json(
      await kit.send('POST', `${org}/rooms/${all}/messages`, leaving.userId, { body: '안녕' }),
    )
    const twin = kit.other.people.planningMember
    const twinBefore = await traceOf(kit.pg, twin.userId, twin.memberId)
    const presidentBefore = await traceOf(kit.pg, president.userId, president.memberId)

    const response = await kit.withdraw(leaving.userId)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { withdrawn: true })
    const cleared = response.headers.getSetCookie()
    assert.ok(
      cleared.some(item => /^better-auth\.session_token=;.*Max-Age=0/i.test(item)),
      cleared.join('\n'),
    )
    assert.ok(
      cleared.some(item => /^__Secure-better-auth\.session_data=;.*Max-Age=0.*Secure/i.test(item)),
      cleared.join('\n'),
    )
    assert.ok(!cleared.some(item => item.startsWith('theme=')), cleared.join('\n'))

    assert.deepEqual(await traceOf(kit.pg, leaving.userId, leaving.memberId), GONE)
    // 같은 모양의 다른 학생회 사람과 같은 학생회의 다른 사람은 그대로다.
    assert.deepEqual(await traceOf(kit.pg, twin.userId, twin.memberId), twinBefore)
    assert.deepEqual(await traceOf(kit.pg, president.userId, president.memberId), presidentBefore)
    // 끝낸 소속과 운영진의 새 판은 사유 '탈퇴', 바꾼 사람 본인이다. 소속 행과 판은 남는다.
    const { rows: opened } = await kit.pg.query<{ reason: string | null; changed_by: string }>(
      `SELECT rv.reason, rv.changed_by FROM record_version rv
       WHERE upper_inf(rv.valid) AND rv.record_id IN (
         SELECT id FROM council_membership WHERE member_id = $1
         UNION ALL SELECT id FROM department_membership WHERE member_id = $1
         UNION ALL SELECT $1::uuid)`,
      [leaving.memberId],
    )
    assert.deepEqual(
      opened.map(row => [row.reason, row.changed_by]),
      [0, 1, 2].map(() => ['탈퇴', leaving.memberId]),
    )
    // 그 쿠키는 이제 로그인하지 않은 요청이다.
    assert.equal((await kit.send('GET', '/me/councils', leaving.userId)).status, 401)
    assert.equal((await kit.withdraw(leaving.userId)).status, 401)
    // 학생회 기록의 행은 남고, 만든 사람은 '떠난 운영진 1'로 보인다. 운영진 목록에서는 빠진다.
    const page = await json<MessagePageResponse>(
      await kit.send('GET', `${org}/rooms/${all}/messages`, president.userId),
    )
    assert.deepEqual(
      page.messages.map(message => [message.body, message.senderName]),
      [['안녕', '떠난 운영진 1']],
    )
    const team = await json<TeamResponse>(await kit.send('GET', `${org}/members`, president.userId))
    assert.ok(!team.members.some(member => member.id === leaving.memberId))
    assert.ok(team.members.some(member => member.name === 's president'))
    const otherTeam = await json<TeamResponse>(
      await kit.send(
        'GET',
        `/organizations/${kit.other.councilId}/members`,
        kit.other.people.president.userId,
      ),
    )
    assert.ok(otherTeam.members.some(member => member.name === 'o planningMember'))
  }))

test('로그인한 지 24시간이 넘었으면 403 REAUTH_REQUIRED이고 아무것도 바뀌지 않으며, 24시간 안이면 된다(±1초)', () =>
  withWorld(async kit => {
    const { plain, planningMember } = kit.ours.people
    await kit.loggedInAt(plain.userId, new Date(NOW.getTime() - DAY - SECOND))
    await kit.loggedInAt(planningMember.userId, new Date(NOW.getTime() - DAY + SECOND))
    const before = await wholeStateOf(kit.pg)
    const stale = await kit.withdraw(plain.userId)
    assert.equal(stale.status, 403)
    assert.deepEqual(await stale.json(), { error: 'REAUTH_REQUIRED' })
    assert.deepEqual(stale.headers.getSetCookie(), [])
    assert.deepEqual(await wholeStateOf(kit.pg), before)
    assert.equal((await kit.withdraw(planningMember.userId)).status, 200)
    assert.deepEqual(await traceOf(kit.pg, planningMember.userId, planningMember.memberId), GONE)
  }))

test('어느 학생회든 지금 기수의 회장이면 409 PRESIDENT_CANNOT_WITHDRAW이고, 넘긴 뒤에는 된다', () =>
  withWorld(async kit => {
    const { president, vicePresident, plain } = kit.ours.people
    // s의 직급 없는 운영진이 o에 들어가 o의 회장을 넘겨받는다.
    await kit.db.transaction(tx =>
      createRecord(tx, {
        kind: 'council_membership',
        councilId: kit.other.councilId,
        actor: kit.other.people.president.memberId,
        values: { memberId: plain.memberId, cohortId: kit.other.cohortId, startsAt: clockNow },
      }),
    )
    const otherOrg = `/organizations/${kit.other.councilId}`
    await json(
      await kit.send('POST', `${otherOrg}/president/transfer`, kit.other.people.president.userId, {
        memberId: plain.memberId,
      }),
    )
    const before = await wholeStateOf(kit.pg)
    for (const userId of [president.userId, plain.userId]) {
      const response = await kit.withdraw(userId)
      assert.equal(response.status, 409, userId)
      assert.deepEqual(await response.json(), { error: 'PRESIDENT_CANNOT_WITHDRAW' })
    }
    assert.deepEqual(await wholeStateOf(kit.pg), before)
    await json(
      await kit.send(
        'POST',
        `/organizations/${kit.ours.councilId}/president/transfer`,
        president.userId,
        {
          memberId: vicePresident.memberId,
        },
      ),
    )
    assert.equal((await kit.withdraw(president.userId)).status, 200)
    assert.deepEqual(await traceOf(kit.pg, president.userId, president.memberId), GONE)
  }))

test('지난 기수의 회장 직급은 막지 않는다: 지금 기수에서 회장이 아니면 지난 기수의 회장 소속도 끝낸다', async () => {
  const testDb = await createTestDb()
  try {
    // 2025 기수의 회장(p-president)이 2026 기수에는 직급 없이 있고, 2026의 회장은 p-vicePresident다.
    const past = await seedCouncil(testDb.db, testDb.pg, 'p', {
      startsOn: '2025-01-01',
      endsOn: '2025-12-31',
    })
    const { president, vicePresident } = past.people
    await testDb.db.transaction(async tx => {
      const cohortId = await createRecord(tx, {
        kind: 'cohort',
        councilId: past.councilId,
        actor: president.memberId,
        values: { name: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' },
      })
      for (const [person, councilRank] of [
        [vicePresident, 'president'],
        [president, null],
      ] as const)
        await createRecord(tx, {
          kind: 'council_membership',
          councilId: past.councilId,
          actor: president.memberId,
          values: { memberId: person.memberId, cohortId, councilRank, startsAt: clockNow },
        })
    })
    await seedLogins(testDb.pg, [president.userId], new Date(NOW.getTime() - HOUR))
    await testDb.db.transaction(tx => withdrawAccount(tx, president.userId, NOW))
    assert.deepEqual(await traceOf(testDb.pg, president.userId, president.memberId), GONE)
    const { rows } = await testDb.pg.query<{ member_id: string; name: string }>(
      `SELECT cm.member_id, co.name FROM council_membership cm JOIN cohort co ON co.id = cm.cohort_id
       WHERE cm.council_rank = 'president' AND cm.ends_at IS NULL`,
    )
    assert.deepEqual(rows, [{ member_id: vicePresident.memberId, name: '2026' }])
  } finally {
    await testDb.close()
  }
})

test('학생회에 들어간 적 없는 계정도 탈퇴하면 로그인 자료가 지워지고 동의 기록은 남는다', () =>
  withWorld(async kit => {
    await addUser(kit.pg, 'loner')
    await seedLogins(kit.pg, ['loner'], new Date(NOW.getTime() - HOUR))
    const before = await wholeStateOf(kit.pg)
    assert.equal((await kit.withdraw('loner')).status, 200)
    const after = await wholeStateOf(kit.pg)
    assert.deepEqual(
      {
        users: after.users,
        sessions: after.sessions,
        devices: after.devices,
        accounts: after.accounts,
      },
      {
        users: before.users - 1,
        sessions: before.sessions - 1,
        devices: before.devices - 1,
        accounts: before.accounts - 1,
      },
    )
    const { rows } = await kit.pg.query(
      "SELECT 1 FROM terms_agreement WHERE user_id = 'loner' AND withdrawn_at IS NOT NULL",
    )
    assert.equal(rows.length, 1)
  }))

// 넘기기와 탈퇴가 겹치지 않게, 탈퇴는 열린 소속이 있는 학생회 행을 잠근 뒤 회장인지 본다(정한 것 7).
// PGlite는 거래를 하나씩 돌리므로 잠금 순서는 보낸 쿼리의 차례로 본다. 실제 PostgreSQL의 동시 처리는 그 순서에 기댄다.
test('탈퇴는 학생회 행과 계정 행을 잠근 뒤에 회장인지 본다', async () => {
  const testDb = await createTestDb()
  try {
    const queries: string[] = []
    const logged = drizzle(testDb.pg, { logger: { logQuery: query => void queries.push(query) } })
    const ours = await seedCouncil(testDb.db, testDb.pg, 's')
    await seedLogins(testDb.pg, [ours.people.plain.userId], new Date(NOW.getTime() - HOUR))
    await logged.transaction(tx => withdrawAccount(tx, ours.people.plain.userId, NOW))
    const councilLock = queries.findIndex(
      query => query.includes('from "council"') && query.endsWith(' for no key update'),
    )
    const userLock = queries.findIndex(
      query => query.includes('from "users"') && query.endsWith(' for update'),
    )
    const presidentRead = queries.findIndex(query => query.includes('"council_rank" = $'))
    assert.ok(councilLock >= 0, '학생회 행 잠금이 없다')
    assert.ok(userLock > councilLock, '계정 잠금이 학생회 잠금보다 앞선다')
    assert.ok(presidentRead > userLock, '회장인지 보는 것이 잠금보다 앞선다')
  } finally {
    await testDb.close()
  }
})

test('탈퇴와 회장 넘기기를 함께 보내도 회장 없는 학생회가 생기지 않는다', () =>
  withWorld(async kit => {
    const { president, planningMember } = kit.ours.people
    const [transfer, withdrawal] = await Promise.all([
      kit.send(
        'POST',
        `/organizations/${kit.ours.councilId}/president/transfer`,
        president.userId,
        {
          memberId: planningMember.memberId,
        },
      ),
      kit.withdraw(planningMember.userId),
    ])
    assert.ok(
      [
        [200, 409],
        [404, 200],
      ].some(([a, b]) => transfer.status === a && withdrawal.status === b),
      `${transfer.status} ${withdrawal.status}`,
    )
    const { rows } = await kit.pg.query<{ member_id: string }>(
      `SELECT cm.member_id FROM council_membership cm JOIN cohort co ON co.id = cm.cohort_id
       JOIN member_login ml ON ml.member_id = cm.member_id
       WHERE co.council_id = $1 AND cm.council_rank = 'president' AND cm.ends_at IS NULL`,
      [kit.ours.councilId],
    )
    assert.equal(rows.length, 1)
  }))
