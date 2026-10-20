import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PGlite } from '@electric-sql/pglite'
import { createTestDb } from '../db/test-db.js'
import type { Tx } from '../db/types.js'
import { clockNow, createRecord, updateRecords, type AnyRecordChange } from './records.js'

const versionCount = async (pg: PGlite, id: string) =>
  (await pg.query('SELECT 1 FROM record_version WHERE record_id = $1', [id])).rows.length

// 학생회 둘. 첫 학생회에는 부서 하나와 운영진 둘, 둘째에는 부서 하나와 운영진 하나가 있다.
async function seed(tx: Tx) {
  const base = { councilId: null, actor: null } as const
  const member = (name: string) =>
    createRecord(tx, { ...base, kind: 'member', values: { name, email: `${name}@e.test` } })
  const kim = await member('kim')
  const lee = await member('lee')
  const park = await member('park')
  const council = (name: string) =>
    createRecord(tx, {
      ...base,
      kind: 'council',
      values: { name, unit: 'department', schoolName: '학교' },
    })
  const mine = await council('우리 학생회')
  const other = await council('다른 학생회')
  const cohortOf = (councilId: string) =>
    createRecord(tx, {
      kind: 'cohort',
      councilId,
      actor: kim,
      values: { name: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' },
    })
  const myCohort = await cohortOf(mine)
  const otherCohort = await cohortOf(other)
  for (const [memberId, cohortId, councilId] of [
    [kim, myCohort, mine],
    [lee, myCohort, mine],
    [park, otherCohort, other],
  ] as const)
    await createRecord(tx, {
      kind: 'council_membership',
      councilId,
      actor: kim,
      values: { memberId, cohortId, startsAt: clockNow },
    })
  const department = (councilId: string, name: string) =>
    createRecord(tx, { kind: 'department', councilId, actor: kim, values: { name } })
  return {
    kim,
    lee,
    park,
    mine,
    other,
    myDepartment: await department(mine, '기획부'),
    otherDepartment: await department(other, '기획부'),
  }
}
type Seed = Awaited<ReturnType<typeof seed>>

const makeTask = (tx: Tx, s: Seed, values: Record<string, unknown> = {}) =>
  createRecord(tx, {
    kind: 'task',
    councilId: s.mine,
    actor: s.kim,
    values: { title: '현수막 주문', ...values },
  })
const change = (s: Seed, id: string, changes: object) =>
  ({ kind: 'task', id, actor: s.kim, reason: null, changes }) as AnyRecordChange
// drizzle이 오류를 감싸므로 제약 이름은 원인에 있다.
const constraint = (name: string) => (error: unknown) =>
  String((error as { cause?: unknown }).cause).includes(name)
const rowOf = async (pg: PGlite, id: string) =>
  (await pg.query<Record<string, unknown>>('SELECT * FROM task WHERE id = $1', [id])).rows[0]!

test('제목 100자와 내용 1000자는 받고, 101자와 1001자(이모지 포함)는 DB가 거절한다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    await db.transaction(tx =>
      makeTask(tx, s, { title: '가'.repeat(100), body: '나'.repeat(1000) }),
    )
    await db.transaction(tx =>
      makeTask(tx, s, { title: '😀'.repeat(100), body: '😀'.repeat(1000) }),
    )
    await assert.rejects(
      db.transaction(tx => makeTask(tx, s, { title: '😀'.repeat(101) })),
      constraint('task_title_check'),
    )
    await assert.rejects(
      db.transaction(tx => makeTask(tx, s, { body: '😀'.repeat(1001) })),
      constraint('task_body_check'),
    )
    assert.equal((await pg.query('SELECT 1 FROM task')).rows.length, 2)
  } finally {
    await close()
  }
})

test('상태를 비우면 할 일이고, 정하지 않은 상태는 DB가 거절하고, 새 업무는 판 1이다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const id = await db.transaction(tx => makeTask(tx, s))
    assert.equal((await rowOf(pg, id)).status, 'todo')
    assert.equal((await rowOf(pg, id)).cancelled_at, null)
    assert.equal(await versionCount(pg, id), 1)
    for (const status of ['todo', 'in_progress', 'done'])
      await db.transaction(tx => makeTask(tx, s, { status }))
    await assert.rejects(
      db.transaction(tx => makeTask(tx, s, { status: 'open' })),
      constraint('task_status_check'),
    )
  } finally {
    await close()
  }
})

test('부서, 담당자, 상태, 취소 시각을 바꿀 때마다 판이 하나씩 는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const id = await db.transaction(tx => makeTask(tx, s))
    const steps = [
      { departmentId: s.myDepartment },
      { assigneeId: s.lee },
      { status: 'in_progress' },
      { cancelledAt: clockNow },
    ]
    for (const [index, changes] of steps.entries()) {
      await db.transaction(tx => updateRecords(tx, [change(s, id, changes)]))
      assert.equal(await versionCount(pg, id), index + 2)
    }
    const row = await rowOf(pg, id)
    assert.equal(row.department_id, s.myDepartment)
    assert.equal(row.assignee_id, s.lee)
    assert.ok(row.cancelled_at)
  } finally {
    await close()
  }
})

test('다른 학생회의 부서나 운영진으로 만들거나 바꾸면 실패하고 하위 행과 판이 그대로다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const id = await db.transaction(tx => makeTask(tx, s, { assigneeId: s.lee }))
    const before = await rowOf(pg, id)
    const count = async () => (await pg.query('SELECT 1 FROM record')).rows.length
    const records = await count()
    const attempts: [string, () => Promise<unknown>][] = [
      [
        '만들기: 다른 부서',
        () => db.transaction(tx => makeTask(tx, s, { departmentId: s.otherDepartment })),
      ],
      ['만들기: 다른 운영진', () => db.transaction(tx => makeTask(tx, s, { assigneeId: s.park }))],
    ]
    for (const key of ['departmentId', 'department_id'])
      attempts.push([
        `바꾸기: 다른 부서(${key})`,
        () =>
          db.transaction(tx => updateRecords(tx, [change(s, id, { [key]: s.otherDepartment })])),
      ])
    for (const key of ['assigneeId', 'assignee_id'])
      attempts.push([
        `바꾸기: 다른 운영진(${key})`,
        () => db.transaction(tx => updateRecords(tx, [change(s, id, { [key]: s.park })])),
      ])
    for (const [name, attempt] of attempts) await assert.rejects(attempt(), /학생회/, name)
    assert.deepEqual(await rowOf(pg, id), before)
    assert.equal(await versionCount(pg, id), 1)
    assert.equal(await count(), records)
  } finally {
    await close()
  }
})

test('담당자와 부서는 비울 수 있고, 떠난 운영진으로 바꾸기는 막지 않는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const id = await db.transaction(tx =>
      makeTask(tx, s, { departmentId: s.myDepartment, assigneeId: s.lee }),
    )
    await db.transaction(tx =>
      updateRecords(tx, [change(s, id, { departmentId: null, assigneeId: null })]),
    )
    assert.equal((await rowOf(pg, id)).department_id, null)
    await pg.query(`UPDATE council_membership SET ends_at = now() WHERE member_id = $1`, [s.lee])
    await db.transaction(tx => updateRecords(tx, [change(s, id, { assigneeId: s.lee })]))
    assert.equal((await rowOf(pg, id)).assignee_id, s.lee)
  } finally {
    await close()
  }
})

test('업무의 행사 칸은 바꾸지 못하고, 다른 종류의 부서 칸도 여전히 바꾸지 못한다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const id = await db.transaction(tx => makeTask(tx, s))
    for (const key of ['eventId', 'event_id'])
      await assert.rejects(
        db.transaction(tx => updateRecords(tx, [change(s, id, { [key]: s.mine })])),
        /주인 칸/,
        key,
      )
    const room = await db.transaction(tx =>
      createRecord(tx, {
        kind: 'chat_room',
        councilId: s.mine,
        actor: s.kim,
        values: { type: 'department', departmentId: s.myDepartment },
      }),
    )
    await assert.rejects(
      db.transaction(tx =>
        updateRecords(tx, [
          {
            kind: 'chat_room',
            id: room,
            actor: s.kim,
            reason: null,
            changes: { departmentId: null },
          },
        ]),
      ),
      /주인 칸/,
    )
    assert.equal(await versionCount(pg, id), 1)
  } finally {
    await close()
  }
})

test('업무에 배정 알림 기록을 만들 수 있고, 다른 학생회 사람에게는 실패한다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const id = await db.transaction(tx => makeTask(tx, s, { assigneeId: s.lee }))
    const notify = (recipientId: string) =>
      db.transaction(tx =>
        createRecord(tx, {
          kind: 'notification',
          councilId: s.mine,
          actor: s.kim,
          values: { recipientId, recordId: id, type: 'assignment', notifiedAt: clockNow },
        }),
      )
    const made = await notify(s.lee)
    assert.equal(await versionCount(pg, made), 1)
    await assert.rejects(notify(s.park), /학생회/)
  } finally {
    await close()
  }
})
