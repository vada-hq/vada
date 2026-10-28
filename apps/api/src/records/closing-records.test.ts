import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb, type TestPg } from '../db/test-db.js'
import type { Tx } from '../db/types.js'
import { clockNow, createRecord, updateRecords, type AnyRecordChange } from './records.js'

// 결산 기록과 수입의 새 제약(기능 009 조각 1, DEC-70). 학생회 둘: 첫 학생회에 운영진 kim, 둘째에 park.
async function seed(tx: Tx) {
  const base = { councilId: null, actor: null } as const
  const member = (name: string) =>
    createRecord(tx, { ...base, kind: 'member', values: { name, email: `${name}@e.test` } })
  const kim = await member('kim')
  const park = await member('park')
  const councilOf = async (name: string, memberId: string) => {
    const councilId = await createRecord(tx, {
      ...base,
      kind: 'council',
      values: { name, unit: 'department', schoolName: '학교' },
    })
    const cohortId = await createRecord(tx, {
      kind: 'cohort',
      councilId,
      actor: memberId,
      values: { name: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' },
    })
    await createRecord(tx, {
      kind: 'council_membership',
      councilId,
      actor: memberId,
      values: { memberId, cohortId, startsAt: clockNow },
    })
    return councilId
  }
  const mine = await councilOf('우리 학생회', kim)
  const theirs = await councilOf('다른 학생회', park)
  return { kim, park, mine, theirs }
}
type Seed = Awaited<ReturnType<typeof seed>>

const periodOf = (tx: Tx, councilId: string, actor: string, year: number) =>
  createRecord(tx, {
    kind: 'fiscal_period',
    councilId,
    actor,
    values: { name: `${year}`, startsOn: `${year}-01-01`, endsOn: `${year}-12-31` },
  })
const closingOf = (tx: Tx, s: Seed, fiscalPeriodId: string) =>
  createRecord(tx, {
    kind: 'account_closing',
    councilId: s.mine,
    actor: s.kim,
    values: { fiscalPeriodId },
  })
const incomeOf = (tx: Tx, s: Seed, fiscalPeriodId: string, values: Record<string, unknown> = {}) =>
  createRecord(tx, {
    kind: 'income',
    councilId: s.mine,
    actor: s.kim,
    values: { fiscalPeriodId, source: 'fee', amount: '1000', receivedOn: '2026-05-01', ...values },
  })
const change = (s: Seed, kind: string, id: string, changes: object) =>
  ({ kind, id, actor: s.kim, reason: null, changes }) as AnyRecordChange

const versionCount = async (pg: TestPg, id: string) =>
  (await pg.query('SELECT 1 FROM record_version WHERE record_id = $1', [id])).rows.length
const recordCount = async (pg: TestPg) => (await pg.query('SELECT 1 FROM record')).rows.length
// drizzle을 거치면 원인이 cause에 있고, pg를 바로 부르면 오류 자신에 있다.
const constraint = (name: string) => (error: unknown) =>
  String((error as { cause?: unknown }).cause ?? error).includes(name)
const emoji = (n: number) => '😀'.repeat(n)

test('결산 기록을 만들면 판 1, 공개 시각을 바꾸면 판이 하나씩 는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const period = await db.transaction(tx => periodOf(tx, s.mine, s.kim, 2026))
    const closing = await db.transaction(tx => closingOf(tx, s, period))
    assert.equal(await versionCount(pg, closing), 1)
    await db.transaction(tx =>
      updateRecords(tx, [change(s, 'account_closing', closing, { publishedAt: clockNow })]),
    )
    assert.equal(await versionCount(pg, closing), 2)
    await db.transaction(tx =>
      updateRecords(tx, [change(s, 'account_closing', closing, { publishedAt: null })]),
    )
    assert.equal(await versionCount(pg, closing), 3)
    const { rows } = await pg.query<{ published_at: unknown }>(
      'SELECT published_at FROM account_closing WHERE id = $1',
      [closing],
    )
    assert.equal(rows[0]!.published_at, null)
    // 기간마다 결산 기록은 하나다.
    await assert.rejects(
      db.transaction(tx => closingOf(tx, s, period)),
      constraint('account_closing_fiscal_period_id_key'),
    )
  } finally {
    await close()
  }
})

test('다른 학생회 기간의 결산 기록은 실패하고 하위 행과 판이 없다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const theirPeriod = await db.transaction(tx => periodOf(tx, s.theirs, s.park, 2026))
    const before = await recordCount(pg)
    await assert.rejects(
      db.transaction(tx => closingOf(tx, s, theirPeriod)),
      /학생회/,
    )
    assert.equal(await recordCount(pg), before)
    assert.equal((await pg.query('SELECT 1 FROM account_closing')).rows.length, 0)
  } finally {
    await close()
  }
})

test('결산의 기간은 바꾸지 못한다(drizzle 이름과 DB 칸 이름 모두)', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const period = await db.transaction(tx => periodOf(tx, s.mine, s.kim, 2026))
    const other = await db.transaction(tx => periodOf(tx, s.mine, s.kim, 2027))
    const closing = await db.transaction(tx => closingOf(tx, s, period))
    for (const key of ['fiscalPeriodId', 'fiscal_period_id'])
      await assert.rejects(
        db.transaction(tx =>
          updateRecords(tx, [change(s, 'account_closing', closing, { [key]: other })]),
        ),
        /주인 칸/,
        key,
      )
    assert.equal(await versionCount(pg, closing), 1)
  } finally {
    await close()
  }
})

test('수입 내용은 200자는 받고 201자(이모지)는 DB가 거절한다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const period = await db.transaction(tx => periodOf(tx, s.mine, s.kim, 2026))
    await db.transaction(tx => incomeOf(tx, s, period, { description: emoji(200) }))
    await assert.rejects(
      db.transaction(tx => incomeOf(tx, s, period, { description: emoji(201) })),
      constraint('income_description_check'),
    )
    assert.equal((await pg.query('SELECT 1 FROM income')).rows.length, 1)
  } finally {
    await close()
  }
})

test('한 기간에 취소하지 않은 이월금 수입은 하나다. 취소하면 새로 만들 수 있다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const period = await db.transaction(tx => periodOf(tx, s.mine, s.kim, 2026))
    const other = await db.transaction(tx => periodOf(tx, s.mine, s.kim, 2027))
    const carry = (periodId: string) =>
      db.transaction(tx => incomeOf(tx, s, periodId, { source: 'carryover' }))
    const first = await carry(period)
    await assert.rejects(carry(period), constraint('income_fiscal_period_id_idx'))
    await carry(other)
    // 이월금이 아닌 수입은 몇 개든 된다.
    await db.transaction(tx => incomeOf(tx, s, period))
    await db.transaction(tx => incomeOf(tx, s, period))
    await db.transaction(tx =>
      updateRecords(tx, [change(s, 'income', first, { cancelledAt: clockNow })]),
    )
    await carry(period)
    await assert.rejects(carry(period), constraint('income_fiscal_period_id_idx'))
    const { rows } = await pg.query(
      "SELECT 1 FROM income WHERE fiscal_period_id = $1 AND source = 'carryover'",
      [period],
    )
    assert.equal(rows.length, 2)
  } finally {
    await close()
  }
})
