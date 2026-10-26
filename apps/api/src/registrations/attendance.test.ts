import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import type { CheckInResult } from '@vada/contracts'
import {
  korean,
  MISSING,
  type RegistrationKit,
  withRegistrations,
} from '../test-support/registrations.js'

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')
const kim = { name: '김출석', studentId: '202612345', phone: null }
const errorOf = async (response: Response) => ((await response.json()) as { error: string }).error

// 행사 하나, 양식 하나(학번을 받는다), 신청 하나
async function started(t: RegistrationKit) {
  const event = await t.makeEvent()
  const account = await t.makeAccount()
  const { form } = await t.created(event, { payerFee: 0, nonPayerFee: 5000, feeAccountId: account })
  const token = await t.applied(form.publicCode, kim)
  const id = ((await t.pg.query('SELECT id FROM registration')).rows[0] as { id: string }).id
  return { event, form, token, id, hash: sha256(token) }
}
const checkIn = (t: RegistrationKit, event: string, tokenHash: string, user = 's-president') =>
  t.post(`/events/${event}/check-in`, { tokenHash }, user)
const onRegistration = (t: RegistrationKit, id: string, path: string, user = 's-president') =>
  t.post(`/registrations/${id}/${path}`, {}, user)
const attendances = (t: RegistrationKit, live = true) =>
  t.count(`SELECT count(*) AS n FROM attendance ${live ? 'WHERE cancelled_at IS NULL' : ''}`)
const logs = (t: RegistrationKit) => t.count('SELECT count(*) AS n FROM applicant_access_log')

test(
  'QR 출석: 이름과 학번이 오고 방법 qr로 남고 열람 기록(check_in)이 한 줄 남는다. 같은 QR 다시는 already이다',
  withRegistrations(async t => {
    const { event, form, id, hash } = await started(t)
    const first = await checkIn(t, event, hash.toUpperCase())
    assert.equal(first.status, 200)
    assert.deepEqual(await first.json(), {
      registrationId: id,
      name: kim.name,
      studentId: kim.studentId,
      appliedFee: 5000,
      already: false,
      applicant: {
        id,
        attended: true,
        cancelled: false,
        deposit: { status: 'none', amount: null },
        listed: true,
        // 출석한 신청은 출석 취소만 있고 신청 취소가 없다(N10). 입금 확인은 참가비 있는 신청이라 남는다.
        actions: ['registration.cancel_check_in', 'deposit.confirm'],
      },
    } satisfies CheckInResult)
    const { rows } = await t.pg.query('SELECT method, cancelled_at FROM attendance')
    assert.deepEqual(rows, [{ method: 'qr', cancelled_at: null }])
    assert.equal(
      await t.versions(
        ((await t.pg.query('SELECT id FROM attendance')).rows[0] as { id: string }).id,
      ),
      1,
    )
    const again = (await (await checkIn(t, event, hash)).json()) as CheckInResult
    assert.equal(again.already, true)
    assert.equal(await attendances(t, false), 1)
    const log = await t.pg.query(
      'SELECT member_id, form_id, registration_id, action FROM applicant_access_log ORDER BY accessed_at',
    )
    assert.equal(log.rows.length, 2)
    for (const row of log.rows)
      assert.deepEqual(row, {
        member_id: t.council.people.president.memberId,
        form_id: form.id,
        registration_id: id,
        action: 'check_in',
      })
  }),
)

test(
  '그 행사의 양식이 아니거나 모르는 QR, 스스로 취소한 신청은 가르지 않고 404이고 기록이 없다. 해시 모양이 아니면 400이다',
  withRegistrations(async t => {
    const { event, token, hash } = await started(t)
    const elsewhere = await t.makeEvent({ name: '다른 행사' })
    assert.equal((await checkIn(t, elsewhere, hash)).status, 404)
    assert.equal((await checkIn(t, event, sha256('모름'))).status, 404)
    assert.equal((await t.cancelMine(token)).status, 200)
    const response = await checkIn(t, event, hash)
    assert.equal(response.status, 404)
    assert.equal(await errorOf(response), 'NOT_FOUND')
    assert.equal(await attendances(t, false), 0)
    assert.equal(await logs(t), 0)
    for (const bad of ['', 'abc', 'g'.repeat(64), `${hash}0`, 'VADA:' + hash])
      assert.equal((await checkIn(t, event, bad)).status, 400, bad)
    assert.equal((await t.post(`/events/${event}/check-in`, { tokenHash: hash, x: 1 })).status, 400)
    assert.equal((await t.post(`/events/${event}/check-in`, {})).status, 400)
  }),
)

test(
  '출석은 관리 권한자만: 담당 아닌 부장, 재정부만인 사람, 업무 없는 사람은 403이다. 다른 학생회 행사는 404, 다른 학생회 사람은 403, 로그인 없으면 401',
  withRegistrations(async t => {
    const { event, hash, id } = await started(t)
    const before = [await attendances(t, false), await logs(t)]
    for (const user of [
      's-planningHead',
      's-planningMember',
      's-financeMember',
      's-plain',
      's-ended',
      'o-president',
    ]) {
      assert.equal((await checkIn(t, event, hash, user)).status, 403, user)
      assert.equal((await onRegistration(t, id, 'attendance', user)).status, 403, user)
      assert.equal((await onRegistration(t, id, 'cancel', user)).status, 403, user)
    }
    assert.deepEqual([await attendances(t, false), await logs(t)], before)
    assert.equal((await checkIn(t, MISSING, hash)).status, 404)
    const theirs = await t.makeEvent({}, t.other)
    assert.equal((await checkIn(t, theirs, hash)).status, 404)
    assert.equal(
      (await t.api.post(`${t.orgBase}/events/${event}/check-in`, { tokenHash: hash })).status,
      401,
    )
    // 담당 부서 사람은 업무가 있으면 된다.
    await t.makeTask(event, t.council.departments.planning)
    assert.equal((await checkIn(t, event, hash, 's-planningMember')).status, 200)
  }),
)

test(
  '이름으로 출석은 방법 manual로 남고, 출석 취소 뒤 다시 출석할 수 있다. 출석이 없는데 취소하면 409 NOT_CHECKED_IN이다',
  withRegistrations(async t => {
    const { id } = await started(t)
    const none = await onRegistration(t, id, 'attendance/cancel')
    assert.equal(none.status, 409)
    assert.equal(await errorOf(none), 'NOT_CHECKED_IN')
    const marked = await onRegistration(t, id, 'attendance')
    assert.equal(marked.status, 200)
    assert.equal(((await marked.json()) as CheckInResult).already, false)
    assert.equal(
      ((await (await onRegistration(t, id, 'attendance')).json()) as CheckInResult).already,
      true,
    )
    assert.equal((await onRegistration(t, id, 'attendance/cancel')).status, 200)
    assert.equal(await attendances(t), 0)
    assert.equal((await onRegistration(t, id, 'attendance/cancel')).status, 409)
    assert.equal((await onRegistration(t, id, 'attendance')).status, 200)
    const { rows } = await t.pg.query(
      'SELECT method, cancelled_at IS NULL AS live FROM attendance ORDER BY confirmed_at',
    )
    assert.deepEqual(rows, [
      { method: 'manual', live: false },
      { method: 'manual', live: true },
    ])
    // 이름으로 한 출석도 이름·학번이 응답에 오므로 열람 기록이 남는다(둘 다 check_in).
    assert.equal(
      await t.count("SELECT count(*) AS n FROM applicant_access_log WHERE action = 'check_in'"),
      3,
    )
    assert.equal((await onRegistration(t, MISSING, 'attendance')).status, 404)
  }),
)

test(
  '운영진 취소: 마감 뒤에도 되고 이름·학번·휴대폰이 지금 값과 모든 판에서 비고 링크가 지워진다. 판의 바꾼 사람은 운영진이다',
  withRegistrations(async t => {
    const { event, token, id, hash } = await started(t)
    t.setNow(korean('2026-11-02T09:00'))
    const response = await onRegistration(t, id, 'cancel')
    assert.equal(response.status, 200)
    const row = (await t.pg.query('SELECT name, student_id, phone, cancelled_at FROM registration'))
      .rows[0] as Record<string, unknown>
    assert.deepEqual([row.name, row.student_id, row.phone], [null, null, null])
    assert.notEqual(row.cancelled_at, null)
    const versions = await t.pg.query<{ data: Record<string, unknown> }>(
      'SELECT data FROM record_version WHERE record_id = $1',
      [id],
    )
    assert.equal(versions.rows.length, 2)
    for (const { data } of versions.rows) {
      assert.deepEqual([data.name, data.student_id, data.phone], [null, null, null])
      assert.ok(!JSON.stringify(data).includes(kim.studentId))
    }
    // 신청 때(신청자) 판 1의 바꾼 사람은 비어 있고, 운영진 취소가 연 판 2는 그 운영진이다.
    const changers = await t.pg.query(
      'SELECT version_no, changed_by FROM record_version WHERE record_id = $1 ORDER BY version_no',
      [id],
    )
    assert.deepEqual(changers.rows, [
      { version_no: 1, changed_by: null },
      { version_no: 2, changed_by: t.council.people.president.memberId },
    ])
    assert.equal(await t.count('SELECT count(*) AS n FROM registration_link'), 0)
    assert.equal((await t.lookup(token)).status, 404)
    assert.equal((await checkIn(t, event, hash)).status, 404)
    assert.equal((await onRegistration(t, id, 'cancel')).status, 404)
    assert.equal((await onRegistration(t, id, 'attendance')).status, 404)
    assert.equal((await onRegistration(t, id, 'attendance/cancel')).status, 404)
  }),
)

test(
  '출석한 신청은 운영진도 출석을 먼저 취소해야 취소된다(409 CHECKED_IN). 다른 학생회 신청은 404이다',
  withRegistrations(async t => {
    const { event, id, hash } = await started(t)
    assert.equal((await checkIn(t, event, hash)).status, 200)
    const blocked = await onRegistration(t, id, 'cancel')
    assert.equal(blocked.status, 409)
    assert.equal(await errorOf(blocked), 'CHECKED_IN')
    assert.equal(
      await t.count('SELECT count(*) AS n FROM registration WHERE cancelled_at IS NOT NULL'),
      0,
    )
    assert.equal((await onRegistration(t, id, 'attendance/cancel')).status, 200)
    assert.equal((await onRegistration(t, id, 'cancel')).status, 200)
    // 다른 학생회 사람이 자기 학생회 경로로 이 신청 번호를 부르면 없는 것과 같다.
    const theirEvent = await t.makeEvent({}, t.other)
    const theirForm = await t.makeForm(theirEvent, {}, t.other)
    const theirs = await t.makeRegistration(theirForm, {}, t.other)
    for (const path of ['attendance', 'attendance/cancel', 'cancel'])
      assert.equal((await onRegistration(t, theirs, path)).status, 404, path)
  }),
)

test(
  '스스로 취소는 출석 뒤에 409이고, 출석 취소 뒤에는 다시 된다(출석 확인과 같은 신청 행 잠금을 쓴다)',
  withRegistrations(async t => {
    const { event, token, hash } = await started(t)
    assert.equal((await checkIn(t, event, hash)).status, 200)
    const blocked = await t.cancelMine(token)
    assert.equal(await errorOf(blocked), 'CHECKED_IN')
    const id = ((await t.pg.query('SELECT id FROM registration')).rows[0] as { id: string }).id
    assert.equal((await onRegistration(t, id, 'attendance/cancel')).status, 200)
    assert.equal((await t.cancelMine(token)).status, 200)
  }),
)

test(
  '열람 기록을 못 쓰면 출석 결과가 오지 않고 출석도 남지 않는다',
  withRegistrations(async t => {
    const { event, id, hash } = await started(t)
    await t.pg.exec(`
      CREATE FUNCTION fail_log() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'log down'; END $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_log BEFORE INSERT ON applicant_access_log FOR EACH ROW EXECUTE FUNCTION fail_log();
    `)
    for (const response of [
      await checkIn(t, event, hash),
      await onRegistration(t, id, 'attendance'),
    ]) {
      assert.equal(response.status, 500)
      const text = await response.text()
      assert.ok(!text.includes(kim.name) && !text.includes(kim.studentId))
    }
    assert.equal(await attendances(t, false), 0)
  }),
)
