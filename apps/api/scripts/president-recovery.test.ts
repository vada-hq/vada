import assert from 'node:assert/strict'
import { test } from 'node:test'
import { syncRooms } from '../src/chat/rooms.js'
import { createTestDb, type TestDb } from '../src/db/test-db.js'
import { clockNow, createRecord } from '../src/records/records.js'
import { handOverPresident } from '../src/team/service.js'
import { seedCouncil, setDbClock } from '../src/test-support/council.js'
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
// 시험 학생회를 만드는 기록 시각. 알린 날보다 앞이라 지금 회장은 알린 날에 이미 회장이다.
const SEEDED_AT = new Date('2026-01-02T00:00:00Z')

// 같은 모양의 두 학생회(s, o). 둘 다 방을 맞춰 둔다. o는 s를 고칠 때 그대로여야 한다.
async function setup(testDb: TestDb) {
  await setDbClock(testDb.db, SEEDED_AT)
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

// 그 사람의 그 기수 소속 번호
const membershipOf = async (testDb: TestDb, memberId: string, cohortId: string) =>
  (
    await testDb.pg.query<{ id: string }>(
      'SELECT id FROM council_membership WHERE member_id = $1 AND cohort_id = $2',
      [memberId, cohortId],
    )
  ).rows[0]!.id

test('알린 뒤 회장이 바뀌었으면 멈춘다: 알린 날 23:59:59(한국)에 회장이 된 사람은 알림을 받은 것으로 보고, 다음 날 00:00이면 멈춘다', async () => {
  for (const [at, problems] of [
    [new Date('2026-10-10T14:59:59Z'), []],
    [new Date('2026-10-10T15:00:00Z'), ['PRESIDENT_CHANGED']],
  ] as const) {
    const testDb = await createTestDb()
    try {
      const { ours } = await setup(testDb)
      await setDbClock(testDb.db, at)
      const from = await membershipOf(testDb, ours.people.president.memberId, ours.cohortId)
      const to = await membershipOf(testDb, ours.people.vicePresident.memberId, ours.cohortId)
      await testDb.db.transaction(tx =>
        handOverPresident(tx, { from, to, actor: ours.people.president.memberId, reason: null }),
      )
      const before = await snapshotOf(testDb, ours.councilId)
      const email = 's-plain@example.test'
      const view = await inspectRecovery(testDb.db, input(ours.councilId, email))
      assert.deepEqual(view.problems, problems, at.toISOString())
      assert.equal(view.current?.memberId, ours.people.vicePresident.memberId)
      assert.deepEqual(
        (await recoverPresident(testDb.db, input(ours.councilId, email))).problems,
        problems,
      )
      if (problems.length) assert.deepEqual(await snapshotOf(testDb, ours.councilId), before)
      else
        assert.deepEqual(await presidentsOf(testDb, ours.councilId), [ours.people.plain.memberId])
    } finally {
      await testDb.close()
    }
  }
})

test('알린 날 뒤에 지금 기수가 시작했으면 멈추고, 알린 날에 시작했으면 된다. 지금 기수가 아직 없으면 멈춘다', async () => {
  const testDb = await createTestDb()
  try {
    await setDbClock(testDb.db, SEEDED_AT)
    const changed = await seedCouncil(testDb.db, testDb.pg, 'n', {
      startsOn: '2026-10-11',
      endsOn: '2027-02-28',
    })
    const before = await snapshotOf(testDb, changed.councilId)
    const email = 'n-plain@example.test'
    assert.deepEqual((await inspectRecovery(testDb.db, input(changed.councilId, email))).problems, [
      'COHORT_CHANGED',
    ])
    assert.deepEqual(
      (await recoverPresident(testDb.db, input(changed.councilId, email))).problems,
      ['COHORT_CHANGED'],
    )
    assert.deepEqual(await snapshotOf(testDb, changed.councilId), before)
    const sameDay = await seedCouncil(testDb.db, testDb.pg, 'd', {
      startsOn: NOTIFIED_ON,
      endsOn: '2027-02-28',
    })
    assert.deepEqual(
      (await inspectRecovery(testDb.db, input(sameDay.councilId, 'd-plain@example.test'))).problems,
      [],
    )
    const future = await seedCouncil(testDb.db, testDb.pg, 'f', {
      startsOn: '2026-11-01',
      endsOn: '2027-02-28',
    })
    assert.deepEqual(
      (await recoverPresident(testDb.db, input(future.councilId, 'f-plain@example.test'))).problems,
      ['NO_COHORT'],
    )
  } finally {
    await testDb.close()
  }
})

test('지난 기수에만 소속이 있는 사람은 새 회장이 될 수 없다', async () => {
  const testDb = await createTestDb()
  try {
    await setDbClock(testDb.db, SEEDED_AT)
    const seeded = await seedCouncil(testDb.db, testDb.pg, 'p', {
      startsOn: '2026-01-01',
      endsOn: '2026-06-30',
    })
    // 지금 기수(7월~)에는 회장만 들어 있다. 나머지는 지난 기수(1~6월)에만 소속이 있다.
    await testDb.db.transaction(async tx => {
      const actor = seeded.people.president.memberId
      const cohortId = await createRecord(tx, {
        kind: 'cohort',
        councilId: seeded.councilId,
        actor,
        values: { name: '2026-2', startsOn: '2026-07-01', endsOn: '2026-12-31' },
      })
      await createRecord(tx, {
        kind: 'council_membership',
        councilId: seeded.councilId,
        actor,
        values: { memberId: actor, cohortId, councilRank: 'president', startsAt: clockNow },
      })
    })
    for (const email of ['p-plain@example.test', 'p-vicePresident@example.test'])
      assert.deepEqual(
        (await recoverPresident(testDb.db, input(seeded.councilId, email))).problems,
        ['NOT_MEMBER'],
        email,
      )
  } finally {
    await testDb.close()
  }
})

test('방이 없던 학생회면 만든 사람 없이 방을 만들고 회장단방을 새 편성에 맞춘다', async () => {
  const testDb = await createTestDb()
  try {
    await setDbClock(testDb.db, SEEDED_AT)
    const seeded = await seedCouncil(testDb.db, testDb.pg, 'r')
    const view = await recoverPresident(testDb.db, input(seeded.councilId, 'r-plain@example.test'))
    assert.deepEqual(view.problems, [])
    const rooms = await testDb.pg.query<{ type: string; created_by: string | null }>(
      `SELECT c.type, r.created_by FROM chat_room c JOIN record r ON r.id = c.id
       WHERE r.council_id = $1 ORDER BY c.type`,
      [seeded.councilId],
    )
    assert.deepEqual(
      rooms.rows.map(row => row.type),
      ['all_members', 'department', 'department', 'leadership'],
    )
    assert.ok(rooms.rows.every(row => row.created_by === null))
    assert.deepEqual(
      await leadershipRoomOf(testDb, seeded.councilId),
      [seeded.people.vicePresident.memberId, seeded.people.plain.memberId].sort(),
    )
  } finally {
    await testDb.close()
  }
})
