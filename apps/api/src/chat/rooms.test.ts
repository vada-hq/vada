import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CreateCouncilResponse, InviteCodeResponse, TeamResponse } from '@vada/contracts'
import { actorOf } from '../access/actor.js'
import { createApp } from '../app.js'
import { createCouncilRoutes } from '../councils/routes.js'
import { createTestDb } from '../db/test-db.js'
import { createInviteRoutes } from '../invites/routes.js'
import { createRecord } from '../records/records.js'
import { createTeamRoutes } from '../team/routes.js'
import { joinedAtOf, roomMap } from '../test-support/chat.js'
import { addUser, seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { ensureCouncilRooms, syncRooms } from './rooms.js'

const now = new Date('2026-10-19T03:00:00Z')

async function start() {
  const testDb = await createTestDb()
  const { pg, db } = testDb
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      councils: createCouncilRoutes(db, testSession, () => now),
      invites: createInviteRoutes(db, testSession, () => now),
      team: createTeamRoutes(db, testSession, () => now),
    }),
  )
  for (const [id, name] of [
    ['kim', '김회장'],
    ['lee', '이운영'],
  ] as const)
    await addUser(pg, id, { name, email: `${id}@example.test` })
  const created = (await (
    await api.post(
      '/api/organizations/create',
      {
        name: '컴퓨터학부 학생회',
        unit: 'department',
        schoolName: '한양대학교 ERICA',
        cohortName: '2026',
        startsOn: '2026-01-01',
        endsOn: '2026-12-31',
      },
      'kim',
    )
  ).json()) as CreateCouncilResponse
  const councilId = created.council.id
  const base = `/api/organizations/${councilId}`
  const { code } = (await (await api.get(`${base}/invite`, 'kim')).json()) as InviteCodeResponse
  const memberOf = async (user: string) =>
    (
      await pg.query<{ member_id: string }>(
        'SELECT member_id FROM member_login WHERE user_id = $1',
        [user],
      )
    ).rows[0]!.member_id
  const join = async (user: string) =>
    assert.equal((await api.post('/api/organizations/join', { code }, user)).status, 200)
  const team = async () => (await (await api.get(`${base}/members`, 'kim')).json()) as TeamResponse
  const post = async (path: string, body: unknown) =>
    assert.equal((await api.post(`${base}${path}`, body, 'kim')).status, 200)
  return { testDb, pg, db, api, councilId, base, join, memberOf, team, post }
}

test('학생회를 만들면 전체방과 회장단방이 생기고 회장이 둘 다에 들어간다. 부서방은 아직 없다', async () => {
  const s = await start()
  try {
    assert.deepEqual(await roomMap(s.pg, s.councilId), {
      all: ['김회장'],
      leadership: ['김회장'],
    })
  } finally {
    await s.testDb.close()
  }
})

test('초대로 들어오면 전체방에만 들어가고 들어온 시각은 그때다', async () => {
  const s = await start()
  try {
    await s.join('lee')
    assert.deepEqual(await roomMap(s.pg, s.councilId), {
      all: ['김회장', '이운영'],
      leadership: ['김회장'],
    })
    const kimAt = await joinedAtOf(s.pg, s.councilId, 'all', '김회장')
    const leeAt = await joinedAtOf(s.pg, s.councilId, 'all', '이운영')
    assert.ok(kimAt && leeAt && leeAt > kimAt)
    // 이미 들어온 사람이 다시 눌러도 그대로다.
    await s.join('lee')
    assert.equal(await joinedAtOf(s.pg, s.councilId, 'all', '이운영'), leeAt)
  } finally {
    await s.testDb.close()
  }
})

test('첫 부서원을 넣으면 부서방이 생기고, 빼면 그 줄만 지워지며, 직급만 바꾸면 들어온 시각이 그대로다', async () => {
  const s = await start()
  try {
    await s.join('lee')
    const lee = await s.memberOf('lee')
    const finance = (await s.team()).departments[0]!.id
    await s.post(`/members/${lee}/departments`, { departmentId: finance, rank: null })
    assert.deepEqual((await roomMap(s.pg, s.councilId))['dept:재정부'], ['이운영'])
    const at = await joinedAtOf(s.pg, s.councilId, 'dept:재정부', '이운영')
    await s.post(`/members/${lee}/departments`, { departmentId: finance, rank: 'head' })
    assert.equal(await joinedAtOf(s.pg, s.councilId, 'dept:재정부', '이운영'), at)
    await s.post(`/members/${lee}/departments/${finance}/remove`, {})
    const rooms = await roomMap(s.pg, s.councilId)
    assert.deepEqual(rooms['dept:재정부'], [])
    assert.deepEqual(rooms.all, ['김회장', '이운영'])
    // 방은 하나뿐이다: 다시 넣어도 새 방이 생기지 않고 새 시각으로 들어온다.
    await s.post(`/members/${lee}/departments`, { departmentId: finance, rank: null })
    const count = await s.pg.query("SELECT 1 FROM chat_room WHERE type = 'department'")
    assert.equal(count.rows.length, 1)
    assert.notEqual(await joinedAtOf(s.pg, s.councilId, 'dept:재정부', '이운영'), at)
  } finally {
    await s.testDb.close()
  }
})

test('부회장을 주고 거두거나 회장을 넘기면 회장단방 참여가 따라 바뀐다', async () => {
  const s = await start()
  try {
    await s.join('lee')
    const lee = await s.memberOf('lee')
    await s.post(`/members/${lee}/rank`, { rank: 'vice_president' })
    assert.deepEqual((await roomMap(s.pg, s.councilId)).leadership, ['김회장', '이운영'])
    await s.post(`/members/${lee}/rank`, { rank: null })
    assert.deepEqual((await roomMap(s.pg, s.councilId)).leadership, ['김회장'])
    await s.post(`/members/${lee}/rank`, { rank: 'vice_president' })
    // 회장을 넘기면 넘긴 사람은 직급이 없어지고 회장단방에서 빠진다.
    await s.post('/president/transfer', { memberId: lee })
    assert.deepEqual((await roomMap(s.pg, s.councilId)).leadership, ['이운영'])
  } finally {
    await s.testDb.close()
  }
})

test('내보내면 1:1을 뺀 모든 참여가 지워지고 방과 남의 참여는 남는다', async () => {
  const s = await start()
  try {
    await s.join('lee')
    const lee = await s.memberOf('lee')
    const kim = await s.memberOf('kim')
    const finance = (await s.team()).departments[0]!.id
    await s.post(`/members/${lee}/departments`, { departmentId: finance, rank: null })
    await s.post(`/members/${lee}/rank`, { rank: 'vice_president' })
    const direct = await s.db.transaction(tx =>
      createRecord(tx, {
        kind: 'chat_room',
        councilId: s.councilId,
        actor: kim,
        values: { type: 'direct' },
      }),
    )
    await s.pg.query(
      'INSERT INTO room_membership (room_id, member_id, joined_at) VALUES ($1, $2, now()), ($1, $3, now())',
      [direct, kim, lee],
    )
    await s.post(`/members/${lee}/remove`, {})
    const rooms = await roomMap(s.pg, s.councilId)
    assert.deepEqual(rooms.all, ['김회장'])
    assert.deepEqual(rooms.leadership, ['김회장'])
    assert.deepEqual(rooms['dept:재정부'], [])
    assert.deepEqual(rooms[`direct:${direct}`], ['김회장', '이운영'])
    // 다시 들어오면 전체방에만 들어온다.
    await s.join('lee')
    const again = await roomMap(s.pg, s.councilId)
    assert.deepEqual(again.all, ['김회장', '이운영'])
    assert.deepEqual(again.leadership, ['김회장'])
    assert.deepEqual(again['dept:재정부'], [])
  } finally {
    await s.testDb.close()
  }
})

test('두 번 맞춰도 방과 줄과 시각이 그대로이고 방의 판은 하나다', async () => {
  const s = await start()
  try {
    await s.join('lee')
    const lee = await s.memberOf('lee')
    const finance = (await s.team()).departments[0]!.id
    await s.post(`/members/${lee}/departments`, { departmentId: finance, rank: null })
    const snapshot = async () =>
      (
        await s.pg.query(
          'SELECT room_id, member_id, joined_at::text FROM room_membership ORDER BY room_id, member_id',
        )
      ).rows
    const before = await snapshot()
    const rooms = (await s.pg.query('SELECT id FROM chat_room ORDER BY id')).rows
    await s.db.transaction(async tx => {
      const actor = await actorOf(tx, 'kim', s.councilId, now)
      await syncRooms(tx, actor!)
      await syncRooms(tx, actor!)
    })
    assert.deepEqual(await snapshot(), before)
    assert.deepEqual((await s.pg.query('SELECT id FROM chat_room ORDER BY id')).rows, rooms)
    const versions = await s.pg.query(
      'SELECT 1 FROM record_version WHERE record_id IN (SELECT id FROM chat_room)',
    )
    assert.equal(versions.rows.length, rooms.length)
  } finally {
    await s.testDb.close()
  }
})

test('이 기능 전에 만든 학생회는 처음 맞출 때 방이 채워지고, 다른 학생회와 끝난 소속은 건드리지 않는다', async () => {
  const testDb = await createTestDb()
  const { pg, db } = testDb
  try {
    const mine = await seedCouncil(db, pg, 'a')
    const other = await seedCouncil(db, pg, 'b')
    assert.deepEqual(await roomMap(pg, mine.councilId), {})
    await ensureCouncilRooms(db, (await actorOf(db, 'a-president', mine.councilId, now))!)
    assert.deepEqual(await roomMap(pg, mine.councilId), {
      all: [
        'a financeMember',
        'a plain',
        'a planningHead',
        'a planningMember',
        'a planningViceHead',
        'a president',
        'a vicePresident',
      ],
      leadership: ['a president', 'a vicePresident'],
      'dept:기획부': ['a planningHead', 'a planningMember', 'a planningViceHead'],
      'dept:재정부': ['a financeMember'],
    })
    assert.deepEqual(await roomMap(pg, other.councilId), {})
    const before = (await pg.query('SELECT id FROM chat_room ORDER BY id')).rows
    await ensureCouncilRooms(db, (await actorOf(db, 'a-president', mine.councilId, now))!)
    assert.deepEqual((await pg.query('SELECT id FROM chat_room ORDER BY id')).rows, before)
  } finally {
    await testDb.close()
  }
})

test('거부된 편성 요청은 방도 참여도 바꾸지 않는다', async () => {
  const s = await start()
  try {
    await s.join('lee')
    const lee = await s.memberOf('lee')
    const before = await roomMap(s.pg, s.councilId)
    const response = await s.api.post(
      `${s.base}/members/${lee}/departments`,
      { departmentId: crypto.randomUUID(), rank: null },
      'kim',
    )
    assert.equal(response.status, 404)
    assert.deepEqual(await roomMap(s.pg, s.councilId), before)
  } finally {
    await s.testDb.close()
  }
})
