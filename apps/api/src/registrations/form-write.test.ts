import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  codePoints,
  PUBLIC_CODE_PATTERN,
  REGISTRATION_CAPACITY_MAX,
  REGISTRATION_FEE_MAX,
  REGISTRATION_FORM_NAME_MAX,
  REGISTRATION_NOTICE_MAX,
} from '@vada/contracts'
import { createRateLimiter } from '../http/rate-limit.js'
import {
  FORM,
  MISSING,
  startRegistrations,
  withRegistrations,
} from '../test-support/registrations.js'

test(
  '새 양식은 초안이고 활성화는 행사 일시와 참가비 계좌를 다시 검사해 409와 모자란 조건을 준다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const { form } = await t.created(event, { payerFee: 5000, nonPayerFee: 5000 })
    assert.ok(form)
    assert.deepEqual([form.paused, form.status, form.applicantCount], [true, 'paused', 0])
    for (const action of ['activate', 'resume']) {
      const response = await t.post(`/registration-forms/${form.id}/${action}`, {})
      assert.equal(response.status, 409)
      assert.deepEqual(await response.json(), {
        error: 'FORM_NOT_READY',
        missingConditions: ['event_starts_at', 'fee_account'],
      })
    }
    assert.equal(await t.versions(form.id), 1)
    assert.equal((await t.detail(form.id)).paused, true)
  }),
)

test(
  '조건을 갖춘 활성화는 판을 남기고 같은 요청은 판을 늘리지 않는다',
  withRegistrations(async t => {
    const event = await t.makeEvent({ startsAt: new Date('2026-11-02T03:00:00Z') })
    const { form } = await t.created(event)
    const activate = () => t.post(`/registration-forms/${form.id}/activate`, {})
    assert.equal((await activate()).status, 200)
    assert.deepEqual(
      [(await t.detail(form.id)).paused, (await t.detail(form.id)).status],
      [false, 'open'],
    )
    assert.equal(await t.versions(form.id), 2)
    assert.equal((await activate()).status, 200)
    assert.equal(await t.versions(form.id), 2)
    const versions = await t.pg.query<{ data: { paused_at: unknown }; changed_by: string }>(
      'SELECT data, changed_by FROM record_version WHERE record_id = $1 ORDER BY version_no',
      [form.id],
    )
    assert.ok(versions.rows[0]!.data.paused_at)
    assert.equal(versions.rows[1]!.data.paused_at, null)
    assert.equal(versions.rows[1]!.changed_by, t.council.people.president.memberId)
  }),
)

test(
  '활성화는 고치기 권한과 같고 다른 학생회 양식은 404, 미인증 401, 모르는 본문은 400이다',
  withRegistrations(async t => {
    const event = await t.makeEvent({ ownerId: t.council.people.planningMember.memberId })
    const { form } = await t.created(event)
    const theirs = await t.makeForm(await t.makeEvent({}, t.other), {}, t.other)
    const path = `/registration-forms/${form.id}/activate`
    for (const user of ['s-plain', 's-financeMember', 's-planningHead'])
      assert.equal((await t.post(path, {}, user)).status, 403, user)
    assert.equal((await t.api.post(`${t.orgBase}${path}`, {})).status, 401)
    assert.equal((await t.post(`/registration-forms/${theirs}/activate`, {})).status, 404)
    assert.equal((await t.post(path, { extra: 1 })).status, 400)
    // 권한이 있으면 조건 검사까지 도달한다.
    assert.equal((await t.post(path, {}, 's-planningMember')).status, 409)
    assert.equal(await t.versions(form.id), 1)
  }),
)

test(
  '활성화는 닫은 계좌를 다시 검사해 계좌 부족 409를 주고 초안을 유지한다',
  withRegistrations(async t => {
    const event = await t.makeEvent({ startsAt: new Date('2026-11-02T03:00:00Z') })
    const feeAccountId = await t.makeAccount()
    const { form } = await t.created(event, { payerFee: 1000, nonPayerFee: 1000, feeAccountId })
    await t.change('account', feeAccountId, { closedOn: '2026-10-25' })
    const response = await t.post(`/registration-forms/${form.id}/activate`, {})
    assert.equal(response.status, 409)
    assert.deepEqual(await response.json(), {
      error: 'FORM_NOT_READY',
      missingConditions: ['fee_account'],
    })
    assert.equal((await t.detail(form.id)).paused, true)
    assert.equal(await t.versions(form.id), 1)
  }),
)

test(
  '회장이 양식을 만들면 201과 판 1이 열리고 공개 코드가 정해진다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const { status, form } = await t.created(event, {
      opensAt: '2026-10-26T09:00',
      capacity: 30,
      notice: '문의는 카톡 @학생회',
      collectsPhone: true,
    })
    assert.equal(status, 201)
    assert.match(form.publicCode, PUBLIC_CODE_PATTERN)
    assert.equal(form.name, FORM.name)
    assert.equal(form.eventId, event)
    assert.equal(form.opensAt, '2026-10-26T09:00')
    assert.equal(form.closesAt, '2026-11-01T18:00')
    assert.equal(form.capacity, 30)
    assert.equal(form.remaining, 30)
    assert.equal(form.notice, '문의는 카톡 @학생회')
    assert.equal(form.collectsPhone, true)
    assert.equal(form.paused, true)
    assert.equal(form.status, 'paused')
    assert.deepEqual([form.applicantCount, form.attendedCount], [0, 0])
    assert.deepEqual([form.payerFee, form.nonPayerFee, form.feeAccount], [null, null, null])
    // 행사 끝도 시작도 없으면 양식 마감 날짜 + 1년이다.
    assert.equal(form.purgeOn, '2027-11-01')
    assert.deepEqual(form.actions, [
      'form.update',
      'form.resume',
      'form.activate',
      'form.check_in',
      'form.view_applicants',
    ])
    assert.equal(await t.versions(form.id), 1)
    assert.equal(await t.count('SELECT count(*) AS n FROM registration_form'), 1)
  }),
)

test(
  '양식은 행사 하나에 여럿 둘 수 있고 공개 코드는 모두 다르다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const first = await t.created(event)
    const second = await t.created(event, { name: '두 번째' })
    assert.notEqual(first.form.publicCode, second.form.publicCode)
    assert.equal((await t.list(event)).forms.length, 2)
  }),
)

test(
  '관리 권한자만 만든다: 회장단, 행사 책임자, 그 행사의 업무를 맡은 부서 사람. 아니면 403이고 아무것도 남지 않는다',
  withRegistrations(async t => {
    const { people, departments } = t.council
    const owned = await t.makeEvent({ ownerId: people.planningMember.memberId })
    const tasked = await t.makeEvent()
    await t.makeTask(tasked, departments.planning)
    const plain = await t.makeEvent()
    for (const user of ['s-president', 's-vicePresident'])
      assert.equal((await t.created(plain, {}, user)).status, 201, user)
    assert.equal((await t.created(owned, {}, 's-planningMember')).status, 201)
    for (const user of ['s-planningHead', 's-planningViceHead', 's-planningMember'])
      assert.equal((await t.created(tasked, {}, user)).status, 201, user)
    const before = await t.count('SELECT count(*) AS n FROM registration_form')
    for (const user of ['s-planningHead', 's-planningMember', 's-financeMember', 's-plain'])
      assert.equal((await t.create(plain, FORM, user)).status, 403, `업무 없는 행사 ${user}`)
    // 재정부는 담당 부서가 아니면 관리하지 못한다. 책임자도 아닌 다른 부서도 마찬가지다.
    for (const user of ['s-financeMember', 's-plain'])
      assert.equal((await t.create(tasked, FORM, user)).status, 403, `담당 아님 ${user}`)
    assert.equal(await t.count('SELECT count(*) AS n FROM registration_form'), before)
  }),
)

test(
  '행사 담당 부서는 업무에서 센다: 취소한 업무, 부서 없는 업무, 다른 행사의 업무는 권한이 되지 않는다',
  withRegistrations(async t => {
    const { departments } = t.council
    const event = await t.makeEvent()
    const elsewhere = await t.makeEvent({ name: '다른 행사' })
    await t.makeTask(event, departments.planning, true)
    await t.makeTask(event, null)
    await t.makeTask(elsewhere, departments.planning)
    assert.equal((await t.create(event, FORM, 's-planningMember')).status, 403)
    // 살아 있는 업무가 생기면 바로 열리고, 그 업무를 취소하면 바로 닫힌다.
    const live = await t.makeTask(event, departments.planning)
    assert.equal((await t.create(event, FORM, 's-planningMember')).status, 201)
    await t.change('task', live, { cancelledAt: new Date() })
    assert.equal((await t.create(event, FORM, 's-planningMember')).status, 403)
  }),
)

test(
  '부서를 떠난 사람은 업무가 그 부서를 가리켜도 관리하지 못한다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    await t.makeTask(event, t.council.departments.planning)
    assert.equal((await t.create(event, FORM, 's-planningMember')).status, 201)
    await t.pg.query('UPDATE department_membership SET ends_at = now() WHERE member_id = $1', [
      t.council.people.planningMember.memberId,
    ])
    assert.equal((await t.create(event, FORM, 's-planningMember')).status, 403)
  }),
)

test(
  '로그인하지 않으면 401, 다른 학생회 사람과 내보낸 운영진은 403, 다른 학생회 행사와 없는 행사는 404이다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    assert.equal(
      (await t.api.post(`${t.orgBase}/events/${event}/registration-forms`, FORM)).status,
      401,
    )
    assert.equal((await t.create(event, FORM, 'o-president')).status, 403)
    assert.equal((await t.create(event, FORM, 's-ended')).status, 403)
    const theirs = await t.makeEvent({}, t.other)
    assert.equal((await t.create(theirs, FORM)).status, 404)
    assert.equal((await t.create(MISSING, FORM)).status, 404)
    assert.equal((await t.create('not-a-uuid', FORM)).status, 404)
    assert.equal(await t.count('SELECT count(*) AS n FROM registration_form'), 0)
  }),
)

test(
  '마감이 없거나 시작보다 이르거나 같으면 400이다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const { closesAt: _closesAt, ...withoutClose } = FORM
    for (const body of [
      withoutClose,
      { ...FORM, closesAt: null },
      { ...FORM, opensAt: '2026-11-01T18:00' },
      { ...FORM, opensAt: '2026-11-02T09:00' },
      { ...FORM, closesAt: '2026-11-01' },
    ])
      assert.equal((await t.create(event, body)).status, 400, JSON.stringify(body))
    assert.equal((await t.created(event, { opensAt: '2026-11-01T17:59' })).status, 201)
  }),
)

test(
  '참가비는 둘 다 있거나 둘 다 없고, 0보다 크면 닫지 않은 같은 학생회 계좌가 있어야 한다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const account = await t.makeAccount()
    for (const body of [
      { payerFee: 0 },
      { nonPayerFee: 5000 },
      { payerFee: null, nonPayerFee: 5000 },
      { payerFee: -1, nonPayerFee: 0 },
      { payerFee: 0, nonPayerFee: REGISTRATION_FEE_MAX + 1 },
      { payerFee: 0.5, nonPayerFee: 1 },
      { payerFee: '0', nonPayerFee: '0' },
    ])
      assert.equal((await t.create(event, { ...FORM, ...body })).status, 400, JSON.stringify(body))
    // 둘 다 0이면 계좌가 없어도 된다. 상한은 받는다.
    assert.equal((await t.created(event, { payerFee: 0, nonPayerFee: 0 })).status, 201)
    const noAccount = await t.create(event, { ...FORM, payerFee: 0, nonPayerFee: 5000 })
    assert.equal(noAccount.status, 201)
    const max = await t.created(event, {
      payerFee: REGISTRATION_FEE_MAX,
      nonPayerFee: REGISTRATION_FEE_MAX,
      feeAccountId: account,
    })
    assert.equal(max.status, 201)
    const good = await t.created(event, { payerFee: 0, nonPayerFee: 5000, feeAccountId: account })
    assert.equal(good.status, 201)
    assert.deepEqual(good.form.feeAccount, { id: account, name: '대표' })
    assert.deepEqual([good.form.payerFee, good.form.nonPayerFee], [0, 5000])
  }),
)

test(
  '다른 학생회 계좌나 닫은 계좌, 없는 계좌는 409 ACCOUNT_INVALID이고 아무것도 남지 않는다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const theirs = await t.makeAccount({}, t.other)
    const closed = await t.makeAccount({
      name: '옛 계좌',
      type: 'business',
      closedOn: '2026-01-01',
    })
    for (const feeAccountId of [theirs, closed, MISSING]) {
      const response = await t.create(event, { ...FORM, payerFee: 1, nonPayerFee: 1, feeAccountId })
      assert.equal(response.status, 409)
      assert.deepEqual(await response.json(), { error: 'ACCOUNT_INVALID' })
    }
    // 참가비가 없어도 쓸 수 없는 계좌는 받지 않는다.
    assert.equal((await t.create(event, { ...FORM, feeAccountId: closed })).status, 409)
    assert.equal(await t.count('SELECT count(*) AS n FROM registration_form'), 0)
    assert.equal(
      await t.count("SELECT count(*) AS n FROM record WHERE kind = 'registration_form'"),
      0,
    )
  }),
)

test(
  '입력 경우: 필수값 누락, 빈 이름, 공백만, 상한+1(이모지), NUL, 홀로 쓰인 서러게이트, 모르는 키, 공개 코드는 400이다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const bad: unknown[] = [
      {},
      { closesAt: FORM.closesAt },
      { name: '', closesAt: FORM.closesAt },
      { name: '   ', closesAt: FORM.closesAt },
      { ...FORM, name: '😀'.repeat(REGISTRATION_FORM_NAME_MAX + 1) },
      { ...FORM, name: 'a'.repeat(REGISTRATION_FORM_NAME_MAX + 1) },
      { ...FORM, name: '가\u0000나' },
      { ...FORM, name: '가\ud800' },
      { ...FORM, notice: '😀'.repeat(REGISTRATION_NOTICE_MAX + 1) },
      { ...FORM, notice: '   ' },
      { ...FORM, notice: '안\u0000내' },
      { ...FORM, notice: '안\ud800내' },
      { ...FORM, capacity: 0 },
      { ...FORM, capacity: REGISTRATION_CAPACITY_MAX + 1 },
      { ...FORM, capacity: 1.5 },
      { ...FORM, capacity: '3' },
      { ...FORM, collectsPhone: 'yes' },
      { ...FORM, collectsStudentId: 'yes' },
      { ...FORM, collectsStudentId: null },
      { ...FORM, feeAccountId: 'not-a-uuid' },
      { ...FORM, extra: 1 },
      { ...FORM, publicCode: 'AAAAAAAA' },
      { ...FORM, closesAt: '2026-02-30T10:00' },
      { ...FORM, closesAt: '2026-11-01T25:00' },
      { ...FORM, closesAt: '1999-12-31T23:59' },
    ]
    for (const body of bad)
      assert.equal((await t.create(event, body)).status, 400, JSON.stringify(body))
    assert.equal(await t.count('SELECT count(*) AS n FROM registration_form'), 0)
    // 상한은 받는다(이모지는 코드 포인트로 센다).
    const full = await t.created(event, {
      name: '😀'.repeat(REGISTRATION_FORM_NAME_MAX),
      notice: '😀'.repeat(REGISTRATION_NOTICE_MAX),
      capacity: REGISTRATION_CAPACITY_MAX,
    })
    assert.equal(full.status, 201)
    assert.equal(codePoints(full.form.name), REGISTRATION_FORM_NAME_MAX)
  }),
)

const EDIT = {
  name: '고친 이름',
  opensAt: null,
  closesAt: '2026-11-02T18:00',
  capacity: 10,
  notice: null,
  collectsPhone: false,
  collectsStudentId: true,
  payerFee: null,
  nonPayerFee: null,
  feeAccountId: null,
}

test(
  '학번 받기: 빼면 받기로 저장하고 끌 수 있다. 두 참가비가 다르면 끌 수 없어 400이고 아무것도 남지 않는다(DEC-75)',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const account = await t.makeAccount()
    const column = async (id: string) =>
      (
        (await t.pg.query('SELECT collects_student_id FROM registration_form WHERE id = $1', [id]))
          .rows[0] as { collects_student_id: boolean }
      ).collects_student_id
    const byDefault = await t.created(event)
    assert.equal(byDefault.status, 201)
    assert.equal(byDefault.form.collectsStudentId, true)
    assert.equal(await column(byDefault.form.id), true)
    for (const fees of [{}, { payerFee: 3000, nonPayerFee: 3000, feeAccountId: account }]) {
      const off = await t.created(event, { ...fees, collectsStudentId: false })
      assert.equal(off.status, 201, JSON.stringify(fees))
      assert.equal(off.form.collectsStudentId, false)
      assert.equal(await column(off.form.id), false)
      assert.equal((await t.detail(off.form.id)).collectsStudentId, false)
    }
    const before = await t.count('SELECT count(*) AS n FROM registration_form')
    const split = { payerFee: 0, nonPayerFee: 5000, feeAccountId: account }
    assert.equal(
      (await t.create(event, { ...FORM, ...split, collectsStudentId: false })).status,
      400,
    )
    assert.equal(await t.count('SELECT count(*) AS n FROM registration_form'), before)
    const splitForm = await t.created(event, split)
    assert.equal(splitForm.form.collectsStudentId, true)
    // 고치기도 같다: 두 참가비가 다르면 끌 수 없고, 같게 고치면서 끄면 된다.
    const edit = { ...EDIT, ...split, collectsStudentId: false }
    assert.equal((await t.post(`/registration-forms/${splitForm.form.id}`, edit)).status, 400)
    assert.equal(await t.versions(splitForm.form.id), 1)
    const turnedOff = await t.post(`/registration-forms/${splitForm.form.id}`, {
      ...edit,
      nonPayerFee: 0,
    })
    assert.equal(turnedOff.status, 200)
    assert.equal(
      ((await turnedOff.json()) as { form: { collectsStudentId: boolean } }).form.collectsStudentId,
      false,
    )
    assert.equal(await t.versions(splitForm.form.id), 2)
    const listed = (await t.list(event)).forms.find(form => form.id === splitForm.form.id)
    assert.equal(listed?.collectsStudentId, false)
  }),
)

test(
  '고치기는 칸을 모두 받아 그대로 바꾸고 판을 하나 더 연다. 같은 값이면 판이 늘지 않는다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const { form } = await t.created(event, { notice: '안내', capacity: 5 })
    const response = await t.post(`/registration-forms/${form.id}`, EDIT)
    assert.equal(response.status, 200)
    const edited = ((await response.json()) as { form: typeof form }).form
    assert.equal(edited.name, '고친 이름')
    assert.equal(edited.closesAt, '2026-11-02T18:00')
    assert.equal(edited.capacity, 10)
    assert.equal(edited.notice, null)
    assert.equal(edited.publicCode, form.publicCode)
    assert.equal(await t.versions(form.id), 2)
    await t.post(`/registration-forms/${form.id}`, EDIT)
    assert.equal(await t.versions(form.id), 2)
  }),
)

test(
  '고치기 본문에 공개 코드나 모르는 키가 오면 400이고 칸을 빼도 400이다. 공개 코드는 바뀌지 않는다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const { form } = await t.created(event)
    const { notice: _notice, ...withoutNotice } = EDIT
    const { collectsStudentId: _collects, ...withoutStudentId } = EDIT
    for (const body of [
      { ...EDIT, publicCode: 'BBBBBBBB' },
      { ...EDIT, extra: 1 },
      withoutNotice,
      withoutStudentId,
      { ...EDIT, closesAt: null },
      { ...EDIT, opensAt: '2026-11-02T18:00' },
      { ...EDIT, payerFee: 100 },
    ])
      assert.equal(
        (await t.post(`/registration-forms/${form.id}`, body)).status,
        400,
        JSON.stringify(body),
      )
    assert.equal((await t.detail(form.id)).publicCode, form.publicCode)
    assert.equal(await t.versions(form.id), 1)
  }),
)

test(
  '고치기와 멈추기는 관리 권한자만 한다. 재정부만인 사람과 업무 없는 부장은 403이고 다른 학생회 양식은 404이다',
  withRegistrations(async t => {
    const event = await t.makeEvent({ ownerId: t.council.people.planningMember.memberId })
    const { form } = await t.created(event)
    const theirEvent = await t.makeEvent({}, t.other)
    const theirForm = await t.makeForm(theirEvent, {}, t.other)
    for (const path of ['', '/pause', '/resume']) {
      const body = path ? {} : EDIT
      for (const user of ['s-financeMember', 's-plain', 's-planningHead', 's-ended', 'o-president'])
        assert.equal(
          (await t.post(`/registration-forms/${form.id}${path}`, body, user)).status,
          403,
          `${path} ${user}`,
        )
      assert.equal(
        (await t.api.post(`${t.orgBase}/registration-forms/${form.id}${path}`, body)).status,
        401,
      )
      assert.equal((await t.post(`/registration-forms/${theirForm}${path}`, body)).status, 404)
      assert.equal((await t.post(`/registration-forms/${MISSING}${path}`, body)).status, 404)
      assert.equal((await t.post(`/registration-forms/not-a-uuid${path}`, body)).status, 404)
    }
    assert.equal(
      (await t.post(`/registration-forms/${form.id}`, EDIT, 's-planningMember')).status,
      200,
    )
    assert.equal(
      (await t.post(`/registration-forms/${form.id}/pause`, {}, 's-planningMember')).status,
      200,
    )
    assert.equal(await t.versions(theirForm), 1)
  }),
)

test(
  '멈추면 새 신청을 받지 않는 상태가 되고 다시 받으면 돌아온다. 같은 상태로 다시 보내도 판은 늘지 않는다',
  withRegistrations(async t => {
    const event = await t.makeEvent({ startsAt: new Date('2026-11-02T03:00:00Z') })
    const { form } = await t.activeForm(event)
    const send = async (path: string) =>
      (
        (await (await t.post(`/registration-forms/${form.id}/${path}`, {})).json()) as {
          form: typeof form
        }
      ).form
    assert.equal(form.status, 'open')
    const paused = await send('pause')
    assert.deepEqual([paused.paused, paused.status], [true, 'paused'])
    assert.equal(await t.versions(form.id), 2)
    await send('pause')
    assert.equal(await t.versions(form.id), 2)
    const resumed = await send('resume')
    assert.deepEqual([resumed.paused, resumed.status], [false, 'open'])
    assert.equal(await t.versions(form.id), 3)
    await send('resume')
    assert.equal(await t.versions(form.id), 3)
    // 본문이 있으면 400이다(본문 없는 동작).
    assert.equal((await t.post(`/registration-forms/${form.id}/pause`, { x: 1 })).status, 400)
  }),
)

test(
  '휴대폰 받기를 끄면 받은 번호가 지금 값과 모든 판에서 비워지고 행은 남는다. 끄지 않은 양식의 번호는 그대로다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const { form } = await t.created(event, { collectsPhone: true })
    const kept = await t.created(event, { collectsPhone: true, name: '다른 양식' })
    const mine = await t.makeRegistration(form.id, { phone: '01012345678' })
    const theirs = await t.makeRegistration(kept.form.id, { phone: '01099998888' })
    // 이름을 고쳐 판 2가 생기게 하고 두 판 모두에 번호가 있는 상태에서 시작한다.
    await t.change('registration', mine, { name: '김고침' })
    assert.equal(await t.versions(mine), 2)
    const phones = (id: string) =>
      t.pg.query<{ phone: string | null }>(
        "SELECT data ->> 'phone' AS phone FROM record_version WHERE record_id = $1 ORDER BY version_no",
        [id],
      )
    assert.deepEqual(
      (await phones(mine)).rows.map(row => row.phone),
      ['01012345678', '01012345678'],
    )
    const response = await t.post(`/registration-forms/${form.id}`, {
      ...EDIT,
      collectsPhone: false,
    })
    assert.equal(response.status, 200)
    assert.deepEqual(
      (await phones(mine)).rows.map(row => row.phone),
      [null, null],
    )
    assert.equal(
      await t.count(
        "SELECT count(*) AS n FROM registration WHERE id = $1 AND phone IS NULL AND name = '김고침'",
        [mine],
      ),
      1,
    )
    assert.deepEqual(
      (await phones(theirs)).rows.map(row => row.phone),
      ['01099998888'],
    )
    assert.equal(await t.count('SELECT count(*) AS n FROM registration WHERE phone IS NOT NULL'), 1)
    // 이름·학번 같은 다른 값은 건드리지 않는다.
    assert.equal(await t.versions(mine), 2)
  }),
)

test('같은 학생회 운영진의 쓰기는 계정마다 10초에 20번이고 21번째는 429이다', async () => {
  const t = await startRegistrations({
    writeLimiter: createRateLimiter({ limit: 20, windowMs: 10_000 }),
  })
  try {
    const event = await t.makeEvent()
    for (let index = 0; index < 20; index++)
      assert.equal((await t.create(event, FORM)).status, 201, String(index))
    assert.equal((await t.create(event, FORM)).status, 429)
    // 다른 계정은 따로 센다.
    assert.equal((await t.create(event, FORM, 's-vicePresident')).status, 201)
  } finally {
    await t.close()
  }
})

test(
  '고치기도 참가비 규칙을 지킨다: 계좌 없는 참가비는 FEE_ACCOUNT_REQUIRED, 닫은 계좌와 다른 학생회 계좌는 ACCOUNT_INVALID이고 양식은 그대로다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const account = await t.makeAccount()
    const { form } = await t.activeForm(event)
    const theirs = await t.makeAccount({}, t.other)
    const closed = await t.makeAccount({
      name: '옛 계좌',
      type: 'business',
      closedOn: '2026-01-01',
    })
    const edit = (body: Record<string, unknown>) =>
      t.post(`/registration-forms/${form.id}`, { ...EDIT, ...body })
    const required = await edit({ payerFee: 0, nonPayerFee: 5000, feeAccountId: null })
    assert.equal(required.status, 409)
    assert.deepEqual(await required.json(), { error: 'FEE_ACCOUNT_REQUIRED' })
    for (const feeAccountId of [closed, theirs]) {
      const response = await edit({ payerFee: 0, nonPayerFee: 5000, feeAccountId })
      assert.equal(response.status, 409)
      assert.deepEqual(await response.json(), { error: 'ACCOUNT_INVALID' })
    }
    assert.equal(await t.versions(form.id), 1)
    assert.equal(
      (await edit({ payerFee: 0, nonPayerFee: 5000, feeAccountId: account })).status,
      200,
    )
  }),
)
