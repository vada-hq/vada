import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb } from '../db/test-db.js'
import {
  ACCOUNT_TABLES,
  DESTROY_STEPS,
  KEPT_TABLES,
  destroyCouncilRows,
  destroyPlanOf,
} from './destroy.js'
import { withSettlement } from '../test-support/settlement.js'

test(
  '학생회 파기는 그 학생회의 구독만 지우고 다른 학생회의 구독은 남긴다',
  withSettlement(async t => {
    const member = t.council.people.planningMember.memberId
    for (const [council, hash] of [
      [t.council.councilId, 'a'],
      [t.other.councilId, 'b'],
    ] as const)
      await t.pg.query(
        'INSERT INTO calendar_feed (member_id, council_id, token_hash) VALUES ($1, $2, $3)',
        [member, council, hash.repeat(64)],
      )
    await t.db.transaction(async tx =>
      destroyCouncilRows(tx, await destroyPlanOf(tx, t.council.councilId)),
    )
    assert.deepEqual(
      (await t.pg.query<{ council_id: string }>('SELECT council_id FROM calendar_feed')).rows,
      [{ council_id: t.other.councilId }],
    )
  }),
)

test(
  '학생회 파기는 그 학생회 공지방에 남긴 읽음 위치를 지우고 다른 학생회의 것은 남긴다',
  withSettlement(async t => {
    const kept = new Map<string, string>()
    for (const council of [t.council, t.other]) {
      const room = await t.make(council, 'chat_room', { type: 'all_members' })
      kept.set(council.councilId, room)
      await t.pg.query(
        `INSERT INTO left_room_read (room_id, member_id, last_read_at) VALUES ($1, $2, '2026-10-01T00:00:00Z')`,
        [room, council.people.planningMember.memberId],
      )
    }
    const plan = await destroyPlanOf(t.db, t.council.councilId)
    assert.equal(plan.tables.find(item => item.table === 'left_room_read')?.rows, 1)
    await t.db.transaction(tx => destroyCouncilRows(tx, plan))
    assert.deepEqual(
      (await t.pg.query<{ room_id: string }>('SELECT room_id FROM left_room_read')).rows,
      [{ room_id: kept.get(t.other.councilId) }],
    )
  }),
)

test(
  '일정은 부서·행사보다 먼저 파기하고 다른 학생회의 일정은 남긴다',
  withSettlement(async t => {
    const id = await t.make(t.council, 'schedule_item', {
      type: 'other',
      title: '답사',
      startsOn: '2026-10-28',
      departmentId: t.council.departments.planning,
      eventId: await t.event(),
    })
    const other = await t.make(t.other, 'schedule_item', {
      type: 'other',
      title: '다른 학생회',
      startsOn: '2026-10-28',
    })
    await t.db.transaction(async tx =>
      destroyCouncilRows(tx, await destroyPlanOf(tx, t.council.councilId)),
    )
    const rows = await t.pg.query<{ id: string }>('SELECT id FROM schedule_item')
    assert.deepEqual(
      rows.rows.map(row => row.id),
      [other],
    )
    assert.equal(
      (await t.pg.query('SELECT 1 FROM record_version WHERE record_id = $1', [id])).rows.length,
      0,
    )
  }),
)

test(
  '회의·안건·결정·참가자·나온 곳 있는 업무를 모두 파기하고 다른 학생회의 회의는 남긴다',
  withSettlement(async t => {
    const heldAt = new Date('2026-10-29T05:00:00Z')
    const meeting = await t.make(t.council, 'meeting', { title: '회의', heldAt })
    const agendas: string[] = []
    for (const position of [1, 2])
      agendas.push(
        await t.make(t.council, 'agenda_item', { meetingId: meeting, position, title: '안건' }),
      )
    await t.make(t.council, 'decision', {
      content: '결정',
      decidedBy: t.council.people.president.memberId,
      decidedAt: heldAt,
      originId: agendas[0],
      originKind: 'agenda_item',
    })
    await t.make(t.council, 'task', {
      title: '후속 업무',
      originId: agendas[1],
      originKind: 'agenda_item',
    })
    for (const member of [t.council.people.president, t.council.people.planningMember])
      await t.pg.query('INSERT INTO meeting_attendee (meeting_id, member_id) VALUES ($1, $2)', [
        meeting,
        member.memberId,
      ])
    const other = await t.make(t.other, 'meeting', { title: '다른 학생회 회의', heldAt })
    await t.pg.query('INSERT INTO meeting_attendee (meeting_id, member_id) VALUES ($1, $2)', [
      other,
      t.other.people.president.memberId,
    ])
    const otherRows = async () => ({
      meeting: (await t.pg.query('SELECT * FROM meeting WHERE id = $1', [other])).rows,
      attendees: (await t.pg.query('SELECT * FROM meeting_attendee WHERE meeting_id = $1', [other]))
        .rows,
      versions: (await t.pg.query('SELECT * FROM record_version WHERE record_id = $1', [other]))
        .rows,
    })
    const before = await otherRows()
    const plan = await destroyPlanOf(t.db, t.council.councilId)
    for (const [table, rows] of [
      ['meeting', 1],
      ['agenda_item', 2],
      ['decision', 1],
      ['meeting_attendee', 2],
      ['task', 1],
    ] as const)
      assert.equal(plan.tables.find(item => item.table === table)?.rows, rows, table)
    await t.db.transaction(tx => destroyCouncilRows(tx, plan))
    for (const step of DESTROY_STEPS)
      assert.equal(
        (
          await t.pg.query(`SELECT 1 FROM ${step.table} WHERE ${step.column} = ANY($1::uuid[])`, [
            plan.ids,
          ])
        ).rows.length,
        0,
        step.table,
      )
    assert.deepEqual(await otherRows(), before)
  }),
)

// 학생회 파기(기능 021 정한 것 15)가 표를 빠뜨리지 않는지 스키마로 본다. 새 표가 생기면 어느 쪽인지 정할 때까지 이 시험이 실패한다.
// 파기하는 표의 행을 가리키는 외래 키는 모두 모아, 가리키는 표도 파기하고 먼저 지우는지 본다.
type ForeignKey = { child: string; parent: string; columns: string; deferrable: boolean }

async function schemaOf() {
  const { pg, close } = await createTestDb()
  try {
    const tables = await pg.query<{ name: string }>(
      `SELECT table_name AS name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1`,
    )
    const keys = await pg.query<ForeignKey>(
      `SELECT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent, c.condeferrable AS deferrable,
              (SELECT string_agg(a.attname, ',' ORDER BY k.n) FROM unnest(c.conkey) WITH ORDINALITY k(attnum, n)
                 JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum) AS columns
         FROM pg_constraint c JOIN pg_namespace s ON s.oid = c.connamespace
        WHERE c.contype = 'f' AND s.nspname = 'public'`,
    )
    const columns = await pg.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`,
    )
    return {
      tables: tables.rows.map(row => row.name),
      keys: keys.rows,
      hasColumn: (table: string, column: string) =>
        columns.rows.some(row => row.table_name === table && row.column_name === column),
    }
  } finally {
    await close()
  }
}

const destroyed: string[] = DESTROY_STEPS.map(step => step.table)

test('모든 표가 파기하는 표, 로그인 쪽 표, 남기는 표 가운데 한 곳에만 있다', async () => {
  const { tables, hasColumn } = await schemaOf()
  const classified = [...destroyed, ...ACCOUNT_TABLES, ...KEPT_TABLES]
  assert.equal(new Set(classified).size, classified.length, '두 곳에 있거나 두 번 지우는 표')
  assert.deepEqual([...classified].sort(), tables)
  for (const step of DESTROY_STEPS)
    assert.ok(hasColumn(step.table, step.column), `${step.table}.${step.column}`)
})

test('파기하는 표를 가리키는 외래 키의 표는 모두 파기하고, 가리키는 표를 먼저 지운다', async () => {
  const { keys } = await schemaOf()
  const order = (table: string) => destroyed.indexOf(table)
  for (const key of keys) {
    if (!destroyed.includes(key.parent)) continue
    // 남기는 운영진의 로그인 잇기는 남는다. 지우는 운영진은 로그인이 없는 사람뿐이다.
    if (key.child === 'member_login') continue
    assert.ok(destroyed.includes(key.child), `${key.child}(${key.columns}) → ${key.parent}`)
    // 같은 표 안의 외래 키(이전 행사·이전 기간)와 거래 끝에 보는 외래 키는 한 문장·한 거래 안이라 순서가 없다.
    if (key.child === key.parent || key.deferrable) continue
    assert.ok(
      order(key.child) < order(key.parent),
      `${key.child}(${key.columns})를 ${key.parent}보다 먼저 지운다`,
    )
  }
  // 신청자 열람 기록은 학생회를 파기해도 남으므로(DEC-72) 지우는 행을 가리키지 않는다.
  assert.ok(!keys.some(key => key.child === 'applicant_access_log'))
})
