import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PGlite } from '@electric-sql/pglite'
import { createTestDb } from '../db/test-db.js'
import type { Tx } from '../db/types.js'
import { clockNow, createRecord, updateRecords, type AnyRecordChange } from './records.js'

// 신청 양식, 참가 신청, 출석, 학생회비 납부 기록(기능 007 조각 1). 학생회 둘: 첫 학생회에 운영진 kim, 둘째에 park.
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
  const eventOf = (councilId: string, actor: string) =>
    createRecord(tx, { kind: 'event', councilId, actor, values: { name: '축제' } })
  const accountOf = (councilId: string, actor: string) =>
    createRecord(tx, {
      kind: 'account',
      councilId,
      actor,
      values: { name: '대표', bank: '국민', accountNumber: '1-2', holder: '학생회', type: 'main' },
    })
  return {
    kim,
    mine,
    theirs,
    event: await eventOf(mine, kim),
    theirEvent: await eventOf(theirs, park),
    account: await accountOf(mine, kim),
    theirAccount: await accountOf(theirs, park),
  }
}
type Seed = Awaited<ReturnType<typeof seed>>

let codes = 0
const nextCode = () => `AAAAAA${'23456789'[Math.floor(codes / 8) % 8]}${'ABCDEFGH'[codes++ % 8]}`
const closesAt = new Date('2026-12-31T00:00:00Z')
const makeForm = (tx: Tx, s: Seed, values: Record<string, unknown> = {}, council = s.mine) =>
  createRecord(tx, {
    kind: 'registration_form',
    councilId: council,
    actor: s.kim,
    values: { eventId: s.event, name: '신청', closesAt, publicCode: nextCode(), ...values },
  })
const makeRegistration = (tx: Tx, s: Seed, formId: string, values: Record<string, unknown> = {}) =>
  createRecord(tx, {
    kind: 'registration',
    councilId: s.mine,
    actor: null,
    values: { formId, name: '학생', appliedFee: '0', ...values },
  })
const makeAttendance = (tx: Tx, s: Seed, registrationId: string, values = {}) =>
  createRecord(tx, {
    kind: 'attendance',
    councilId: s.mine,
    actor: s.kim,
    values: { registrationId, confirmedAt: clockNow, method: 'qr', ...values },
  })
const change = (s: Seed, kind: string, id: string, changes: object) =>
  ({ kind, id, actor: s.kim, reason: null, changes }) as AnyRecordChange

const versionCount = async (pg: PGlite, id: string) =>
  (await pg.query('SELECT 1 FROM record_version WHERE record_id = $1', [id])).rows.length
const recordCount = async (pg: PGlite) => (await pg.query('SELECT 1 FROM record')).rows.length
// drizzle을 거치면 원인이 cause에 있고, pg를 바로 부르면 오류 자신에 있다.
const constraint = (name: string) => (error: unknown) =>
  String((error as { cause?: unknown }).cause ?? error).includes(name)

test('양식, 신청, 출석, 납부 기록을 만들면 판이 하나씩이다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const form = await db.transaction(tx => makeForm(tx, s, { feeAccountId: s.account }))
    const registration = await db.transaction(tx => makeRegistration(tx, s, form))
    const attendance = await db.transaction(tx => makeAttendance(tx, s, registration))
    const payment = await db.transaction(tx =>
      createRecord(tx, {
        kind: 'fee_payment',
        councilId: s.mine,
        actor: s.kim,
        values: { studentId: '2024000001', paidFrom: '2026-03-01', paidUntil: '2026-08-31' },
      }),
    )
    for (const id of [form, registration, attendance, payment])
      assert.equal(await versionCount(pg, id), 1)
    const { rows } = await pg.query<{ council_id: string }>(
      'SELECT council_id FROM fee_payment WHERE id = $1',
      [payment],
    )
    assert.equal(rows[0]!.council_id, s.mine)
    await db.transaction(tx =>
      updateRecords(tx, [change(s, 'registration_form', form, { name: '새 이름' })]),
    )
    assert.equal(await versionCount(pg, form), 2)
  } finally {
    await close()
  }
})

// 제약 이름은 표_칸_check다.
const limits: { column: string; max: number; kind: 'form' | 'registration'; field: string }[] = [
  { column: 'name', max: 50, kind: 'form', field: 'name' },
  { column: 'notice', max: 2000, kind: 'form', field: 'notice' },
  { column: 'name', max: 50, kind: 'registration', field: 'name' },
]

test('양식과 신청의 상한 글자는 받고 상한+1자(이모지 포함)는 DB가 거절한다', async () => {
  const { db, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const form = await db.transaction(tx => makeForm(tx, s))
    for (const { column, max, kind, field } of limits) {
      const table = kind === 'form' ? 'registration_form' : 'registration'
      const create = (text: string) =>
        db.transaction(tx =>
          kind === 'form'
            ? makeForm(tx, s, { [field]: text })
            : makeRegistration(tx, s, form, { [field]: text }),
        )
      for (const text of ['가'.repeat(max), '😀'.repeat(max)]) await create(text)
      await assert.rejects(create('😀'.repeat(max + 1)), constraint(`${table}_${column}_check`))
    }
  } finally {
    await close()
  }
})

test('형식이 틀린 공개 코드, 학번, 휴대폰과 한쪽만 있는 참가비는 DB가 거절한다', async () => {
  const { db, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const form = await db.transaction(tx => makeForm(tx, s, { publicCode: '23456789' }))
    for (const publicCode of [
      '2345678',
      '234567890',
      '2345678I',
      '2345678O',
      '2345678a',
      '2345678-',
    ])
      await assert.rejects(
        db.transaction(tx => makeForm(tx, s, { publicCode })),
        constraint('registration_form_public_code_check'),
        publicCode,
      )
    await db.transaction(tx => makeForm(tx, s, { payerFee: '0', nonPayerFee: '5000' }))
    for (const fees of [{ payerFee: '0' }, { nonPayerFee: '5000' }])
      await assert.rejects(
        db.transaction(tx => makeForm(tx, s, fees)),
        constraint('registration_form_check1'),
      )
    for (const studentId of ['12345', '1234567890123', '12345a', '１２３４５６'])
      await assert.rejects(
        db.transaction(tx => makeRegistration(tx, s, form, { studentId })),
        constraint('registration_student_id_check'),
        studentId,
      )
    for (const phone of ['01012345', '010123456789', '0212345678', '010-1234-5678', ' 01012345678'])
      await assert.rejects(
        db.transaction(tx => makeRegistration(tx, s, form, { phone })),
        constraint('registration_phone_check'),
        phone,
      )
    for (const [studentId, phone] of [
      ['123456', '0101234567'],
      ['123456789012', '01012345678'],
    ])
      await db.transaction(tx => makeRegistration(tx, s, form, { studentId, phone }))
  } finally {
    await close()
  }
})

test('양식의 학번 받기는 빼면 받기이고, 두 참가비가 다르면 받지 않기를 DB가 거절한다(DEC-75)', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const collects = async (id: string) =>
      (
        await pg.query<{ collects_student_id: boolean }>(
          'SELECT collects_student_id FROM registration_form WHERE id = $1',
          [id],
        )
      ).rows[0]!.collects_student_id
    assert.equal(await collects(await db.transaction(tx => makeForm(tx, s))), true)
    const split = { payerFee: '0', nonPayerFee: '5000' }
    await assert.rejects(
      db.transaction(tx => makeForm(tx, s, { ...split, collectsStudentId: false })),
      constraint('registration_form_check2'),
    )
    for (const fees of [{}, { payerFee: '3000', nonPayerFee: '3000' }])
      assert.equal(
        await collects(
          await db.transaction(tx => makeForm(tx, s, { ...fees, collectsStudentId: false })),
        ),
        false,
      )
    const form = await db.transaction(tx => makeForm(tx, s, split))
    await assert.rejects(
      db.transaction(tx =>
        updateRecords(tx, [change(s, 'registration_form', form, { collectsStudentId: false })]),
      ),
      constraint('registration_form_check2'),
    )
  } finally {
    await close()
  }
})

test('취소한 신청은 학번만 비우면 되고(이름과 휴대폰은 환불 때까지 남을 수 있다), 학번이 남으면 DB가 거절한다', async () => {
  const { db, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const form = await db.transaction(tx => makeForm(tx, s))
    const keep = { name: '학생', phone: '01012345678', cancelledAt: clockNow }
    await db.transaction(tx => makeRegistration(tx, s, form, { ...keep, studentId: null }))
    await assert.rejects(
      db.transaction(tx => makeRegistration(tx, s, form, { ...keep, studentId: '123456' })),
      constraint('registration_check'),
    )
    await db.transaction(tx => makeRegistration(tx, s, form, { studentId: '123456' }))
    const registration = await db.transaction(tx =>
      makeRegistration(tx, s, form, { studentId: '123456' }),
    )
    await assert.rejects(
      db.transaction(tx =>
        updateRecords(tx, [change(s, 'registration', registration, { cancelledAt: clockNow })]),
      ),
      constraint('registration_check'),
    )
  } finally {
    await close()
  }
})

test('납부 학번은 비울 수 있고 행은 남는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const payment = await db.transaction(tx =>
      createRecord(tx, {
        kind: 'fee_payment',
        councilId: s.mine,
        actor: s.kim,
        values: { studentId: '2024000001', paidFrom: '2026-03-01', paidUntil: '2026-08-31' },
      }),
    )
    await db.transaction(tx =>
      updateRecords(tx, [change(s, 'fee_payment', payment, { studentId: null })]),
    )
    const { rows } = await pg.query<{ student_id: string | null }>(
      'SELECT student_id FROM fee_payment WHERE id = $1',
      [payment],
    )
    assert.equal(rows[0]!.student_id, null)
  } finally {
    await close()
  }
})

test('취소하지 않은 출석은 신청마다 하나이고, 취소하면 다시 둘 수 있으며, 확인 방법은 둘 중 하나다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const form = await db.transaction(tx => makeForm(tx, s))
    const registration = await db.transaction(tx => makeRegistration(tx, s, form))
    const first = await db.transaction(tx => makeAttendance(tx, s, registration))
    await assert.rejects(
      db.transaction(tx => makeAttendance(tx, s, registration, { method: 'manual' })),
      constraint('attendance_registration_id_idx'),
    )
    await assert.rejects(
      db.transaction(tx => makeAttendance(tx, s, registration, { method: 'camera' })),
      constraint('attendance_method_check'),
    )
    await db.transaction(tx =>
      updateRecords(tx, [change(s, 'attendance', first, { cancelledAt: clockNow })]),
    )
    await db.transaction(tx => makeAttendance(tx, s, registration, { method: 'manual' }))
    assert.equal((await pg.query('SELECT 1 FROM attendance')).rows.length, 2)
  } finally {
    await close()
  }
})

test('다른 학생회 행사나 계좌의 양식, 다른 학생회 양식의 신청, 다른 학생회 신청의 출석은 실패하고 하위 행과 판이 없다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const theirForm = await db.transaction(tx =>
      makeForm(tx, { ...s, event: s.theirEvent }, {}, s.theirs),
    )
    const theirRegistration = await db.transaction(tx =>
      createRecord(tx, {
        kind: 'registration',
        councilId: s.theirs,
        actor: null,
        values: { formId: theirForm, name: '학생', appliedFee: '0' },
      }),
    )
    const before = await recordCount(pg)
    const attempts: [string, () => Promise<string>][] = [
      ['양식의 행사', () => db.transaction(tx => makeForm(tx, s, { eventId: s.theirEvent }))],
      [
        '양식의 계좌',
        () => db.transaction(tx => makeForm(tx, s, { feeAccountId: s.theirAccount })),
      ],
      ['신청의 양식', () => db.transaction(tx => makeRegistration(tx, s, theirForm))],
      ['출석의 신청', () => db.transaction(tx => makeAttendance(tx, s, theirRegistration))],
    ]
    for (const [label, attempt] of attempts) {
      await assert.rejects(attempt(), /학생회/, label)
      assert.equal(await recordCount(pg), before, label)
    }
    assert.equal((await pg.query('SELECT 1 FROM attendance')).rows.length, 0)
    assert.equal((await pg.query('SELECT 1 FROM registration')).rows.length, 1)
    assert.equal((await pg.query('SELECT 1 FROM registration_form')).rows.length, 1)
    // 실패한 기록의 판이 없다: 판은 실제 하위 행 값(내 학생회가 가리키면 안 되는 곳)을 담은 것이 하나도 없어야 한다.
    const foreign = [s.theirEvent, s.theirAccount, theirForm, theirRegistration]
    const { rows } = await pg.query<{ data: Record<string, unknown> }>(
      'SELECT v.data FROM record_version v JOIN record r ON r.id = v.record_id WHERE r.council_id = $1',
      [s.mine],
    )
    for (const { data } of rows)
      for (const value of Object.values(data)) assert.ok(!foreign.includes(value as string))
  } finally {
    await close()
  }
})

test('양식의 계좌는 바꿀 때도 같은 학생회여야 하고, 행사·양식·신청은 만든 뒤 바꾸지 못한다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const form = await db.transaction(tx => makeForm(tx, s, { feeAccountId: s.account }))
    const registration = await db.transaction(tx => makeRegistration(tx, s, form))
    const attendance = await db.transaction(tx => makeAttendance(tx, s, registration))
    for (const key of ['feeAccountId', 'fee_account_id']) {
      await assert.rejects(
        db.transaction(tx =>
          updateRecords(tx, [change(s, 'registration_form', form, { [key]: s.theirAccount })]),
        ),
        /학생회/,
        key,
      )
      assert.equal(await versionCount(pg, form), 1)
    }
    await db.transaction(tx =>
      updateRecords(tx, [change(s, 'registration_form', form, { feeAccountId: null })]),
    )
    const owned: [string, string, string[]][] = [
      ['registration_form', form, ['eventId', 'event_id']],
      ['registration', registration, ['formId', 'form_id']],
      ['attendance', attendance, ['registrationId', 'registration_id']],
    ]
    for (const [kind, id, keys] of owned)
      for (const key of keys)
        await assert.rejects(
          db.transaction(tx => updateRecords(tx, [change(s, kind, id, { [key]: null })])),
          /주인 칸/,
          `${kind} ${key}`,
        )
  } finally {
    await close()
  }
})

// 0019가 외래 키를 뺐다: 학생회를 파기해도 열람 기록은 1년 남는다(DEC-55, DEC-72). 같은 학생회의 양식·신청인지는 DB가 아니라
// 부르는 쪽이 지킨다(registrations/applicants.ts·attendance.ts가 운영진의 학생회에서 찾은 양식·신청만 넘긴다). 행동과 IP의 CHECK는 그대로다.
test('열람 기록은 외래 키 없이 남고, 행동과 IP는 CHECK가 막는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const form = await db.transaction(tx => makeForm(tx, s))
    const theirForm = await db.transaction(tx =>
      makeForm(tx, { ...s, event: s.theirEvent }, {}, s.theirs),
    )
    const insert = (formId: string, action: string, ip = '203.0.113.7') =>
      pg.query(
        'INSERT INTO applicant_access_log (member_id, council_id, form_id, action, ip) VALUES ($1, $2, $3, $4, $5)',
        [s.kim, s.mine, formId, action, ip],
      )
    await insert(form, 'list')
    await insert(form, 'check_in', '2001:db8:0:0:0:0:0:1')
    // 가리키는 행이 없어지거나 처음부터 없어도 기록은 남는다(파기한 학생회의 기록).
    await insert(theirForm, 'list')
    await insert('019e0000-0000-7000-8000-000000000000', 'list')
    await assert.rejects(insert(form, 'export'), constraint('applicant_access_log_action_check'))
    await assert.rejects(insert(form, 'list', ''), constraint('applicant_access_log_ip_check'))
    await assert.rejects(
      insert(form, 'list', '1'.repeat(46)),
      constraint('applicant_access_log_ip_check'),
    )
    assert.equal((await pg.query('SELECT 1 FROM applicant_access_log')).rows.length, 4)
  } finally {
    await close()
  }
})

test('개인 링크는 신청마다 하나이고 해시는 소문자 16진 64자다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const form = await db.transaction(tx => makeForm(tx, s))
    const first = await db.transaction(tx => makeRegistration(tx, s, form))
    const second = await db.transaction(tx => makeRegistration(tx, s, form))
    const link = (id: string, hash: string) =>
      pg.query('INSERT INTO registration_link (registration_id, token_hash) VALUES ($1, $2)', [
        id,
        hash,
      ])
    await link(first, 'a'.repeat(64))
    await assert.rejects(link(first, 'b'.repeat(64)))
    await assert.rejects(link(second, 'a'.repeat(64)))
    await assert.rejects(
      link(second, 'A'.repeat(64)),
      constraint('registration_link_token_hash_check'),
    )
    await assert.rejects(
      link(second, 'a'.repeat(63)),
      constraint('registration_link_token_hash_check'),
    )
  } finally {
    await close()
  }
})

// 행사 정산(기능 008 조각 1): 입금 기록, 수입, 요청의 행사.
async function periodOf(tx: Tx, councilId: string, actor: string, year: number) {
  const base = { councilId, actor }
  const fiscalPeriodId = await createRecord(tx, {
    ...base,
    kind: 'fiscal_period',
    values: { name: `${year}`, startsOn: `${year}-01-01`, endsOn: `${year}-12-31` },
  })
  const budgetId = await createRecord(tx, { ...base, kind: 'budget', values: { fiscalPeriodId } })
  const budgetItemId = await createRecord(tx, {
    ...base,
    kind: 'budget_item',
    values: { budgetId, type: 'income', purpose: '참가비', amount: '1000' },
  })
  return { fiscalPeriodId, budgetItemId }
}
const makeIncome = (
  tx: Tx,
  councilId: string,
  actor: string,
  values: { fiscalPeriodId: string } & Record<string, unknown>,
) =>
  createRecord(tx, {
    kind: 'income',
    councilId,
    actor,
    values: { source: 'participation_fee', amount: '1000', receivedOn: '2026-05-01', ...values },
  })
const makeDeposit = (tx: Tx, s: Seed, registrationId: string, values = {}) =>
  createRecord(tx, {
    kind: 'deposit',
    councilId: s.mine,
    actor: s.kim,
    values: { registrationId, amount: '5000', confirmedAt: clockNow, ...values },
  })
const makeRequest = (tx: Tx, s: Seed, values = {}) =>
  createRecord(tx, {
    kind: 'request',
    councilId: s.mine,
    actor: s.kim,
    values: { type: 'purchase', title: '요청', requestedBy: s.kim, ...values },
  })

test('입금 기록과 수입을 만들면 판이 하나이고, 입금 기록의 수입은 바꾸면 판이 는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const form = await db.transaction(tx => makeForm(tx, s))
    const registration = await db.transaction(tx => makeRegistration(tx, s, form))
    const mineOf = await db.transaction(tx => periodOf(tx, s.mine, s.kim, 2026))
    const income = await db.transaction(tx =>
      makeIncome(tx, s.mine, s.kim, { ...mineOf, accountId: s.account }),
    )
    const deposit = await db.transaction(tx => makeDeposit(tx, s, registration))
    for (const id of [income, deposit]) assert.equal(await versionCount(pg, id), 1)
    await db.transaction(tx =>
      updateRecords(tx, [
        change(s, 'deposit', deposit, { incomeId: income }),
        change(s, 'income', income, { description: '고침', cancelledAt: clockNow }),
      ]),
    )
    for (const id of [income, deposit]) assert.equal(await versionCount(pg, id), 2)
    const { rows } = await pg.query<{ income_id: string }>(
      'SELECT income_id FROM deposit WHERE id = $1',
      [deposit],
    )
    assert.equal(rows[0]!.income_id, income)
  } finally {
    await close()
  }
})

test('다른 학생회의 신청, 회계 기간, 예산 항목, 계좌, 행사로 입금 기록·수입·요청을 만들면 실패하고 하위 행과 판이 없다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const theirForm = await db.transaction(tx =>
      makeForm(tx, { ...s, event: s.theirEvent }, {}, s.theirs),
    )
    const theirRegistration = await db.transaction(tx =>
      createRecord(tx, {
        kind: 'registration',
        councilId: s.theirs,
        actor: null,
        values: { formId: theirForm, name: '학생', appliedFee: '0' },
      }),
    )
    const mineOf = await db.transaction(tx => periodOf(tx, s.mine, s.kim, 2026))
    const theirOf = await db.transaction(tx => periodOf(tx, s.theirs, s.kim, 2026))
    const before = await recordCount(pg)
    const income = (values: { fiscalPeriodId: string } & Record<string, unknown>) =>
      db.transaction(tx => makeIncome(tx, s.mine, s.kim, values))
    const attempts: [string, () => Promise<string>][] = [
      ['입금 기록의 신청', () => db.transaction(tx => makeDeposit(tx, s, theirRegistration))],
      ['수입의 회계 기간', () => income({ fiscalPeriodId: theirOf.fiscalPeriodId })],
      [
        '수입의 예산 항목',
        () =>
          income({
            fiscalPeriodId: mineOf.fiscalPeriodId,
            budgetItemId: theirOf.budgetItemId,
          }),
      ],
      [
        '수입의 계좌',
        () => income({ fiscalPeriodId: mineOf.fiscalPeriodId, accountId: s.theirAccount }),
      ],
      ['요청의 행사', () => db.transaction(tx => makeRequest(tx, s, { eventId: s.theirEvent }))],
    ]
    for (const [label, attempt] of attempts) {
      await assert.rejects(attempt(), /학생회/, label)
      assert.equal(await recordCount(pg), before, label)
    }
    for (const table of ['deposit', 'income', 'request'])
      assert.equal((await pg.query(`SELECT 1 FROM ${table}`)).rows.length, 0, table)
  } finally {
    await close()
  }
})

test('입금 기록의 신청·금액, 수입의 회계 기간·출처·금액, 요청의 행사는 바꾸지 못하고, 수입의 예산 항목·계좌와 입금 기록의 수입은 바꿀 때도 같은 학생회여야 한다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const form = await db.transaction(tx => makeForm(tx, s))
    const registration = await db.transaction(tx => makeRegistration(tx, s, form))
    const mineOf = await db.transaction(tx => periodOf(tx, s.mine, s.kim, 2026))
    const theirOf = await db.transaction(tx => periodOf(tx, s.theirs, s.kim, 2026))
    const income = await db.transaction(tx => makeIncome(tx, s.mine, s.kim, mineOf))
    const theirIncome = await db.transaction(tx =>
      makeIncome(tx, s.theirs, s.kim, { fiscalPeriodId: theirOf.fiscalPeriodId }),
    )
    const deposit = await db.transaction(tx => makeDeposit(tx, s, registration))
    const request = await db.transaction(tx => makeRequest(tx, s, { eventId: s.event }))
    const owned: [string, string, string[]][] = [
      ['deposit', deposit, ['registrationId', 'registration_id', 'amount']],
      ['income', income, ['fiscalPeriodId', 'fiscal_period_id', 'source', 'amount']],
      ['request', request, ['eventId', 'event_id']],
    ]
    for (const [kind, id, keys] of owned)
      for (const key of keys)
        await assert.rejects(
          db.transaction(tx => updateRecords(tx, [change(s, kind, id, { [key]: null })])),
          /주인 칸/,
          `${kind} ${key}`,
        )
    const foreign: [string, string, object][] = [
      ['deposit', deposit, { incomeId: theirIncome }],
      ['deposit', deposit, { income_id: theirIncome }],
      ['income', income, { budgetItemId: theirOf.budgetItemId }],
      ['income', income, { budget_item_id: theirOf.budgetItemId }],
      ['income', income, { accountId: s.theirAccount }],
      ['income', income, { account_id: s.theirAccount }],
    ]
    for (const [kind, id, changes] of foreign)
      await assert.rejects(
        db.transaction(tx => updateRecords(tx, [change(s, kind, id, changes)])),
        /학생회/,
        `${kind} ${JSON.stringify(changes)}`,
      )
    for (const id of [deposit, income, request]) assert.equal(await versionCount(pg, id), 1)
    await db.transaction(tx =>
      updateRecords(tx, [
        change(s, 'deposit', deposit, { incomeId: income }),
        change(s, 'income', income, { accountId: s.account, budgetItemId: mineOf.budgetItemId }),
      ]),
    )
    assert.equal(await versionCount(pg, deposit), 2)
  } finally {
    await close()
  }
})

test('취소하지 않은 입금 기록은 신청마다 하나이고 취소하면 다시 둘 수 있다. 환불 시각과 금액은 함께이고 환불액은 입금액 이하다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const form = await db.transaction(tx => makeForm(tx, s))
    const registration = await db.transaction(tx => makeRegistration(tx, s, form))
    const first = await db.transaction(tx => makeDeposit(tx, s, registration))
    await assert.rejects(
      db.transaction(tx => makeDeposit(tx, s, registration)),
      constraint('deposit_registration_id_idx'),
    )
    // 제약마다 따로 지켜지는지 본다. PostgreSQL이 칸 둘에 걸린 검사에 붙인 이름이 달라, 한쪽을 지우면 그 경우가 실패한다.
    // 환불액 검사(0 이상, 입금액 이하)는 deposit_check, 환불 시각과 금액이 함께인지는 deposit_check1이다.
    const bad: [string, string, object][] = [
      ['환불액이 입금액보다 큼', 'deposit_check"', { refundAmount: '5001', refundedAt: clockNow }],
      ['환불액이 음수', 'deposit_check"', { refundAmount: '-1', refundedAt: clockNow }],
      ['금액만 있음', 'deposit_check1"', { refundAmount: '1' }],
      ['시각만 있음', 'deposit_check1"', { refundedAt: clockNow }],
    ]
    for (const [label, name, changes] of bad)
      await assert.rejects(
        db.transaction(tx => updateRecords(tx, [change(s, 'deposit', first, changes)])),
        constraint(name),
        label,
      )
    assert.equal(await versionCount(pg, first), 1)
    await db.transaction(tx =>
      updateRecords(tx, [
        change(s, 'deposit', first, { refundAmount: '5000', refundedAt: clockNow }),
      ]),
    )
    await db.transaction(tx =>
      updateRecords(tx, [change(s, 'deposit', first, { cancelledAt: clockNow })]),
    )
    await db.transaction(tx => makeDeposit(tx, s, registration))
    assert.equal((await pg.query('SELECT 1 FROM deposit')).rows.length, 2)
  } finally {
    await close()
  }
})
