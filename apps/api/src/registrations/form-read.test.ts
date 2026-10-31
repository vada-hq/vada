import assert from 'node:assert/strict'
import { test } from 'node:test'
import { REGISTRATION_FORM_LIST_LIMIT, type RegistrationForm } from '@vada/contracts'
import { korean, MISSING, withRegistrations } from '../test-support/registrations.js'

// 받는 중인 양식에서 관리 권한자가 받는 동작(멈추기만 있고 다시 받기는 없다)
const MANAGER = ['form.update', 'form.pause', 'form.check_in', 'form.view_applicants']

test(
  '양식의 부족 조건은 서버가 모든 운영진에게 목록과 상세로 주고 닫힌 계좌도 반영한다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const feeAccountId = await t.makeAccount()
    const { form } = await t.created(event, { payerFee: 1000, nonPayerFee: 1000, feeAccountId })
    for (const user of ['s-president', 's-plain']) {
      assert.deepEqual((await t.detail(form.id, user)).missingConditions, ['event_starts_at'])
      assert.deepEqual((await t.list(event, user)).forms[0]!.missingConditions, ['event_starts_at'])
    }
    await t.pg.query('UPDATE event SET starts_at = $1 WHERE id = $2', [
      korean('2026-11-02T12:00'),
      event,
    ])
    assert.deepEqual((await t.detail(form.id)).missingConditions, [])
    await t.change('account', feeAccountId, { closedOn: '2026-10-25' })
    assert.deepEqual((await t.detail(form.id)).missingConditions, ['fee_account'])
    const denied = await t.post(`/registration-forms/${form.id}/activate`, {})
    assert.deepEqual(await denied.json(), {
      error: 'FORM_NOT_READY',
      missingConditions: (await t.detail(form.id)).missingConditions,
    })
  }),
)

test(
  '모든 운영진이 행사의 양식 목록과 양식 하나를 읽고, 동작은 사람마다 다르다',
  withRegistrations(async t => {
    const event = await t.makeEvent({ ownerId: t.council.people.planningMember.memberId })
    const { form } = await t.activeForm(event, { capacity: 5 })
    const actionsOf = async (user: string) => (await t.detail(form.id, user)).actions
    for (const user of ['s-president', 's-vicePresident', 's-planningMember'])
      assert.deepEqual(await actionsOf(user), MANAGER, user)
    // 재정부는 신청자 정보는 보지만 관리하지 못하고, 담당이 아닌 부장과 직급 없는 운영진은 둘 다 못 한다.
    assert.deepEqual(await actionsOf('s-financeMember'), ['form.view_applicants'])
    assert.deepEqual(await actionsOf('s-planningHead'), [])
    assert.deepEqual(await actionsOf('s-plain'), [])
    for (const user of ['s-plain', 's-financeMember']) {
      const { forms, truncated } = await t.list(event, user)
      assert.equal(truncated, false)
      assert.deepEqual(
        forms.map(item => item.id),
        [form.id],
      )
      assert.equal(forms[0]!.name, form.name)
      assert.equal(forms[0]!.publicCode, form.publicCode)
    }
  }),
)

test(
  '양식은 신청 수, 참석 수, 남은 자리를 센다. 취소한 신청은 세지 않고 다른 양식과 섞이지 않는다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const { form } = await t.activeForm(event, { capacity: 5 })
    const second = await t.activeForm(event, { name: '둘째', capacity: 2 })
    const a = await t.makeRegistration(form.id)
    const b = await t.makeRegistration(form.id)
    const c = await t.makeRegistration(form.id)
    await t.makeRegistration(second.form.id)
    await t.change('registration', c, { cancelledAt: new Date() })
    await t.attend(a)
    // 취소한 출석은 세지 않는다.
    await t.attend(b, { cancelledAt: new Date() })
    const first = await t.detail(form.id)
    assert.deepEqual([first.applicantCount, first.attendedCount, first.remaining], [2, 1, 3])
    const other = await t.detail(second.form.id)
    assert.deepEqual([other.applicantCount, other.attendedCount, other.remaining], [1, 0, 1])
    const listed = (await t.list(event)).forms
    assert.deepEqual(
      listed.map(item => [item.name, item.applicantCount]),
      [
        [form.name, 2],
        ['둘째', 1],
      ],
    )
  }),
)

test(
  '정원을 지금 신청 수보다 줄여도 되고 그러면 정원 참에 남은 자리 0이다. 정원이 없으면 남은 자리는 null이다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const { form } = await t.activeForm(event, { capacity: 5 })
    for (let index = 0; index < 3; index++) await t.makeRegistration(form.id)
    const shrunk = await t.editForm(form.id, {
      name: form.name,
      opensAt: null,
      closesAt: form.closesAt,
      capacity: 2,
      notice: null,
      collectsPhone: false,
      collectsStudentId: true,
      payerFee: null,
      nonPayerFee: null,
      feeAccountId: null,
    })
    assert.equal(shrunk.status, 200)
    const after = ((await shrunk.json()) as { form: RegistrationForm }).form
    assert.deepEqual([after.capacity, after.status, after.remaining], [2, 'full', 0])
    const open = await t.activeForm(event, { name: '정원 없음' })
    assert.deepEqual([open.form.capacity, open.form.remaining], [null, null])
  }),
)

test(
  '상태는 마감, 멈춤, 시작 전, 정원 참, 받는 중의 차례이고 경계는 ±1초다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const { form } = await t.activeForm(event, {
      opensAt: '2026-10-26T09:00',
      closesAt: '2026-11-01T18:00',
      capacity: 1,
    })
    const statusAt = async (value: string) => {
      t.setNow(korean(value))
      return (await t.detail(form.id)).status
    }
    assert.equal(await statusAt('2026-10-26T08:59:59'), 'before_open')
    assert.equal(await statusAt('2026-10-26T09:00:00'), 'open')
    assert.equal(await statusAt('2026-11-01T17:59:59'), 'open')
    assert.equal(await statusAt('2026-11-01T18:00:00'), 'closed')
    await t.makeRegistration(form.id)
    assert.equal(await statusAt('2026-11-01T17:59:59'), 'full')
    assert.equal(await statusAt('2026-10-26T08:59:59'), 'before_open')
    await t.post(`/registration-forms/${form.id}/pause`, {})
    assert.equal(await statusAt('2026-11-01T17:59:59'), 'paused')
    assert.equal(await statusAt('2026-11-01T18:00:00'), 'closed')
  }),
)

test(
  '지울 날은 행사 끝, 없으면 행사 시작, 없으면 양식 마감의 한국 날짜 + 1년이다',
  withRegistrations(async t => {
    const both = await t.makeEvent({
      startsAt: korean('2026-11-05T14:00'),
      endsAt: korean('2026-11-06T09:00'),
    })
    const startOnly = await t.makeEvent({ startsAt: korean('2026-11-05T14:00') })
    const neither = await t.makeEvent()
    assert.equal((await t.activeForm(both)).form.purgeOn, '2027-11-06')
    assert.equal((await t.activeForm(startOnly)).form.purgeOn, '2027-11-05')
    assert.equal((await t.activeForm(neither)).form.purgeOn, '2027-11-01')
  }),
)

test(
  '목록은 만든 순이고 상한을 넘으면 truncated이다. 다른 행사와 다른 학생회 양식은 섞이지 않는다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const elsewhere = await t.makeEvent({ name: '다른 행사' })
    const theirs = await t.makeEvent({}, t.other)
    for (let index = 0; index < REGISTRATION_FORM_LIST_LIMIT + 1; index++)
      await t.makeForm(event, { name: `양식 ${index}` })
    await t.makeForm(elsewhere, { name: '다른 행사 양식' })
    await t.makeForm(theirs, { name: '다른 학생회 양식' }, t.other)
    const { forms, truncated } = await t.list(event)
    assert.equal(truncated, true)
    assert.equal(forms.length, REGISTRATION_FORM_LIST_LIMIT)
    assert.equal(forms[0]!.name, '양식 0')
    assert.ok(forms.every(item => item.eventId === event))
    assert.deepEqual(
      (await t.list(elsewhere)).forms.map(item => item.name),
      ['다른 행사 양식'],
    )
  }),
)

test(
  '로그인하지 않으면 401, 운영진이 아니면 403, 다른 학생회 행사와 양식과 없는 번호는 404이다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const { form } = await t.activeForm(event)
    const theirEvent = await t.makeEvent({}, t.other)
    const theirForm = await t.makeForm(theirEvent, {}, t.other)
    const get = (path: string, user?: string) => t.api.get(`${t.orgBase}${path}`, user)
    assert.equal((await get(`/events/${event}/registration-forms`)).status, 401)
    assert.equal((await get(`/registration-forms/${form.id}`)).status, 401)
    for (const user of ['o-president', 's-ended']) {
      assert.equal((await get(`/events/${event}/registration-forms`, user)).status, 403, user)
      assert.equal((await get(`/registration-forms/${form.id}`, user)).status, 403, user)
    }
    assert.equal((await get(`/events/${theirEvent}/registration-forms`, 's-president')).status, 404)
    assert.equal((await get(`/registration-forms/${theirForm}`, 's-president')).status, 404)
    assert.equal((await get(`/events/${MISSING}/registration-forms`, 's-president')).status, 404)
    assert.equal((await get(`/registration-forms/${MISSING}`, 's-president')).status, 404)
    assert.equal((await get('/registration-forms/not-a-uuid', 's-president')).status, 404)
    // 다른 학생회 경로로는 우리 양식을 읽지 못한다.
    const crossed = `/api/organizations/${t.other.councilId}/registration-forms/${form.id}`
    assert.equal((await t.api.get(crossed, 'o-president')).status, 404)
  }),
)

test(
  '양식 목록은 양식이 없어도 이 행사에서 할 수 있는 동작을 준다: 담당 부서 true, 다른 부서와 취소한 업무의 부서 false',
  withRegistrations(async t => {
    const { departments } = t.council
    const event = await t.makeEvent()
    const actionsOf = async (user: string) => (await t.list(event, user)).actions
    assert.deepEqual(await actionsOf('s-planningMember'), [])
    const task = await t.makeTask(event, departments.planning)
    assert.deepEqual(await actionsOf('s-planningMember'), ['form.create'])
    assert.deepEqual(await actionsOf('s-financeMember'), [])
    assert.deepEqual(await actionsOf('s-plain'), [])
    assert.deepEqual(await actionsOf('s-president'), ['form.create'])
    await t.change('task', task, { cancelledAt: new Date() })
    assert.deepEqual(await actionsOf('s-planningMember'), [])
  }),
)
