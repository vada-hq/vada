import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  ApplicantChangeResponse,
  BulkApplicantsResponse,
  EventApplicantsResponse,
} from '@vada/contracts'
import { MISSING, type RegistrationKit, withRegistrations } from '../test-support/registrations.js'

// 출석 기록의 결과(참석, 불참)와 [불참 처리](DEC-93). 불참은 신청 취소를 막지 않는다.
const absent = (t: RegistrationKit, id: string, user = 's-president') =>
  t.post(`/registrations/${id}/absence`, {}, user)
const bulk = (t: RegistrationKit, eventId: string, ids: string[], user = 's-president') =>
  t.post(`/events/${eventId}/applicants/absence`, { registrationIds: ids }, user)
const results = async (response: Response) =>
  ((await response.json()) as BulkApplicantsResponse).results
const records = (t: RegistrationKit, id: string) =>
  t.pg.query<{ result: string; method: string; cancelled: boolean }>(
    'SELECT result, method, cancelled_at IS NOT NULL AS cancelled FROM attendance WHERE registration_id = $1 ORDER BY id',
    [id],
  )
const listOf = async (t: RegistrationKit, eventId: string) =>
  (await (
    await t.api.get(`${t.orgBase}/events/${eventId}/applicants`, 's-president')
  ).json()) as EventApplicantsResponse

test(
  '불참 처리는 결과가 불참인 출석 기록을 남기고 참석 수에 세지 않으며, 다시 보내도 하나다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const form = await t.makeForm(event)
    const id = await t.makeRegistration(form)
    const response = await absent(t, id)
    assert.equal(response.status, 200)
    const { applicant } = (await response.json()) as ApplicantChangeResponse
    assert.deepEqual([applicant.attended, applicant.absent], [false, true])
    assert.ok(!applicant.actions.includes('registration.mark_absent'))
    for (const action of ['registration.check_in', 'registration.cancel_check_in', 'registration.cancel'])
      assert.ok(applicant.actions.includes(action as never), action)
    assert.equal((await absent(t, id)).status, 200)
    assert.deepEqual((await records(t, id)).rows, [
      { result: 'absent', method: 'manual', cancelled: false },
    ])
    assert.equal((await t.detail(form)).attendedCount, 0)
    const list = await listOf(t, event)
    assert.deepEqual(list.counts, { applicants: 1, attended: 0 })
    assert.deepEqual(
      list.applicants.map(row => [row.attended, row.absent]),
      [[false, true]],
    )
  }),
)

test(
  '참석한 신청은 불참 처리가 409 CHECKED_IN이고, 불참한 신청을 출석하면 불참을 취소하고 참석을 남긴다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const form = await t.makeForm(event)
    const came = await t.makeRegistration(form)
    await t.attend(came)
    const refused = await absent(t, came)
    assert.equal(refused.status, 409)
    assert.equal(((await refused.json()) as { error: string }).error, 'CHECKED_IN')
    const late = await t.makeRegistration(form)
    await absent(t, late)
    const checked = await t.post(`/registrations/${late}/attendance`, {})
    assert.equal(checked.status, 200)
    assert.equal(((await checked.json()) as { already: boolean }).already, false)
    assert.deepEqual((await records(t, late)).rows, [
      { result: 'absent', method: 'manual', cancelled: true },
      { result: 'attended', method: 'manual', cancelled: false },
    ])
    assert.equal((await t.detail(form)).attendedCount, 2)
  }),
)

test(
  '불참은 신청 취소를 막지 않고, 출석 취소로 불참을 되돌린다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const form = await t.makeForm(event)
    const staff = await t.makeRegistration(form)
    await absent(t, staff)
    assert.equal((await t.post(`/registrations/${staff}/cancel`, {})).status, 200)
    const undo = await t.makeRegistration(form)
    await absent(t, undo)
    const cancelled = await t.post(`/registrations/${undo}/attendance/cancel`, {})
    assert.equal(cancelled.status, 200)
    const { applicant } = (await cancelled.json()) as ApplicantChangeResponse
    assert.deepEqual([applicant.attended, applicant.absent], [false, false])
    assert.ok(applicant.actions.includes('registration.mark_absent'))
  }),
)

test(
  '스스로 취소도 불참이 막지 않고, 개인 링크의 출석은 참석일 때만 참이다',
  withRegistrations(async t => {
    const event = await t.makeEvent({ startsAt: new Date('2026-11-02T03:00:00Z') })
    const { form } = await t.activeForm(event)
    const token = await t.applied(form.publicCode, { name: '김불참', studentId: '202612345' })
    const id = ((await t.pg.query('SELECT id FROM registration')).rows[0] as { id: string }).id
    await absent(t, id)
    const mine = (await (await t.lookup(token)).json()) as { attended: boolean; cancellable: boolean }
    assert.deepEqual([mine.attended, mine.cancellable], [false, true])
    assert.equal((await t.cancelMine(token)).status, 200)
  }),
)

test(
  '불참 처리 권한·완료·격리: 재정부만인 사람 403, 완료한 행사 409, 다른 학생회 신청 404, 미인증 401, 본문이 있으면 400',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const id = await t.makeRegistration(await t.makeForm(event))
    assert.equal((await absent(t, id, 's-financeMember')).status, 403)
    const theirs = await t.makeRegistration(
      await t.makeForm(await t.makeEvent({}, t.other), {}, t.other),
      {},
      t.other,
    )
    assert.equal((await absent(t, theirs)).status, 404)
    assert.equal((await absent(t, MISSING)).status, 404)
    assert.equal((await t.api.post(`${t.orgBase}/registrations/${id}/absence`, {})).status, 401)
    assert.equal((await t.post(`/registrations/${id}/absence`, { x: 1 })).status, 400)
    await t.complete(event)
    const locked = await absent(t, id)
    assert.equal(locked.status, 409)
    assert.equal(((await locked.json()) as { error: string }).error, 'EVENT_COMPLETED')
    assert.equal(await t.count('SELECT count(*) AS n FROM attendance'), 0)
  }),
)

test(
  '일괄 불참 처리: 줄마다 따로 처리하고 참석한 줄·다른 행사·다른 학생회는 그 줄만 실패한다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const form = await t.makeForm(event)
    const first = await t.makeRegistration(form)
    const came = await t.makeRegistration(form)
    await t.attend(came)
    const second = await t.makeRegistration(form)
    const elsewhere = await t.makeRegistration(await t.makeForm(await t.makeEvent()))
    const theirs = await t.makeRegistration(
      await t.makeForm(await t.makeEvent({}, t.other), {}, t.other),
      {},
      t.other,
    )
    const response = await bulk(t, event, [first, came, elsewhere, theirs, second])
    assert.equal(response.status, 200)
    assert.deepEqual(await results(response), [
      { registrationId: first, error: null },
      { registrationId: came, error: 'CHECKED_IN' },
      { registrationId: elsewhere, error: 'NOT_FOUND' },
      { registrationId: theirs, error: 'NOT_FOUND' },
      { registrationId: second, error: null },
    ])
    assert.equal(await t.count("SELECT count(*) AS n FROM attendance WHERE result = 'absent'"), 2)
    assert.deepEqual(await results(await bulk(t, event, [first], 's-financeMember')), [
      { registrationId: first, error: 'FORBIDDEN' },
    ])
    await t.complete(event)
    assert.deepEqual(await results(await bulk(t, event, [came])), [
      { registrationId: came, error: 'EVENT_COMPLETED' },
    ])
  }),
)

test(
  '일괄 불참 본문: 빈 목록·51명·중복·모르는 키는 400, 미인증 401, 다른 학생회 행사 404',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    for (const body of [
      {},
      { registrationIds: [] },
      { registrationIds: Array(51).fill(MISSING) },
      { registrationIds: [MISSING, MISSING] },
      { registrationIds: ['x'] },
      { registrationIds: [MISSING], other: true },
    ])
      assert.equal((await t.post(`/events/${event}/applicants/absence`, body)).status, 400)
    assert.equal(
      (
        await t.api.post(`${t.orgBase}/events/${event}/applicants/absence`, {
          registrationIds: [MISSING],
        })
      ).status,
      401,
    )
    assert.equal((await bulk(t, await t.makeEvent({}, t.other), [MISSING])).status, 404)
  }),
)
