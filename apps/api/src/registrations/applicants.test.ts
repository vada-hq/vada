import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ApplicantsResponse } from '@vada/contracts'
import { MISSING, type RegistrationKit, withRegistrations } from '../test-support/registrations.js'

const kim = { name: '김납부', studentId: '202612345', phone: null }
const lee = { name: '이미납', studentId: '202699999', phone: null }

// 납부자 참가비 0원·미납자 5,000원인 양식과 학번을 받는 신청 둘. 김씨는 납부 기간 안이다.
async function split(t: RegistrationKit) {
  const event = await t.makeEvent()
  const account = await t.makeAccount()
  await t.makeFeePayment({
    studentId: kim.studentId,
    paidFrom: '2026-10-01',
    paidUntil: '2026-10-31',
  })
  const { form } = await t.activeForm(event, {
    payerFee: 0,
    nonPayerFee: 5000,
    feeAccountId: account,
  })
  await t.applied(form.publicCode, kim)
  await t.applied(form.publicCode, lee)
  return { event, form }
}
const listOf = async (t: RegistrationKit, formId: string, user = 's-president') =>
  t.api.get(`${t.orgBase}/registration-forms/${formId}/applicants`, user)
const logs = (t: RegistrationKit) => t.count('SELECT count(*) AS n FROM applicant_access_log')

test(
  '신청자 목록: 신청 순으로 이름·학번·적용 참가비·납부자 여부·출석을 주고 열람 기록이 한 줄 남는다',
  withRegistrations(async t => {
    const { form } = await split(t)
    const id = (
      (await t.pg.query('SELECT id FROM registration ORDER BY id')).rows[0] as { id: string }
    ).id
    await t.attend(id)
    const response = await listOf(t, form.id)
    assert.equal(response.status, 200)
    const body = (await response.json()) as ApplicantsResponse
    assert.equal(body.truncated, false)
    assert.deepEqual(
      body.applicants.map(a => [a.name, a.studentId, a.appliedFee, a.payer, a.attended]),
      [
        ['김납부', kim.studentId, 0, true, true],
        ['이미납', lee.studentId, 5000, false, false],
      ],
    )
    assert.match(body.applicants[0]!.appliedAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d$/)
    const { rows } = await t.pg.query(
      'SELECT member_id, council_id, form_id, registration_id, action, ip FROM applicant_access_log',
    )
    assert.deepEqual(rows, [
      {
        member_id: t.council.people.president.memberId,
        council_id: t.council.councilId,
        form_id: form.id,
        registration_id: null,
        action: 'list',
        ip: 'unknown',
      },
    ])
  }),
)

test(
  '참가비가 같은 양식은 납부자 여부가 null이고, 취소한 신청은 없으며, 같은 행사의 같은 학번은 양식이 달라도 표시된다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const first = (await t.activeForm(event, { name: '하나', collectsStudentId: false })).form
    const gone = await t.applied(first.publicCode, { name: '취소함', studentId: null, phone: null })
    await t.applied(first.publicCode, { name: '가', studentId: null, phone: null })
    assert.equal((await t.cancelMine(gone)).status, 200)
    // 같은 학번은 학번을 받는 양식(참가비가 갈리는 양식) 둘에서 만든다.
    const split = (
      await t.activeForm(event, {
        name: '셋',
        payerFee: 0,
        nonPayerFee: 1000,
        feeAccountId: await t.makeAccount(),
      })
    ).form
    const other = (
      await t.activeForm(event, {
        name: '넷',
        payerFee: 0,
        nonPayerFee: 2000,
        feeAccountId: split.feeAccount!.id,
      })
    ).form
    await t.applied(split.publicCode, kim)
    await t.applied(other.publicCode, kim)
    await t.applied(other.publicCode, lee)
    const same = (await (await listOf(t, first.id)).json()) as ApplicantsResponse
    assert.deepEqual(
      same.applicants.map(a => [a.name, a.payer, a.duplicateStudentId]),
      [['가', null, false]],
    )
    const dup = (await (await listOf(t, other.id)).json()) as ApplicantsResponse
    assert.deepEqual(
      dup.applicants.map(a => [a.name, a.duplicateStudentId]),
      [
        ['김납부', true],
        ['이미납', false],
      ],
    )
  }),
)

test(
  '열람 권한자: 회장단, 책임자, 담당 부서, 재정부는 보고, 담당 아닌 부장과 업무 없는 사람은 403이고 기록이 남지 않는다',
  withRegistrations(async t => {
    const { people, departments } = t.council
    const event = await t.makeEvent({ ownerId: people.plain.memberId })
    await t.makeTask(event, departments.planning)
    const { form } = await t.activeForm(event)
    const viewers = [
      's-president',
      's-vicePresident',
      's-financeMember',
      's-planningMember',
      's-planningHead',
      's-plain',
    ]
    for (const user of viewers) assert.equal((await listOf(t, form.id, user)).status, 200, user)
    assert.equal(await logs(t), viewers.length)
    // 담당이 아닌 행사의 양식
    const bare = await t.makeEvent()
    const bareForm = (await t.activeForm(bare)).form
    const before = await logs(t)
    for (const user of [
      's-planningMember',
      's-planningHead',
      's-plain',
      's-ended',
      'o-president',
    ]) {
      const response = await listOf(t, bareForm.id, user)
      assert.equal(response.status, 403, user)
      assert.deepEqual(await response.json(), { error: 'FORBIDDEN' })
    }
    assert.equal((await listOf(t, bareForm.id, 's-financeMember')).status, 200)
    assert.equal(await logs(t), before + 1)
  }),
)

test(
  '담당 부서 권한은 업무가 바로 가른다: 업무를 취소하면 그 부서 사람은 바로 403이다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const task = await t.makeTask(event, t.council.departments.planning)
    const { form } = await t.activeForm(event)
    assert.equal((await listOf(t, form.id, 's-planningMember')).status, 200)
    await t.change('task', task, { cancelledAt: new Date() })
    assert.equal((await listOf(t, form.id, 's-planningMember')).status, 403)
  }),
)

test(
  '로그인하지 않으면 401, 없는 양식과 다른 학생회 양식은 404이고 둘 다 기록이 없다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const { form } = await t.activeForm(event)
    assert.equal(
      (await t.api.get(`${t.orgBase}/registration-forms/${form.id}/applicants`)).status,
      401,
    )
    assert.equal((await listOf(t, MISSING)).status, 404)
    assert.equal((await listOf(t, 'x')).status, 404)
    const theirEvent = await t.makeEvent({}, t.other)
    const theirForm = await t.makeForm(theirEvent, {}, t.other)
    assert.equal((await listOf(t, theirForm)).status, 404)
    // 다른 학생회 사람이 이 학생회 경로로 부르면 운영진이 아니라 403이다.
    assert.equal((await listOf(t, form.id, 'o-president')).status, 403)
    assert.equal(await logs(t), 0)
  }),
)

test(
  '열람 기록을 못 쓰면 목록이 오지 않는다: 기록 쓰기가 실패하면 500이고 신청자 정보가 응답에 없다',
  withRegistrations(async t => {
    const { form } = await split(t)
    await t.pg.exec(`
      CREATE FUNCTION fail_log() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'log down'; END $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_log BEFORE INSERT ON applicant_access_log FOR EACH ROW EXECUTE FUNCTION fail_log();
    `)
    const response = await listOf(t, form.id)
    assert.equal(response.status, 500)
    const text = await response.text()
    for (const secret of [kim.name, kim.studentId, lee.name, lee.studentId])
      assert.ok(!text.includes(secret), secret)
    assert.equal(await logs(t), 0)
  }),
)

test(
  '목록을 읽기 전에 그 양식의 기한 지난 신청자 정보를 먼저 지운다(호출을 지우면 이 시험이 실패한다)',
  withRegistrations(async t => {
    const { form } = await split(t)
    // 기수 밖으로 시계를 옮기면 403이라, 마감을 1년 넘게 전으로 당긴다(지울 날은 마감+1년).
    await t.pg.query("UPDATE registration_form SET closes_at = '2025-01-01T00:00:00Z'")
    const response = await listOf(t, form.id)
    assert.equal(response.status, 200)
    assert.deepEqual(((await response.json()) as ApplicantsResponse).applicants, [])
    assert.equal(await t.count('SELECT count(*) AS n FROM registration WHERE name IS NOT NULL'), 0)
  }),
)

test(
  '같은 학번 표시는 그 행사 안에서만 센다: 다른 행사와 다른 학생회의 같은 학번은 표시되지 않는다',
  withRegistrations(async t => {
    const { form } = await split(t)
    const elsewhere = await t.makeForm(await t.makeEvent({ name: '다른 행사' }))
    await t.makeRegistration(elsewhere, { studentId: kim.studentId })
    const theirs = await t.makeForm(await t.makeEvent({}, t.other), {}, t.other)
    await t.makeRegistration(theirs, { studentId: kim.studentId }, t.other)
    const body = (await (await listOf(t, form.id)).json()) as ApplicantsResponse
    assert.deepEqual(
      body.applicants.map(a => [a.name, a.duplicateStudentId]),
      [
        ['김납부', false],
        ['이미납', false],
      ],
    )
  }),
)
