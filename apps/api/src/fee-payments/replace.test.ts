import assert from 'node:assert/strict'
import { test } from 'node:test'
import { withFeePayments } from '../test-support/fee-payments.js'
import { createRecord } from '../records/records.js'

const period = { paidFrom: '2026-01-01', paidUntil: '2026-06-30' }
const body = (students: string, replace = false) => ({ ...period, students, replace })

test(
  '같은 기간은 확인을 요구하고, 교체하면 빠진 학번의 모든 판을 비우며 다른 기간·학생회는 보존한다',
  withFeePayments(async t => {
    assert.equal((await t.upload(body('20260001 20260002'))).status, 200)
    const id = (
      await t.pg.query<{ id: string }>("SELECT id FROM fee_payment WHERE student_id = '20260001'")
    ).rows[0]!.id
    await t.pg.query(
      'UPDATE record_version SET valid = tstzrange(lower(valid), now()) WHERE record_id = $1',
      [id],
    )
    await t.pg.query(
      'INSERT INTO record_version (record_id, version_no, valid, data, changed_by) SELECT record_id, 2, tstzrange(now(), NULL), data, changed_by FROM record_version WHERE record_id = $1',
      [id],
    )
    await t.upload({ ...body('20260001'), paidFrom: '2026-07-01', paidUntil: '2026-12-31' })
    await t.upload(
      body('20260001'),
      'o-financeMember',
      `/api/organizations/${t.other.councilId}/fee-payments`,
    )
    const unconfirmed = await t.upload(body('20260002 20260003'))
    assert.equal(unconfirmed.status, 409)
    assert.deepEqual(await unconfirmed.json(), { error: 'FEE_PAYMENT_REPLACE_REQUIRED' })
    const replaced = await t.upload(body('20260002 20260003', true))
    assert.equal(replaced.status, 200)
    assert.deepEqual(await replaced.json(), { added: 1, skipped: 1 })
    assert.equal(
      await t.count('SELECT count(*) AS n FROM fee_payment WHERE id = $1 AND student_id IS NULL', [
        id,
      ]),
      1,
    )
    assert.equal(
      await t.count(
        "SELECT count(*) AS n FROM record_version WHERE record_id = $1 AND data ->> 'student_id' IS NOT NULL",
        [id],
      ),
      0,
    )
    assert.equal(
      await t.count('SELECT count(*) AS n FROM record_version WHERE record_id = $1', [id]),
      2,
    )
    assert.equal(
      await t.count("SELECT count(*) AS n FROM fee_payment WHERE student_id = '20260001'"),
      2,
    )
    assert.equal(await t.count('SELECT count(*) AS n FROM fee_payment'), 5)
  }),
)

test(
  '교체의 잘못된 입력·권한 거절은 기존 명단을 비우지 않는다',
  withFeePayments(async t => {
    await t.upload(body('20260001'))
    assert.equal(
      (await t.upload({ ...body('20260001', true), paidUntil: '2026-12-31' })).status,
      400,
    )
    for (const students of ['', '  ', '20260002\nabc', '2026\u0000001', '\ud800'])
      assert.equal((await t.upload(body(students, true))).status, 400)
    for (const user of ['s-president', 's-plain', 'o-financeMember'])
      assert.equal((await t.upload(body('20260002', true), user)).status, 403)
    assert.equal((await t.api.post(t.base, body('20260002', true))).status, 401)
    assert.equal(
      await t.count("SELECT count(*) AS n FROM fee_payment WHERE student_id = '20260001'"),
      1,
    )
  }),
)

test(
  '명단에서 빠져도 이미 신청한 사람의 참가비와 판은 그대로다',
  withFeePayments(async t => {
    await t.upload(body('20260001'))
    const registrationId = await t.db.transaction(async tx => {
      const common = { councilId: t.council.councilId, actor: t.council.people.president.memberId }
      const eventId = await createRecord(tx, { ...common, kind: 'event', values: { name: '행사' } })
      const formId = await createRecord(tx, {
        ...common,
        kind: 'registration_form',
        values: {
          eventId,
          name: '신청',
          closesAt: new Date('2026-12-31T00:00:00Z'),
          publicCode: 'ABCDEFGH',
        },
      })
      return createRecord(tx, {
        ...common,
        kind: 'registration',
        values: {
          formId,
          name: '김학생',
          studentId: '20260001',
          appliedFee: '1000',
        },
      })
    })
    const before = await t.pg.query('SELECT data FROM record_version WHERE record_id = $1', [
      registrationId,
    ])
    assert.equal((await t.upload(body('20260002', true))).status, 200)
    assert.equal(
      await t.count('SELECT count(*) AS n FROM registration WHERE id = $1 AND applied_fee = 1000', [
        registrationId,
      ]),
      1,
    )
    assert.deepEqual(
      (await t.pg.query('SELECT data FROM record_version WHERE record_id = $1', [registrationId]))
        .rows,
      before.rows,
    )
  }),
)
