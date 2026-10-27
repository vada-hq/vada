import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PGlite } from '@electric-sql/pglite'
import { createTestDb } from '../db/test-db.js'
import type { Tx } from '../db/types.js'
import { clockNow, createRecord, updateRecords, type AnyRecordChange } from './records.js'

const versionCount = async (pg: PGlite, id: string) =>
  (await pg.query('SELECT 1 FROM record_version WHERE record_id = $1', [id])).rows.length
const rowOf = async (pg: PGlite, table: string, id: string) =>
  (await pg.query<Record<string, unknown>>(`SELECT * FROM ${table} WHERE id = $1`, [id])).rows[0]!
const recordCount = async (pg: PGlite) => (await pg.query('SELECT 1 FROM record')).rows.length
// drizzle이 오류를 감싸므로 제약 이름은 원인에 있다.
const constraint = (name: string) => (error: unknown) =>
  String((error as { cause?: unknown }).cause).includes(name)

type Kind =
  | 'fiscal_period'
  | 'budget'
  | 'budget_item'
  | 'request'
  | 'line_item'
  | 'expense'
  | 'payment_line'
  | 'evidence'
  | 'approval'

// 학생회 둘. 첫 학생회에는 운영진 둘(kim, lee), 둘째에는 하나(park)가 있고, 둘 다 구매와 지출 기록 한 벌을 가진다.
async function seed(tx: Tx) {
  const member = (name: string) =>
    createRecord(tx, {
      kind: 'member',
      councilId: null,
      actor: null,
      values: { name, email: `${name}@e.test` },
    })
  const kim = await member('kim')
  const lee = await member('lee')
  const park = await member('park')
  const councilOf = async (name: string, members: string[]) => {
    const councilId = await createRecord(tx, {
      kind: 'council',
      councilId: null,
      actor: null,
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
  return {
    kim,
    lee,
    park,
    mine,
    theirs,
    owner: { councilId: mine, actor: kim },
    mineSet: await setOf(tx, { councilId: mine, actor: kim }),
    theirSet: await setOf(tx, { councilId: theirs, actor: park }),
  }
}
type Seed = Awaited<ReturnType<typeof seed>>

type Owner = { councilId: string; actor: string }
const make = (tx: Tx, owner: Owner, kind: Kind, values: object) =>
  createRecord(tx, { kind, ...owner, values })

async function setOf(tx: Tx, owner: Owner) {
  const period = await make(tx, owner, 'fiscal_period', {
    name: '2026-2',
    startsOn: '2026-09-01',
    endsOn: '2027-02-28',
  })
  const budget = await make(tx, owner, 'budget', { fiscalPeriodId: period })
  const item = await make(tx, owner, 'budget_item', {
    budgetId: budget,
    type: 'expense',
    purpose: '비품',
    amount: '100000',
  })
  const request = await make(tx, owner, 'request', {
    type: 'purchase',
    title: '의자',
    requestedBy: owner.actor,
  })
  const line = await make(tx, owner, 'line_item', {
    requestId: request,
    name: '의자',
    quantity: 2,
  })
  const expense = await make(tx, owner, 'expense', expenseValues())
  return { period, budget, item, request, line, expense }
}
const expenseValues = (values: object = {}) => ({
  amount: '10000',
  paidAt: clockNow,
  description: '의자',
  vendor: '가게',
  method: 'card',
  ...values,
})

const change = (s: Seed, kind: Kind, id: string, changes: object) =>
  ({ kind, id, actor: s.kim, reason: null, changes }) as AnyRecordChange

// 상한 칸. 이모지로 상한은 받고 상한+1은 DB가 거절한다. 제약 이름은 표_칸_check다.
const limits: { kind: Kind; table: string; column: string; field: string; max: number }[] = [
  { kind: 'fiscal_period', table: 'fiscal_period', column: 'name', field: 'name', max: 20 },
  { kind: 'budget_item', table: 'budget_item', column: 'purpose', field: 'purpose', max: 100 },
  { kind: 'request', table: 'request', column: 'title', field: 'title', max: 100 },
  { kind: 'request', table: 'request', column: 'body', field: 'body', max: 1000 },
  { kind: 'line_item', table: 'line_item', column: 'name', field: 'name', max: 100 },
  { kind: 'line_item', table: 'line_item', column: 'link', field: 'link', max: 2000 },
  { kind: 'line_item', table: 'line_item', column: 'options', field: 'options', max: 200 },
  { kind: 'expense', table: 'expense', column: 'vendor', field: 'vendor', max: 100 },
  { kind: 'expense', table: 'expense', column: 'description', field: 'description', max: 200 },
  { kind: 'expense', table: 'expense', column: 'reason', field: 'reason', max: 1000 },
  { kind: 'approval', table: 'approval', column: 'reason', field: 'reason', max: 500 },
]

// 종류마다 하나를 새로 만드는 값. 상한 시험은 한 칸만 덮어쓴다.
function newValues(s: Seed, kind: Kind, year: number): object {
  const set = s.mineSet
  switch (kind) {
    case 'fiscal_period':
      return { name: `기간${year}`, startsOn: `${year}-01-01`, endsOn: `${year}-06-30` }
    case 'budget':
      throw new Error('예산은 기간마다 하나다')
    case 'budget_item':
      return { budgetId: set.budget, type: 'expense', purpose: '목적', amount: '1' }
    case 'request':
      return { type: 'purchase', title: '요청', requestedBy: s.lee }
    case 'line_item':
      return { requestId: set.request, name: '품목', quantity: 1 }
    case 'expense':
      return expenseValues()
    case 'payment_line':
      throw new Error('결제 내역은 쌍마다 하나다')
    case 'evidence':
      return { expenseId: set.expense, type: 'receipt' }
    case 'approval':
      return {
        targetId: set.line,
        targetKind: 'line_item',
        outcome: 'rejected',
        actorId: s.lee,
        actorKind: 'member',
        actedAt: clockNow,
      }
  }
}

test('상한 글자는 받고 상한+1자(이모지 포함)는 DB가 거절한다', async () => {
  const { db, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    let year = 2030
    for (const { kind, table, column, field, max } of limits) {
      const create = (text: string) => {
        year += 1
        return db.transaction(tx =>
          make(tx, s.owner, kind, { ...newValues(s, kind, year), [field]: text }),
        )
      }
      for (const text of ['가'.repeat(max), '😀'.repeat(max)]) await create(text)
      await assert.rejects(create('😀'.repeat(max + 1)), constraint(`${table}_${column}_check`))
    }
  } finally {
    await close()
  }
})

test('아홉 종류를 만들면 판 1이고, 바꿀 수 있는 칸을 바꾸면 판이 하나씩 는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const set = s.mineSet
    const payment = await db.transaction(tx =>
      make(tx, s.owner, 'payment_line', {
        expenseId: set.expense,
        lineItemId: set.line,
        amount: '5000',
      }),
    )
    const proof = await db.transaction(tx =>
      make(tx, s.owner, 'evidence', { expenseId: set.expense, type: 'receipt' }),
    )
    const approval = await db.transaction(tx =>
      make(tx, s.owner, 'approval', newValues(s, 'approval', 0)),
    )
    const steps: [Kind, string, object][] = [
      ['fiscal_period', set.period, { name: '고침' }],
      ['budget_item', set.item, { amount: '200000' }],
      ['request', set.request, { title: '고침', cancelledAt: clockNow }],
      ['line_item', set.line, { amount: '5000', budgetItemId: set.item }],
      ['expense', set.expense, { reason: '사유', paidBy: s.lee, budgetItemId: set.item }],
      ['payment_line', payment, { amount: '6000' }],
      ['evidence', proof, { type: 'other' }],
      ['approval', approval, { reason: '고침' }],
    ]
    for (const id of [set.period, set.budget, set.item, set.request, set.line, set.expense])
      assert.equal(await versionCount(pg, id), 1)
    for (const id of [payment, proof, approval]) assert.equal(await versionCount(pg, id), 1)
    for (const [kind, id, changes] of steps) {
      await db.transaction(tx => updateRecords(tx, [change(s, kind, id, changes)]))
      assert.equal(await versionCount(pg, id), 2, kind)
    }
    assert.equal((await rowOf(pg, 'fiscal_period', set.period)).council_id, s.mine)
    assert.equal((await rowOf(pg, 'line_item', set.line)).budget_item_id, set.item)
    assert.equal((await rowOf(pg, 'expense', set.expense)).paid_by, s.lee)
  } finally {
    await close()
  }
})

test('다른 학생회의 것을 가리켜 만들면 실패하고 하위 행과 판이 없다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const own = s.mineSet
    const theirs = s.theirSet
    const attempts: [string, Kind, object][] = [
      ['예산의 회계 기간', 'budget', { fiscalPeriodId: theirs.period }],
      [
        '예산 항목의 예산',
        'budget_item',
        { ...newValues(s, 'budget_item', 0), budgetId: theirs.budget },
      ],
      ['요청의 요청한 사람', 'request', { ...newValues(s, 'request', 0), requestedBy: s.park }],
      [
        '요청의 기본 예산 항목',
        'request',
        { ...newValues(s, 'request', 0), defaultBudgetItemId: theirs.item },
      ],
      ['품목의 요청', 'line_item', { ...newValues(s, 'line_item', 0), requestId: theirs.request }],
      [
        '품목의 예산 항목',
        'line_item',
        { ...newValues(s, 'line_item', 0), budgetItemId: theirs.item },
      ],
      ['지출의 예산 항목', 'expense', expenseValues({ budgetItemId: theirs.item })],
      ['지출의 부탁한 사람', 'expense', expenseValues({ requestedBy: s.park })],
      ['지출의 먼저 낸 사람', 'expense', expenseValues({ paidBy: s.park })],
      [
        '결제 내역의 지출',
        'payment_line',
        { expenseId: theirs.expense, lineItemId: own.line, amount: '1' },
      ],
      [
        '결제 내역의 품목',
        'payment_line',
        { expenseId: own.expense, lineItemId: theirs.line, amount: '1' },
      ],
      ['증빙의 지출', 'evidence', { expenseId: theirs.expense, type: 'receipt' }],
      ['결재 기록의 대상', 'approval', { ...newValues(s, 'approval', 0), targetId: theirs.line }],
      ['결재 기록의 결재한 사람', 'approval', { ...newValues(s, 'approval', 0), actorId: s.park }],
    ]
    const before = await recordCount(pg)
    for (const [name, kind, values] of attempts)
      await assert.rejects(
        db.transaction(tx => make(tx, s.owner, kind, values)),
        /학생회/,
        name,
      )
    assert.equal(await recordCount(pg), before)
  } finally {
    await close()
  }
})

test('파일의 증빙이 다른 학생회의 것이면 실패한다', async () => {
  const { db, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const mine = await db.transaction(tx =>
      make(tx, s.owner, 'evidence', { expenseId: s.mineSet.expense, type: 'receipt' }),
    )
    const attach = (attachedToId: string) =>
      db.transaction(tx =>
        createRecord(tx, {
          kind: 'file',
          councilId: s.mine,
          actor: s.kim,
          values: {
            name: 'a.jpg',
            mediaType: 'image/jpeg',
            sizeBytes: 1,
            storageKey: `k${attachedToId}`,
            attachedToId,
          },
        }),
      )
    await attach(mine)
    await assert.rejects(attach(s.theirSet.expense), /학생회/)
  } finally {
    await close()
  }
})

test('바꿀 때도 다른 학생회의 것이면 실패하고, 같은 학생회로 바꾸거나 비우기는 된다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const own = s.mineSet
    const theirs = s.theirSet
    const targets: [string, Kind, string, string, string, string][] = [
      ['품목의 예산 항목', 'line_item', own.line, 'line_item', 'budgetItemId', 'budget_item_id'],
      ['지출의 예산 항목', 'expense', own.expense, 'expense', 'budgetItemId', 'budget_item_id'],
      ['지출의 부탁한 사람', 'expense', own.expense, 'expense', 'requestedBy', 'requested_by'],
      ['지출의 먼저 낸 사람', 'expense', own.expense, 'expense', 'paidBy', 'paid_by'],
      ['요청의 요청한 사람', 'request', own.request, 'request', 'requestedBy', 'requested_by'],
    ]
    const foreign = (key: string) => (key.toLowerCase().includes('budget') ? theirs.item : s.park)
    const before = await recordCount(pg)
    for (const [name, kind, id, table, camel, snake] of targets) {
      const row = await rowOf(pg, table, id)
      const versions = await versionCount(pg, id)
      for (const key of [camel, snake])
        await assert.rejects(
          db.transaction(tx => updateRecords(tx, [change(s, kind, id, { [key]: foreign(camel) })])),
          /학생회/,
          `${name}(${key})`,
        )
      assert.deepEqual(await rowOf(pg, table, id), row, name)
      assert.equal(await versionCount(pg, id), versions, name)
    }
    assert.equal(await recordCount(pg), before)
    await db.transaction(tx =>
      updateRecords(tx, [
        change(s, 'line_item', own.line, { budgetItemId: own.item }),
        change(s, 'expense', own.expense, { paidBy: s.lee, budgetItemId: own.item }),
      ]),
    )
    await db.transaction(tx =>
      updateRecords(tx, [
        change(s, 'line_item', own.line, { budgetItemId: null }),
        change(s, 'expense', own.expense, { paidBy: null, requestedBy: null }),
      ]),
    )
    assert.equal((await rowOf(pg, 'line_item', own.line)).budget_item_id, null)
    assert.equal(await versionCount(pg, own.line), 3)
    assert.equal(await versionCount(pg, own.expense), 3)
  } finally {
    await close()
  }
})

test('가리키는 칸은 바꾸지 못한다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const own = s.mineSet
    const payment = await db.transaction(tx =>
      make(tx, s.owner, 'payment_line', {
        expenseId: own.expense,
        lineItemId: own.line,
        amount: '1',
      }),
    )
    const proof = await db.transaction(tx =>
      make(tx, s.owner, 'evidence', { expenseId: own.expense, type: 'receipt' }),
    )
    const approval = await db.transaction(tx =>
      make(tx, s.owner, 'approval', newValues(s, 'approval', 0)),
    )
    const fixed: [Kind, string, string[]][] = [
      ['budget', own.budget, ['fiscalPeriodId', 'fiscal_period_id']],
      ['budget_item', own.item, ['budgetId', 'budget_id']],
      ['line_item', own.line, ['requestId', 'request_id']],
      ['payment_line', payment, ['expenseId', 'expense_id', 'lineItemId', 'line_item_id']],
      ['evidence', proof, ['expenseId', 'expense_id']],
      [
        'approval',
        approval,
        [
          'targetId',
          'target_id',
          'targetKind',
          'target_kind',
          'outcome',
          'actorId',
          'actor_id',
          'actorKind',
          'actor_kind',
          'actedAt',
          'acted_at',
        ],
      ],
      [
        'fiscal_period',
        own.period,
        ['councilId', 'council_id', 'previousPeriodId', 'previous_period_id'],
      ],
      ['budget_item', own.item, ['eventId', 'event_id']],
      // 요청의 행사는 낼 때 고르고 바꾸지 않는다(DEC-68).
      ['request', own.request, ['eventId', 'event_id']],
    ]
    for (const [kind, id, keys] of fixed)
      for (const key of keys)
        await assert.rejects(
          db.transaction(tx => updateRecords(tx, [change(s, kind, id, { [key]: own.item })])),
          /주인 칸/,
          `${kind}.${key}`,
        )
    assert.equal(await versionCount(pg, own.budget), 1)
  } finally {
    await close()
  }
})

// 행사, 계좌, 감사 기구는 이 모듈이 만드는 종류가 아니라(기능 006, 007) 시험이 기록과 하위 행을 직접 넣는다.
async function plain(pg: PGlite, kind: 'event' | 'account' | 'audit_body', councilId: string) {
  const id = (await pg.query<{ id: string }>('SELECT gen_random_uuid() AS id')).rows[0]!.id
  await pg.query('INSERT INTO record (id, kind, council_id) VALUES ($1, $2, $3)', [
    id,
    kind,
    councilId,
  ])
  const columns: Record<typeof kind, string> = {
    event: "(id, name) VALUES ($1, 'e')",
    account:
      "(id, council_id, name, bank, account_number, holder, type) VALUES ($1, $2, 'a', 'b', '1', 'h', 'business')",
    audit_body: "(id, council_id, name) VALUES ($1, $2, 'a')",
  }
  const params = kind === 'event' ? [id] : [id, councilId]
  await pg.query(`INSERT INTO ${kind} ${columns[kind]}`, params)
  return id
}

test('이전 기간, 행사, 계좌도 다른 학생회의 것이면 만들 때와 바꿀 때 막고, 같은 학생회의 것은 된다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const own = s.mineSet
    const mineEvent = await plain(pg, 'event', s.mine)
    const theirEvent = await plain(pg, 'event', s.theirs)
    const mineAccount = await plain(pg, 'account', s.mine)
    const theirAccount = await plain(pg, 'account', s.theirs)
    const attempts: [string, Kind, string, object, string, string][] = [
      [
        '이전 기간',
        'fiscal_period',
        own.period,
        newValues(s, 'fiscal_period', 2030),
        'previousPeriodId',
        s.theirSet.period,
      ],
      [
        '예산 항목의 행사',
        'budget_item',
        own.item,
        newValues(s, 'budget_item', 0),
        'eventId',
        theirEvent,
      ],
      ['지출의 행사', 'expense', own.expense, newValues(s, 'expense', 0), 'eventId', theirEvent],
      [
        '지출의 계좌',
        'expense',
        own.expense,
        newValues(s, 'expense', 0),
        'accountId',
        theirAccount,
      ],
    ]
    const before = await recordCount(pg)
    for (const [name, kind, , values, key, foreign] of attempts)
      await assert.rejects(
        db.transaction(tx => make(tx, s.owner, kind, { ...values, [key]: foreign })),
        /학생회/,
        `${name} 만들기`,
      )
    assert.equal(await recordCount(pg), before)
    for (const [, kind, , values, key] of attempts) {
      const good =
        key === 'previousPeriodId' ? own.period : key === 'eventId' ? mineEvent : mineAccount
      await db.transaction(tx => make(tx, s.owner, kind, { ...values, [key]: good }))
    }
    // 지출의 행사·계좌는 같은 학생회 것으로 바꿀 수 있고 다른 학생회 것은 막는다. 나머지 주인 칸은 바꾸지 않는다.
    for (const [name, kind, id, , key, foreign] of attempts) {
      if (kind === 'expense') {
        const fields = key === 'eventId' ? ['eventId', 'event_id'] : ['accountId', 'account_id']
        for (const field of fields)
          await assert.rejects(
            db.transaction(tx => updateRecords(tx, [change(s, kind, id, { [field]: foreign })])),
            /학생회/,
            `${name} 바꾸기 ${field}`,
          )
        const value = key === 'eventId' ? mineEvent : mineAccount
        await db.transaction(tx => updateRecords(tx, [change(s, kind, id, { [key]: value })]))
        continue
      }
      await assert.rejects(
        db.transaction(tx => updateRecords(tx, [change(s, kind, id, { [key]: mineEvent })])),
        /주인 칸/,
        `${name} 바꾸기`,
      )
    }
  } finally {
    await close()
  }
})

test('결재한 사람이 운영진이 아니면 감사 기구의 학생회를 본다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const mineBody = await plain(pg, 'audit_body', s.mine)
    const theirBody = await plain(pg, 'audit_body', s.theirs)
    const values = (actorId: string) => ({
      targetId: s.mineSet.expense,
      targetKind: 'expense',
      outcome: 'audited',
      actorId,
      actorKind: 'audit_body',
      actedAt: clockNow,
    })
    await db.transaction(tx => make(tx, s.owner, 'approval', values(mineBody)))
    const before = await recordCount(pg)
    await assert.rejects(
      db.transaction(tx => make(tx, s.owner, 'approval', values(theirBody))),
      /학생회/,
    )
    assert.equal(await recordCount(pg), before)
  } finally {
    await close()
  }
})
