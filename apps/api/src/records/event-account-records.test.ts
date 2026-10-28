import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb, type TestPg } from '../db/test-db.js'
import type { Tx } from '../db/types.js'
import { clockNow, createRecord, updateRecords, type AnyRecordChange } from './records.js'

// 행사와 계좌 기록(기능 006 조각 1). 학생회 둘: 첫 학생회에 운영진 둘(kim, lee), 둘째에 하나(park).
async function seed(tx: Tx) {
  const base = { councilId: null, actor: null } as const
  const member = (name: string) =>
    createRecord(tx, { ...base, kind: 'member', values: { name, email: `${name}@e.test` } })
  const kim = await member('kim')
  const lee = await member('lee')
  const park = await member('park')
  const councilOf = async (name: string, members: string[]) => {
    const councilId = await createRecord(tx, {
      ...base,
      kind: 'council',
      values: { name, unit: 'department', schoolName: '학교' },
    })
    const cohortId = await createRecord(tx, {
      kind: 'cohort',
      councilId,
      actor: members[0]!,
      values: { name: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' },
    })
    for (const memberId of members)
      await createRecord(tx, {
        kind: 'council_membership',
        councilId,
        actor: members[0]!,
        values: { memberId, cohortId, startsAt: clockNow },
      })
    return councilId
  }
  const mine = await councilOf('우리 학생회', [kim, lee])
  const theirs = await councilOf('다른 학생회', [park])
  return { kim, lee, park, mine, theirs }
}
type Seed = Awaited<ReturnType<typeof seed>>

const makeEvent = (tx: Tx, s: Seed, values: Record<string, unknown> = {}, council = s.mine) =>
  createRecord(tx, {
    kind: 'event',
    councilId: council,
    actor: s.kim,
    values: { name: '축제', ...values },
  })
const accountValues = (values: Record<string, unknown> = {}) => ({
  name: '대표',
  bank: '국민',
  accountNumber: '123-456',
  holder: '학생회',
  type: 'main',
  ...values,
})
const makeAccount = (tx: Tx, s: Seed, values: Record<string, unknown> = {}, council = s.mine) =>
  createRecord(tx, {
    kind: 'account',
    councilId: council,
    actor: s.kim,
    values: accountValues(values),
  })
const makeTask = (tx: Tx, s: Seed, values: Record<string, unknown> = {}) =>
  createRecord(tx, {
    kind: 'task',
    councilId: s.mine,
    actor: s.kim,
    values: { title: '현수막', ...values },
  })
const makeExpense = (tx: Tx, s: Seed, values: Record<string, unknown> = {}) =>
  createRecord(tx, {
    kind: 'expense',
    councilId: s.mine,
    actor: s.kim,
    values: {
      amount: '10000',
      paidAt: clockNow,
      description: '의자',
      vendor: '가게',
      method: 'card',
      ...values,
    },
  })
const change = (s: Seed, kind: string, id: string, changes: object) =>
  ({ kind, id, actor: s.kim, reason: null, changes }) as AnyRecordChange

const versionCount = async (pg: TestPg, id: string) =>
  (await pg.query('SELECT 1 FROM record_version WHERE record_id = $1', [id])).rows.length
const recordCount = async (pg: TestPg) => (await pg.query('SELECT 1 FROM record')).rows.length
const rowOf = async (pg: TestPg, table: string, id: string) =>
  (await pg.query<Record<string, unknown>>(`SELECT * FROM ${table} WHERE id = $1`, [id])).rows[0]!
const constraint = (name: string) => (error: unknown) =>
  String((error as { cause?: unknown }).cause).includes(name)

test('행사와 계좌를 만들면 판 1이고, 바꾸면 판이 하나씩 는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const event = await db.transaction(tx => makeEvent(tx, s, { ownerId: s.kim }))
    const account = await db.transaction(tx => makeAccount(tx, s))
    assert.equal(await versionCount(pg, event), 1)
    assert.equal(await versionCount(pg, account), 1)
    assert.equal((await rowOf(pg, 'account', account)).council_id, s.mine)
    await db.transaction(tx =>
      updateRecords(tx, [
        change(s, 'event', event, { name: '가을 축제', ownerId: s.lee }),
        change(s, 'account', account, { holder: '새 예금주', closedOn: '2026-12-31' }),
      ]),
    )
    assert.equal(await versionCount(pg, event), 2)
    assert.equal(await versionCount(pg, account), 2)
    assert.equal((await rowOf(pg, 'event', event)).owner_id, s.lee)
    await db.transaction(tx => updateRecords(tx, [change(s, 'event', event, { ownerId: null })]))
    assert.equal(await versionCount(pg, event), 3)
    assert.equal((await rowOf(pg, 'event', event)).owner_id, null)
  } finally {
    await close()
  }
})

// 제약 이름은 표_칸_check다.
const limits: { kind: 'event' | 'account'; column: string; field: string; max: number }[] = [
  { kind: 'event', column: 'name', field: 'name', max: 100 },
  { kind: 'event', column: 'place', field: 'place', max: 100 },
  { kind: 'account', column: 'name', field: 'name', max: 20 },
  { kind: 'account', column: 'bank', field: 'bank', max: 20 },
  { kind: 'account', column: 'account_number', field: 'accountNumber', max: 30 },
  { kind: 'account', column: 'holder', field: 'holder', max: 60 },
]

test('행사와 계좌의 상한 글자는 받고 상한+1자(이모지 포함)는 DB가 거절한다', async () => {
  const { db, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    let n = 0
    for (const { kind, column, field, max } of limits) {
      const create = (text: string) => {
        n += 1
        return db.transaction(tx =>
          kind === 'event'
            ? makeEvent(tx, s, { [field]: text })
            : makeAccount(tx, s, { name: `계좌${n}`, [field]: text, type: 'business' }),
        )
      }
      for (const text of ['가'.repeat(max), '😀'.repeat(max)]) await create(text)
      await assert.rejects(create('😀'.repeat(max + 1)), constraint(`${kind}_${column}_check`))
    }
  } finally {
    await close()
  }
})

test('다른 학생회 사람을 책임자로 두지 못하고, 실패하면 하위 행과 판이 없다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const before = await recordCount(pg)
    await assert.rejects(
      db.transaction(tx => makeEvent(tx, s, { ownerId: s.park })),
      /학생회/,
    )
    assert.equal(await recordCount(pg), before)
    assert.equal((await pg.query('SELECT 1 FROM event')).rows.length, 0)
    assert.equal(
      (await pg.query("SELECT 1 FROM record_version WHERE data ? 'owner_id'")).rows.length,
      0,
    )

    const event = await db.transaction(tx => makeEvent(tx, s, { ownerId: s.kim }))
    for (const key of ['ownerId', 'owner_id'])
      await assert.rejects(
        db.transaction(tx => updateRecords(tx, [change(s, 'event', event, { [key]: s.park })])),
        /학생회/,
        key,
      )
    assert.equal(await versionCount(pg, event), 1)
    assert.equal((await rowOf(pg, 'event', event)).owner_id, s.kim)
  } finally {
    await close()
  }
})

test('이전 행사는 다른 학생회의 것이면 만들 때 막고, 만든 뒤에는 바꾸지 못한다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const mine = await db.transaction(tx => makeEvent(tx, s))
    const theirs = await db.transaction(tx => makeEvent(tx, s, {}, s.theirs))
    await assert.rejects(
      db.transaction(tx => makeEvent(tx, s, { previousEventId: theirs })),
      /학생회/,
    )
    const next = await db.transaction(tx => makeEvent(tx, s, { previousEventId: mine }))
    for (const key of ['previousEventId', 'previous_event_id'])
      await assert.rejects(
        db.transaction(tx => updateRecords(tx, [change(s, 'event', next, { [key]: null })])),
        /주인 칸/,
        key,
      )
    assert.equal(await versionCount(pg, next), 1)
  } finally {
    await close()
  }
})

test('업무의 행사는 다른 학생회 것이면 만들 때와 바꿀 때 막고, 같은 학생회 것으로 바꾸거나 비울 수 있다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const mine = await db.transaction(tx => makeEvent(tx, s))
    const theirs = await db.transaction(tx => makeEvent(tx, s, {}, s.theirs))
    const before = await recordCount(pg)
    await assert.rejects(
      db.transaction(tx => makeTask(tx, s, { eventId: theirs })),
      /학생회/,
    )
    assert.equal(await recordCount(pg), before)
    const task = await db.transaction(tx => makeTask(tx, s, { eventId: mine }))
    for (const key of ['eventId', 'event_id']) {
      await assert.rejects(
        db.transaction(tx => updateRecords(tx, [change(s, 'task', task, { [key]: theirs })])),
        /학생회/,
        key,
      )
      assert.equal(await versionCount(pg, task), 1)
    }
    const other = await db.transaction(tx => makeEvent(tx, s, { name: '다른 행사' }))
    await db.transaction(tx => updateRecords(tx, [change(s, 'task', task, { eventId: other })]))
    assert.equal((await rowOf(pg, 'task', task)).event_id, other)
    await db.transaction(tx => updateRecords(tx, [change(s, 'task', task, { eventId: null })]))
    assert.equal((await rowOf(pg, 'task', task)).event_id, null)
    assert.equal(await versionCount(pg, task), 3)
  } finally {
    await close()
  }
})

test('지출의 계좌와 행사는 만들거나 바꿀 때 다른 학생회 것을 막고 같은 학생회 것으로 바꾸거나 비울 수 있다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const mineAccount = await db.transaction(tx => makeAccount(tx, s))
    const theirAccount = await db.transaction(tx => makeAccount(tx, s, {}, s.theirs))
    const mineEvent = await db.transaction(tx => makeEvent(tx, s))
    const theirEvent = await db.transaction(tx => makeEvent(tx, s, {}, s.theirs))
    const before = await recordCount(pg)
    await assert.rejects(
      db.transaction(tx => makeExpense(tx, s, { accountId: theirAccount })),
      /학생회/,
    )
    assert.equal(await recordCount(pg), before)
    const expense = await db.transaction(tx =>
      makeExpense(tx, s, { accountId: mineAccount, eventId: mineEvent }),
    )
    for (const key of ['accountId', 'account_id'])
      await assert.rejects(
        db.transaction(tx =>
          updateRecords(tx, [change(s, 'expense', expense, { [key]: theirAccount })]),
        ),
        /학생회/,
        key,
      )
    for (const key of ['eventId', 'event_id'])
      await assert.rejects(
        db.transaction(tx =>
          updateRecords(tx, [change(s, 'expense', expense, { [key]: theirEvent })]),
        ),
        /학생회/,
        key,
      )
    assert.equal(await versionCount(pg, expense), 1)
    const other = await db.transaction(tx => makeEvent(tx, s, { name: '다른 행사' }))
    await db.transaction(tx =>
      updateRecords(tx, [change(s, 'expense', expense, { eventId: other })]),
    )
    assert.equal((await rowOf(pg, 'expense', expense)).event_id, other)
    assert.equal(await versionCount(pg, expense), 2)
    await db.transaction(tx =>
      updateRecords(tx, [change(s, 'expense', expense, { accountId: null })]),
    )
    assert.equal((await rowOf(pg, 'expense', expense)).account_id, null)
    await db.transaction(tx =>
      updateRecords(tx, [change(s, 'expense', expense, { accountId: mineAccount })]),
    )
    assert.equal((await rowOf(pg, 'expense', expense)).account_id, mineAccount)
    assert.equal(await versionCount(pg, expense), 4)
  } finally {
    await close()
  }
})

test('계좌의 학생회 번호는 바꾸지 못하고, 닫지 않은 대표 계좌 둘은 DB가 막는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const main = await db.transaction(tx => makeAccount(tx, s))
    await assert.rejects(
      db.transaction(tx =>
        updateRecords(tx, [change(s, 'account', main, { councilId: s.theirs })]),
      ),
      /주인 칸/,
    )
    await assert.rejects(
      db.transaction(tx => makeAccount(tx, s, { name: '둘째 대표' })),
      constraint('account_council_id_idx'),
    )
    await db.transaction(tx => makeAccount(tx, s, { name: '사업', type: 'business' }))
    assert.equal(await versionCount(pg, main), 1)
  } finally {
    await close()
  }
})
