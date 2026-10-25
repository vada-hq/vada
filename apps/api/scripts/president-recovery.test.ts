import assert from 'node:assert/strict'
import { test } from 'node:test'
import { syncRooms } from '../src/chat/rooms.js'
import { createTestDb, type TestDb } from '../src/db/test-db.js'
import { seedCouncil } from '../src/test-support/council.js'
import {
  inspectRecovery,
  objectionEndsAt,
  PRESIDENT_RECOVERY_REASON,
  recoverPresident,
} from './president-recovery.js'

// 알린 날 2026-10-10(한국). 이의 기간은 다음 날부터 7일, 10월 17일 24:00(한국)에 끝난다.
const NOTIFIED_ON = '2026-10-10'
const OBJECTION_ENDS = new Date('2026-10-17T15:00:00Z')
const SECOND = 1000
const later = new Date('2026-10-25T03:00:00Z')

// 같은 모양의 두 학생회(s, o). 둘 다 방을 맞춰 둔다. o는 s를 고칠 때 그대로여야 한다.
async function setup(testDb: TestDb) {
  const ours = await seedCouncil(testDb.db, testDb.pg, 's')
  const other = await seedCouncil(testDb.db, testDb.pg, 'o')
  for (const seeded of [ours, other])
    await testDb.db.transaction(tx =>
      syncRooms(tx, {
        councilId: seeded.councilId,
        cohortId: seeded.cohortId,
        memberId: seeded.people.president.memberId,
      }),
    )
  return { ours, other }
}

const input = (councilId: string, email: string, now = later) => ({
  councilId,
  email,
  notifiedOn: NOTIFIED_ON,
  now,
})

// 학생회 하나의 편성과 판, 방 참여 전부. 고치기 전후를 맞대어 그대로인지 본다.
async function snapshotOf(testDb: TestDb, councilId: string) {
  type Row = Record<string, unknown>
  const query = async (text: string) => (await testDb.pg.query<Row>(text, [councilId])).rows
  return {
    memberships: await query(
      `SELECT cm.id, cm.member_id, cm.council_rank, cm.ends_at FROM council_membership cm
       JOIN record r ON r.id = cm.id WHERE r.council_id = $1 ORDER BY cm.id`,
    ),
    versions: await query(
      `SELECT v.record_id, v.version_no, v.changed_by, v.reason FROM record_version v
       JOIN record r ON r.id = v.record_id WHERE r.council_id = $1 ORDER BY v.record_id, v.version_no`,
    ),
    rooms: await query(
      `SELECT rm.room_id, rm.member_id, rm.joined_at FROM room_membership rm
       JOIN record r ON r.id = rm.room_id WHERE r.council_id = $1 ORDER BY rm.room_id, rm.member_id`,
    ),
  }
}

const presidentsOf = async (testDb: TestDb, councilId: string) =>
  (
    await testDb.pg.query<{ member_id: string }>(
      `SELECT cm.member_id FROM council_membership cm JOIN cohort co ON co.id = cm.cohort_id
       WHERE co.council_id = $1 AND cm.council_rank = 'president' AND cm.ends_at IS NULL`,
      [councilId],
    )
  ).rows.map(row => row.member_id)

const leadershipRoomOf = async (testDb: TestDb, councilId: string) =>
  (
    await testDb.pg.query<{ member_id: string }>(
      `SELECT rm.member_id FROM room_membership rm JOIN chat_room c ON c.id = rm.room_id
       JOIN record r ON r.id = c.id WHERE r.council_id = $1 AND c.type = 'leadership'`,
      [councilId],
    )
  ).rows
    .map(row => row.member_id)
    .sort()

test('이의 기간 끝: 알린 날 다음 날부터 7일째의 24:00(한국)', () => {
  assert.equal(objectionEndsAt(NOTIFIED_ON).toISOString(), OBJECTION_ENDS.toISOString())
})

test('미리 보기는 학생회 이름, 지금 회장, 새 회장을 보이고 아무것도 쓰지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const { ours } = await setup(testDb)
    const before = await snapshotOf(testDb, ours.councilId)
    const view = await inspectRecovery(testDb.db, input(ours.councilId, 's-plain@example.test'))
    assert.deepEqual(view, {
      councilName: 's 학생회',
      current: { memberId: ours.people.president.memberId, name: 's president' },
      next: { memberId: ours.people.plain.memberId, name: 's plain' },
      problems: [],
    })
    assert.deepEqual(await snapshotOf(testDb, ours.councilId), before)
  } finally {
    await testDb.close()
  }
})

test('적용: 옛 회장은 직급 없음, 새 회장은 회장, 판은 바꾼 사람 없이 사유를 남기고 회장단방이 맞춰진다. 다른 학생회는 그대로다', async () => {
  const testDb = await createTestDb()
  try {
    const { ours, other } = await setup(testDb)
    const otherBefore = await snapshotOf(testDb, other.councilId)
    const before = await snapshotOf(testDb, ours.councilId)
    const view = await recoverPresident(testDb.db, input(ours.councilId, 'S-Plain@Example.test '))
    assert.deepEqual(view.problems, [])
    assert.deepEqual(await presidentsOf(testDb, ours.councilId), [ours.people.plain.memberId])
    const ranks = await testDb.pg.query<{ member_id: string; council_rank: string | null }>(
      'SELECT member_id, council_rank FROM council_membership WHERE member_id = ANY($1)',
      [[ours.people.president.memberId, ours.people.plain.memberId]],
    )
    assert.deepEqual(Object.fromEntries(ranks.rows.map(row => [row.member_id, row.council_rank])), {
      [ours.people.president.memberId]: null,
      [ours.people.plain.memberId]: 'president',
    })
    const after = await snapshotOf(testDb, ours.councilId)
    const added = after.versions.filter(
      row =>
        !before.versions.some(
          old => old.record_id === row.record_id && old.version_no === row.version_no,
        ),
    )
    assert.equal(added.length, 2)
    for (const row of added) {
      assert.equal(row.changed_by, null)
      assert.equal(row.reason, PRESIDENT_RECOVERY_REASON)
    }
    assert.equal(PRESIDENT_RECOVERY_REASON, 'president_recovery')
    assert.deepEqual(
      await leadershipRoomOf(testDb, ours.councilId),
      [ours.people.vicePresident.memberId, ours.people.plain.memberId].sort(),
    )
    assert.deepEqual(await snapshotOf(testDb, other.councilId), otherBefore)
  } finally {
    await testDb.close()
  }
})

test('부회장도 새 회장이 될 수 있다', async () => {
  const testDb = await createTestDb()
  try {
    const { ours } = await setup(testDb)
    const view = await recoverPresident(
      testDb.db,
      input(ours.councilId, 's-vicePresident@example.test'),
    )
    assert.deepEqual(view.problems, [])
    assert.deepEqual(await presidentsOf(testDb, ours.councilId), [
      ours.people.vicePresident.memberId,
    ])
  } finally {
    await testDb.close()
  }
})

test('새 회장이 다른 학생회 사람, 내보낸 사람, 없는 이메일, 이미 회장이면 멈추고 아무것도 바꾸지 않는다', async () => {
  const testDb = await createTestDb()
  try {
    const { ours, other } = await setup(testDb)
    const before = await snapshotOf(testDb, ours.councilId)
    const otherBefore = await snapshotOf(testDb, other.councilId)
    const cases = [
      ['o-plain@example.test', 'NOT_MEMBER'],
      ['s-ended@example.test', 'NOT_MEMBER'],
      ['nobody@example.test', 'NO_ACCOUNT'],
      ['s-president@example.test', 'ALREADY_PRESIDENT'],
    ] as const
    for (const [email, problem] of cases) {
      const view = await recoverPresident(testDb.db, input(ours.councilId, email))
      assert.deepEqual(view.problems, [problem], email)
      assert.deepEqual(await snapshotOf(testDb, ours.councilId), before, email)
    }
    assert.deepEqual(await snapshotOf(testDb, other.councilId), otherBefore)
  } finally {
    await testDb.close()
  }
})

test('없는 학생회는 멈춘다', async () => {
  const testDb = await createTestDb()
  try {
    await setup(testDb)
    const view = await recoverPresident(
      testDb.db,
      input('0190a000-0000-7000-8000-000000000000', 's-plain@example.test'),
    )
    assert.deepEqual(view.problems, ['NO_COUNCIL'])
  } finally {
    await testDb.close()
  }
})

test('이의 기간 경계 ±1초: 끝나기 1초 전에는 멈추고, 1초 뒤에는 옮긴다', async () => {
  const testDb = await createTestDb()
  try {
    const { ours } = await setup(testDb)
    const before = await snapshotOf(testDb, ours.councilId)
    const early = new Date(OBJECTION_ENDS.getTime() - SECOND)
    const email = 's-plain@example.test'
    assert.deepEqual(
      (await inspectRecovery(testDb.db, input(ours.councilId, email, early))).problems,
      ['TOO_EARLY'],
    )
    assert.deepEqual(
      (await recoverPresident(testDb.db, input(ours.councilId, email, early))).problems,
      ['TOO_EARLY'],
    )
    assert.deepEqual(await snapshotOf(testDb, ours.councilId), before)
    const late = new Date(OBJECTION_ENDS.getTime() + SECOND)
    assert.deepEqual(
      (await recoverPresident(testDb.db, input(ours.councilId, email, late))).problems,
      [],
    )
    assert.deepEqual(await presidentsOf(testDb, ours.councilId), [ours.people.plain.memberId])
  } finally {
    await testDb.close()
  }
})
