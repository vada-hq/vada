import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  PURCHASE_REASON_MAX,
  WON_MAX,
  type ApplicantsResponse,
  type ApplicantChange,
  type CheckInResult,
  type StaffCancelResponse,
  type StaffDepositResponse,
} from '@vada/contracts'
import { MISSING, type RegistrationKit, withRegistrations } from '../test-support/registrations.js'

const kim = { name: '김입금', studentId: '202612345', phone: '01012345678' }
const FEE = 5000
const errorOf = async (response: Response) => ((await response.json()) as { error: string }).error

// 학번과 휴대폰을 받는 양식(미납자 5,000원)에 신청 하나. 재정부 계좌가 있다.
async function started(t: RegistrationKit, applicant = kim) {
  const event = await t.makeEvent()
  const [existing] = (await t.pg.query('SELECT id FROM account LIMIT 1')).rows as { id: string }[]
  const account = existing?.id ?? (await t.makeAccount())
  const { form } = await t.activeForm(event, {
    payerFee: 0,
    nonPayerFee: FEE,
    feeAccountId: account,
    collectsPhone: true,
  })
  const token = await t.applied(form.publicCode, applicant)
  const id = (
    (await t.pg.query('SELECT id FROM registration ORDER BY id DESC LIMIT 1')).rows[0] as {
      id: string
    }
  ).id
  return { event, form, token, id }
}
const confirm = (t: RegistrationKit, id: string, body: unknown = {}, user = 's-president') =>
  t.post(`/registrations/${id}/deposit`, body, user)
const cancelDeposit = (t: RegistrationKit, id: string, body: unknown, user = 's-president') =>
  t.post(`/registrations/${id}/deposit/cancel`, body, user)
const refund = (t: RegistrationKit, id: string, body: unknown = {}, user = 's-financeMember') =>
  t.post(`/registrations/${id}/refund`, body, user)
const cancelStaff = (t: RegistrationKit, id: string) => t.post(`/registrations/${id}/cancel`, {})
const rowOf = async (t: RegistrationKit, id: string) =>
  (
    await t.pg.query(
      'SELECT name, student_id, phone, cancelled_at IS NOT NULL AS cancelled FROM registration WHERE id = $1',
      [id],
    )
  ).rows[0] as {
    name: string | null
    student_id: string | null
    phone: string | null
    cancelled: boolean
  }
const liveDeposits = (t: RegistrationKit) =>
  t.count('SELECT count(*) AS n FROM deposit WHERE cancelled_at IS NULL')
const allDeposits = (t: RegistrationKit) => t.count('SELECT count(*) AS n FROM deposit')
// 이 신청의 판 가운데 이름·학번·휴대폰이 남은 칸의 수
const personalInVersions = async (t: RegistrationKit, id: string) =>
  (
    await t.pg.query(
      `SELECT (count(*) FILTER (WHERE data ->> 'name' IS NOT NULL))::int AS name,
              (count(*) FILTER (WHERE data ->> 'student_id' IS NOT NULL))::int AS student_id,
              (count(*) FILTER (WHERE data ->> 'phone' IS NOT NULL))::int AS phone
       FROM record_version WHERE record_id = $1`,
      [id],
    )
  ).rows[0] as { name: number; student_id: number; phone: number }
const listOf = async (t: RegistrationKit, formId: string, query = '') =>
  (await (
    await t.api.get(`${t.orgBase}/registration-forms/${formId}/applicants${query}`, 's-president')
  ).json()) as ApplicantsResponse

test(
  '입금 확인: 금액을 빼면 적용 참가비로 201이고 입금 기록과 판 1이 생기며, 목록에 확인한 금액이 보인다',
  withRegistrations(async t => {
    const { form, id } = await started(t)
    const response = await confirm(t, id)
    assert.equal(response.status, 201)
    const body = (await response.json()) as StaffDepositResponse
    assert.deepEqual(body.deposit, { status: 'confirmed', amount: FEE })
    assert.deepEqual(body.applicant, {
      id,
      attended: false,
      absent: false,
      cancelled: false,
      deposit: { status: 'confirmed', amount: FEE },
      listed: true,
      actions: [
        'registration.check_in',
        'registration.mark_absent',
        'registration.cancel',
        'deposit.cancel',
      ],
    })
    const { rows } = await t.pg.query<{
      registration_id: string
      amount: number
      cancelled_at: Date | null
      refunded_at: Date | null
      id: string
    }>(
      'SELECT d.registration_id, d.amount::int AS amount, d.cancelled_at, d.refunded_at, d.id FROM deposit d',
    )
    assert.equal(rows.length, 1)
    assert.deepEqual(
      [rows[0]!.registration_id, rows[0]!.amount, rows[0]!.cancelled_at, rows[0]!.refunded_at],
      [id, FEE, null, null],
    )
    assert.equal(await t.versions(rows[0]!.id), 1)
    const list = await listOf(t, form.id)
    assert.deepEqual(list.applicants[0]!.deposit, { status: 'confirmed', amount: FEE })
    assert.equal(list.applicants[0]!.cancelled, false)
  }),
)

test(
  '입금 확인: 적은 금액이 우선이고, 적용 참가비가 0원인데 금액이 없으면 400이다',
  withRegistrations(async t => {
    const { id } = await started(t)
    const response = await confirm(t, id, { amount: 3000 })
    assert.equal(response.status, 201)
    assert.equal(await t.count('SELECT amount::int AS n FROM deposit'), 3000)
    // 참가비가 없는 양식의 신청
    const event = await t.makeEvent()
    const { form } = await t.activeForm(event, { collectsStudentId: false })
    await t.applied(form.publicCode, { name: '무료', studentId: null, phone: null })
    const free = (
      (await t.pg.query('SELECT id FROM registration ORDER BY id DESC LIMIT 1')).rows[0] as {
        id: string
      }
    ).id
    const none = await confirm(t, free)
    assert.equal(none.status, 400)
    assert.equal(await allDeposits(t), 1)
    // 참가비 없는 신청은 금액을 적어도 입금을 확인하지 않는다(읽기 actions와 같은 판정).
    assert.equal((await confirm(t, free, { amount: 1 })).status, 400)
    assert.equal(await allDeposits(t), 1)
  }),
)

const BAD_CONFIRMS: [string, unknown][] = [
  ['0원', { amount: 0 }],
  ['음수', { amount: -1 }],
  ['10억 원 + 1', { amount: WON_MAX + 1 }],
  ['소수', { amount: 1.5 }],
  ['글자 금액', { amount: '5000' }],
  ['모르는 키', { amount: 1000, extra: 1 }],
]

test(
  '입금 확인의 틀린 입력은 400이고 입금 기록이 생기지 않는다. 경계값(1원, 10억 원)은 된다',
  withRegistrations(async t => {
    const { id } = await started(t)
    for (const [label, body] of BAD_CONFIRMS)
      assert.equal((await confirm(t, id, body)).status, 400, label)
    assert.equal(await allDeposits(t), 0)
    assert.equal((await confirm(t, id, { amount: WON_MAX })).status, 201)
    assert.equal((await cancelDeposit(t, id, { reason: '잘못 확인' })).status, 200)
    assert.equal((await confirm(t, id, { amount: 1 })).status, 201)
  }),
)

test(
  '입금 확인은 책임자, 담당 부서, 회장단만: 재정부만인 사람, 담당 아닌 부장, 업무 없는 사람, 다른 학생회 사람은 403이고 기록이 없다',
  withRegistrations(async t => {
    const { id, event } = await started(t)
    for (const user of [
      's-financeMember',
      's-planningHead',
      's-planningMember',
      's-plain',
      'o-president',
    ])
      assert.equal((await confirm(t, id, {}, user)).status, 403, user)
    assert.equal(await allDeposits(t), 0)
    assert.equal((await t.api.post(`${t.orgBase}/registrations/${id}/deposit`, {})).status, 401)
    // 담당 부서는 업무가 있으면 된다. 책임자도 된다.
    await t.makeTask(event, t.council.departments.planning)
    assert.equal((await confirm(t, id, {}, 's-planningMember')).status, 201)
    assert.equal(
      (await cancelDeposit(t, id, { reason: '확인 취소' }, 's-planningMember')).status,
      200,
    )
    await t.pg.query('UPDATE event SET owner_id = $1', [t.council.people.plain.memberId])
    assert.equal((await confirm(t, id, {}, 's-plain')).status, 201)
  }),
)

test(
  '없는 신청, 형식이 틀린 번호, 다른 학생회 신청, 취소한 신청의 입금 확인은 404이고 입금 기록이 없다',
  withRegistrations(async t => {
    const { id } = await started(t)
    assert.equal((await confirm(t, MISSING)).status, 404)
    assert.equal((await confirm(t, 'x')).status, 404)
    const theirEvent = await t.makeEvent({}, t.other)
    const theirForm = await t.makeForm(theirEvent, {}, t.other)
    const theirs = await t.makeRegistration(theirForm, {}, t.other)
    assert.equal((await confirm(t, theirs)).status, 404)
    assert.equal((await cancelDeposit(t, theirs, { reason: '가' })).status, 404)
    assert.equal((await refund(t, theirs)).status, 404)
    assert.equal((await cancelStaff(t, id)).status, 200)
    assert.equal((await confirm(t, id)).status, 404)
    assert.equal(await allDeposits(t), 0)
  }),
)

test(
  '이미 확인했으면 409 DEPOSIT_EXISTS이고 입금 기록은 하나다. 동시에 둘이 확인해도 하나만 된다',
  withRegistrations(async t => {
    const { id } = await started(t)
    assert.equal((await confirm(t, id)).status, 201)
    const again = await confirm(t, id)
    assert.equal(again.status, 409)
    assert.equal(await errorOf(again), 'DEPOSIT_EXISTS')
    assert.equal(await allDeposits(t), 1)
    const second = (await started(t, { ...kim, name: '박동시' })).id
    const results = await Promise.all([confirm(t, second), confirm(t, second)])
    assert.deepEqual(
      results.map(r => r.status).sort((a, b) => a - b),
      [201, 409],
    )
    assert.equal(await allDeposits(t), 2)
  }),
)

test(
  '확인 취소: 사유를 판에 남기고 입금 기록은 지우지 않으며, 다시 확인할 수 있다. 입금이 없으면 409 NO_DEPOSIT이다',
  withRegistrations(async t => {
    const { id, form } = await started(t)
    const none = await cancelDeposit(t, id, { reason: '없다' })
    assert.equal(none.status, 409)
    assert.equal(await errorOf(none), 'NO_DEPOSIT')
    await confirm(t, id)
    const depositId = ((await t.pg.query('SELECT id FROM deposit')).rows[0] as { id: string }).id
    const response = await cancelDeposit(t, id, { reason: '다른 사람 입금이었다' })
    assert.equal(response.status, 200)
    const body = (await response.json()) as StaffDepositResponse
    assert.deepEqual(body.deposit, { status: 'none', amount: null })
    assert.deepEqual(body.applicant.actions, [
      'registration.check_in',
      'registration.mark_absent',
      'registration.cancel',
      'deposit.confirm',
    ])
    const { rows } = await t.pg.query<{ cancelled_at: Date | null }>(
      'SELECT cancelled_at FROM deposit',
    )
    assert.equal(rows.length, 1)
    assert.notEqual(rows[0]!.cancelled_at, null)
    const versions = await t.pg.query<{ version_no: number; reason: string | null }>(
      'SELECT version_no, reason FROM record_version WHERE record_id = $1 ORDER BY version_no',
      [depositId],
    )
    assert.deepEqual(
      versions.rows.map(r => [r.version_no, r.reason]),
      [
        [1, null],
        [2, '다른 사람 입금이었다'],
      ],
    )
    // 살아 있는 신청은 이름이 그대로고 목록의 입금 상태는 없다.
    assert.equal((await rowOf(t, id)).name, kim.name)
    assert.deepEqual((await listOf(t, form.id)).applicants[0]!.deposit, {
      status: 'none',
      amount: null,
    })
    assert.equal((await confirm(t, id)).status, 201)
    assert.equal(await allDeposits(t), 2)
    assert.equal(await liveDeposits(t), 1)
    const bad = await cancelDeposit(t, id, { reason: '다시 취소' }, 's-financeMember')
    assert.equal(bad.status, 403)
  }),
)

const BAD_REASONS: [string, unknown][] = [
  ['사유 없음', {}],
  ['빈 문자열', { reason: '' }],
  ['공백만', { reason: '   ' }],
  ['상한 + 1', { reason: '가'.repeat(PURCHASE_REASON_MAX + 1) }],
  ['이모지로 상한 + 1', { reason: '😀'.repeat(PURCHASE_REASON_MAX + 1) }],
  ['NUL', { reason: '가\u0000나' }],
  ['홀로 쓰인 서러게이트', { reason: '가\uD800' }],
  ['모르는 키', { reason: '가', extra: 1 }],
]

test(
  '확인 취소의 틀린 사유는 400이고 입금은 그대로다. 상한 글자 수는 된다',
  withRegistrations(async t => {
    const { id } = await started(t)
    await confirm(t, id)
    for (const [label, body] of BAD_REASONS)
      assert.equal((await cancelDeposit(t, id, body)).status, 400, label)
    assert.equal(await liveDeposits(t), 1)
    assert.equal(
      (await cancelDeposit(t, id, { reason: '😀'.repeat(PURCHASE_REASON_MAX) })).status,
      200,
    )
  }),
)

test(
  '입금한 신청을 스스로 취소하면 학번만 지금 값과 모든 판에서 비고 이름·휴대폰 번호가 남아 환불 대기가 된다. 개인 링크는 지운다',
  withRegistrations(async t => {
    const { id, token, form } = await started(t)
    await confirm(t, id)
    assert.equal((await t.cancelMine(token)).status, 200)
    assert.deepEqual(await rowOf(t, id), {
      name: kim.name,
      student_id: null,
      phone: kim.phone,
      cancelled: true,
    })
    const left = await personalInVersions(t, id)
    assert.equal(left.student_id, 0)
    assert.notEqual(left.name, 0)
    assert.notEqual(left.phone, 0)
    assert.equal(await t.count('SELECT count(*) AS n FROM registration_link'), 0)
    const [pending] = (await listOf(t, form.id)).applicants
    assert.deepEqual(
      [pending!.name, pending!.studentId, pending!.phone, pending!.cancelled, pending!.deposit],
      [kim.name, null, kim.phone, true, { status: 'refund_pending', amount: FEE }],
    )
  }),
)

test(
  '입금한 신청을 운영진이 취소해도 같다. 입금 전 취소와 입금 확인을 취소한 신청의 취소는 이름·학번·휴대폰이 모두 빈다',
  withRegistrations(async t => {
    const { id } = await started(t)
    await confirm(t, id)
    assert.equal((await cancelStaff(t, id)).status, 200)
    assert.deepEqual(await rowOf(t, id), {
      name: kim.name,
      student_id: null,
      phone: kim.phone,
      cancelled: true,
    })
    const plain = (await started(t, { ...kim, name: '입금전' })).id
    assert.equal((await cancelStaff(t, plain)).status, 200)
    assert.deepEqual(await rowOf(t, plain), {
      name: null,
      student_id: null,
      phone: null,
      cancelled: true,
    })
    assert.deepEqual(await personalInVersions(t, plain), { name: 0, student_id: 0, phone: 0 })
    // 입금을 확인했다 취소한 신청은 입금이 없는 것과 같다.
    const undone = (await started(t, { ...kim, name: '확인취소' })).id
    await confirm(t, undone)
    await cancelDeposit(t, undone, { reason: '아니었다' })
    assert.equal((await cancelStaff(t, undone)).status, 200)
    assert.deepEqual((await rowOf(t, undone)).name, null)
    assert.deepEqual(await personalInVersions(t, undone), {
      name: 0,
      student_id: 0,
      phone: 0,
    })
  }),
)

test(
  '환불 대기 신청의 입금 확인을 취소하면 같은 거래에서 이름·휴대폰 번호가 지금 값과 모든 판에서 빈다',
  withRegistrations(async t => {
    const { id, form } = await started(t)
    await confirm(t, id)
    await cancelStaff(t, id)
    assert.notEqual((await rowOf(t, id)).name, null)
    const response = await cancelDeposit(t, id, { reason: '잘못 눌렀다' })
    assert.equal(response.status, 200)
    assert.deepEqual(await rowOf(t, id), {
      name: null,
      student_id: null,
      phone: null,
      cancelled: true,
    })
    assert.deepEqual(await personalInVersions(t, id), { name: 0, student_id: 0, phone: 0 })
    assert.deepEqual((await listOf(t, form.id)).applicants, [])
  }),
)

test(
  '환불함: 재정부만. 환불 시각과 금액이 남고 이름·휴대폰 번호는 모든 판에서 비며 입금 금액은 남는다',
  withRegistrations(async t => {
    const { id, form } = await started(t)
    await confirm(t, id)
    await cancelStaff(t, id)
    for (const user of ['s-president', 's-plain', 's-planningMember', 'o-president'])
      assert.equal((await refund(t, id, {}, user)).status, 403, user)
    assert.equal((await rowOf(t, id)).name, kim.name)
    const response = await refund(t, id)
    assert.equal(response.status, 200)
    const body = (await response.json()) as StaffDepositResponse
    assert.deepEqual(body.deposit, { status: 'refunded', amount: FEE })
    // 환불함으로 줄이 목록에서 빠지며 동작도 없다
    assert.deepEqual(body.applicant.actions, [])
    const { rows } = await t.pg.query(
      'SELECT amount::int AS amount, refund_amount::int AS refund_amount, refunded_at IS NOT NULL AS refunded FROM deposit',
    )
    assert.deepEqual(rows, [{ amount: FEE, refund_amount: FEE, refunded: true }])
    assert.deepEqual(await rowOf(t, id), {
      name: null,
      student_id: null,
      phone: null,
      cancelled: true,
    })
    assert.deepEqual(await personalInVersions(t, id), { name: 0, student_id: 0, phone: 0 })
    assert.deepEqual((await listOf(t, form.id)).applicants, [])
  }),
)

test(
  '환불함은 환불 대기에만, 한 번: 살아 있는 신청, 입금이 없는 신청, 이미 환불한 신청은 409 NOT_REFUNDABLE이다',
  withRegistrations(async t => {
    const live = (await started(t)).id
    await confirm(t, live)
    const early = await refund(t, live)
    assert.equal(early.status, 409)
    assert.equal(await errorOf(early), 'NOT_REFUNDABLE')
    const nothing = (await started(t, { ...kim, name: '무입금' })).id
    await cancelStaff(t, nothing)
    assert.equal(await errorOf(await refund(t, nothing)), 'NOT_REFUNDABLE')
    // 입금을 확인했다 취소한 뒤 취소한 신청도 환불할 입금이 없다.
    const undone = (await started(t, { ...kim, name: '취소함' })).id
    await confirm(t, undone)
    await cancelDeposit(t, undone, { reason: '아니었다' })
    await cancelStaff(t, undone)
    assert.equal(await errorOf(await refund(t, undone)), 'NOT_REFUNDABLE')
    await cancelStaff(t, live)
    assert.equal((await refund(t, live)).status, 200)
    assert.equal(await errorOf(await refund(t, live)), 'NOT_REFUNDABLE')
    assert.equal(
      await t.count('SELECT count(*) AS n FROM deposit WHERE refunded_at IS NOT NULL'),
      1,
    )
  }),
)

test(
  '환불 금액은 입금액까지: 일부 환불은 그 금액이 남고, 입금액보다 크거나 틀린 금액은 400이며 이름은 그대로다. 환불한 입금의 확인 취소는 409 DEPOSIT_CLOSED이다',
  withRegistrations(async t => {
    const { id } = await started(t)
    await confirm(t, id)
    await cancelStaff(t, id)
    for (const body of [
      { amount: FEE + 1 },
      { amount: 0 },
      { amount: -1 },
      { amount: WON_MAX + 1 },
      { x: 1 },
    ])
      assert.equal((await refund(t, id, body)).status, 400, JSON.stringify(body))
    assert.equal((await rowOf(t, id)).name, kim.name)
    assert.equal((await refund(t, id, { amount: 1000 })).status, 200)
    assert.equal(await t.count('SELECT refund_amount::int AS n FROM deposit'), 1000)
    const closed = await cancelDeposit(t, id, { reason: '환불했다' })
    assert.equal(closed.status, 409)
    assert.equal(await errorOf(closed), 'DEPOSIT_CLOSED')
    assert.equal(await liveDeposits(t), 1)
  }),
)

test(
  '신청자 목록: 입금 상태와 거르기(입금, 환불 대기). 환불 대기는 목록에 남고 환불한 신청은 빠진다. 틀린 거르기는 400이다',
  withRegistrations(async t => {
    const { form } = await started(t)
    const another = async (name: string, studentId: string) => {
      await t.applied(form.publicCode, { ...kim, name, studentId })
      return (
        (await t.pg.query('SELECT id FROM registration ORDER BY id DESC LIMIT 1')).rows[0] as {
          id: string
        }
      ).id
    }
    const paid = await another('입금함', '202612346')
    const pending = await another('대기함', '202612347')
    const refunded = await another('환불함', '202612348')
    for (const id of [paid, pending, refunded]) await confirm(t, id)
    for (const id of [pending, refunded]) await cancelStaff(t, id)
    await refund(t, refunded)
    const names = async (query = '') =>
      (await listOf(t, form.id, query)).applicants.map(a => [a.name, a.deposit.status])
    assert.deepEqual(await names(), [
      [kim.name, 'none'],
      ['입금함', 'confirmed'],
      ['대기함', 'refund_pending'],
    ])
    assert.deepEqual(await names('?filter=deposited'), [['입금함', 'confirmed']])
    assert.deepEqual(await names('?filter=refund_pending'), [['대기함', 'refund_pending']])
    const bad = await t.api.get(
      `${t.orgBase}/registration-forms/${form.id}/applicants?filter=all`,
      's-president',
    )
    assert.equal(bad.status, 400)
  }),
)

test(
  '신청자 목록의 열람 권한은 그대로다: 재정부는 입금 상태까지 보고, 권한 없는 사람은 403이며 열람 기록이 없다',
  withRegistrations(async t => {
    const { id, form } = await started(t)
    await confirm(t, id)
    const finance = await t.api.get(
      `${t.orgBase}/registration-forms/${form.id}/applicants`,
      's-financeMember',
    )
    assert.equal(finance.status, 200)
    const before = await t.count('SELECT count(*) AS n FROM applicant_access_log')
    const plain = await t.api.get(
      `${t.orgBase}/registration-forms/${form.id}/applicants`,
      's-plain',
    )
    assert.equal(plain.status, 403)
    assert.equal(await t.count('SELECT count(*) AS n FROM applicant_access_log'), before)
  }),
)

test(
  '입금 확인·확인 취소·환불함은 신청자 정보를 응답에 담지 않고 열람 기록을 남기지 않는다',
  withRegistrations(async t => {
    const { id } = await started(t)
    const texts: string[] = []
    texts.push(await (await confirm(t, id)).text())
    texts.push(await (await cancelDeposit(t, id, { reason: '사유' })).text())
    await confirm(t, id)
    await cancelStaff(t, id)
    texts.push(await (await refund(t, id)).text())
    for (const text of texts)
      for (const secret of [kim.name, kim.studentId, kim.phone])
        assert.ok(!text.includes(secret), text)
    assert.equal(await t.count('SELECT count(*) AS n FROM applicant_access_log'), 0)
  }),
)

test(
  '다른 학생회 사용자의 입금 확인 취소와 환불함은 403이고 입금 기록은 그대로다',
  withRegistrations(async t => {
    const { id } = await started(t)
    assert.equal((await confirm(t, id)).status, 201)
    const versions = () =>
      t.count(
        'SELECT count(*) AS n FROM record_version WHERE record_id IN (SELECT id FROM deposit)',
      )
    const before = await versions()
    for (const user of ['o-president', 'o-financeMember']) {
      assert.equal((await cancelDeposit(t, id, { reason: '남의 것' }, user)).status, 403, user)
      assert.equal((await refund(t, id, {}, user)).status, 403, user)
    }
    assert.equal(await versions(), before)
    assert.equal(await allDeposits(t), 1)
    assert.equal(
      await t.count('SELECT count(*) AS n FROM deposit WHERE cancelled_at IS NOT NULL'),
      0,
    )
  }),
)

// 신청자 줄을 바꾸는 쓰기의 응답은 같은 거래에서 센 그 줄의 새 모습이고, 이어서 읽은 목록의 그 줄과 같다.
test(
  '쓰기 응답의 applicant(상태 칸과 actions)는 이어서 읽은 목록의 같은 줄과 같고 신청자 정보를 담지 않는다',
  withRegistrations(async t => {
    const { form, id } = await started(t)
    // 목록에 남은 줄은 응답과 값이 모두 같다(listed 포함).
    const inList = async (): Promise<ApplicantChange> => {
      const row = (await listOf(t, form.id)).applicants.find(item => item.id === id)
      if (!row) throw new Error('목록에 없다')
      return {
        id,
        attended: row.attended,
        absent: row.absent,
        cancelled: row.cancelled,
        deposit: row.deposit,
        listed: true,
        actions: row.actions,
      }
    }
    const attended = (await (
      await t.post(`/registrations/${id}/attendance`, {})
    ).json()) as CheckInResult
    assert.deepEqual(attended.applicant, await inList())
    assert.deepEqual(attended.applicant.actions, [
      'registration.cancel_check_in',
      'deposit.confirm',
    ])
    const undone = (await (
      await t.post(`/registrations/${id}/attendance/cancel`, {})
    ).json()) as StaffCancelResponse
    assert.deepEqual(undone.applicant, await inList())
    const confirmed = (await (await confirm(t, id)).json()) as StaffDepositResponse
    assert.deepEqual(confirmed.applicant, await inList())
    const cancelled = (await (await cancelStaff(t, id)).json()) as StaffCancelResponse
    assert.deepEqual(cancelled.applicant, await inList())
    assert.equal(cancelled.applicant.deposit.status, 'refund_pending')
    assert.deepEqual(cancelled.applicant.actions, ['deposit.cancel'])
    assert.equal(cancelled.applicant.listed, true)
    // 환불함으로 목록에서 빠지면 listed도 거짓이다.
    const refunded = (await (await refund(t, id)).json()) as StaffDepositResponse
    assert.equal(refunded.applicant.listed, false)
    assert.equal(
      (await listOf(t, form.id)).applicants.some(item => item.id === id),
      false,
    )
    // 입금 없이 취소해도 빠진다.
    const second = await t.applied(form.publicCode, {
      name: '이둘째',
      studentId: '202600002',
      phone: '01099998888',
    })
    assert.ok(second)
    const secondId = (
      (await t.pg.query('SELECT id FROM registration ORDER BY id DESC LIMIT 1')).rows[0] as {
        id: string
      }
    ).id
    const voided = (await (await cancelStaff(t, secondId)).json()) as StaffCancelResponse
    assert.equal(voided.applicant.listed, false)
    assert.equal(
      (await listOf(t, form.id)).applicants.some(item => item.id === secondId),
      false,
    )
    // 신청자 정보(이름, 학번, 휴대폰)는 담지 않는다.
    assert.deepEqual(Object.keys(cancelled.applicant).sort(), [
      'absent',
      'actions',
      'attended',
      'cancelled',
      'deposit',
      'id',
      'listed',
    ])
  }),
)
