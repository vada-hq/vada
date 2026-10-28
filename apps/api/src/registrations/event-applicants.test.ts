import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BulkApplicantsResponse, EventApplicantsResponse } from '@vada/contracts'
import { MISSING, type RegistrationKit, withRegistrations } from '../test-support/registrations.js'

const list = (t: RegistrationKit, eventId: string, query = '', user = 's-president') =>
  t.api.get(`${t.orgBase}/events/${eventId}/applicants${query}`, user)
const logs = (t: RegistrationKit) =>
  t.count("SELECT count(*) AS n FROM applicant_access_log WHERE action = 'list'")
const bulk = (
  t: RegistrationKit,
  eventId: string,
  ids: string[],
  { action = 'deposit', user = 's-president' }: { action?: string; user?: string } = {},
) => t.post(`/events/${eventId}/applicants/${action}`, { registrationIds: ids }, user)

test(
  '양식이 없던 행사는 열람 토큰을 주지 않고, 첫 신청을 읽을 때 기록을 남긴다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const empty = (await (await list(t, event)).json()) as EventApplicantsResponse
    assert.equal(empty.accessToken, null)
    assert.equal(await logs(t), 0)
    await t.makeRegistration(await t.makeForm(event), { name: '첫신청' })
    const body = (await (await list(t, event)).json()) as EventApplicantsResponse
    assert.equal(body.applicants[0]!.name, '첫신청')
    assert.ok(body.accessToken)
    assert.equal(await logs(t), 1)
  }),
)

test(
  '행사 명단은 응답에 포함된 양식마다 열람 기록을 남기고 빈 양식과 검색에서 빠진 양식은 기록하지 않는다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    await t.makeForm(event, { name: '빈 양식' })
    const first = await t.makeForm(event, { name: '오전', collectsPhone: true })
    const second = await t.makeForm(event, { name: '오후', collectsPhone: true })
    const filtered = await t.makeForm(event, { name: '검색 제외' })
    for (const form of [first, first, second])
      await t.makeRegistration(form, { name: '노출참가자', phone: '01012345678' })
    await t.makeRegistration(filtered, { name: '다른참가자' })
    await t.makeRegistration(await t.makeForm(await t.makeEvent()), { name: '노출참가자' })
    const response = await list(t, event, '?search=' + encodeURIComponent('노출'))
    assert.equal(response.status, 200)
    const body = (await response.json()) as EventApplicantsResponse
    assert.deepEqual(
      body.applicants.map(row => [row.formId, row.name, row.phone]),
      [first, first, second].map(formId => [formId, '노출참가자', '01012345678']),
    )
    const { rows } = await t.pg.query(
      'SELECT member_id, council_id, form_id, registration_id, action, ip FROM applicant_access_log ORDER BY form_id',
    )
    assert.deepEqual(
      rows,
      [first, second].map(formId => ({
        member_id: t.council.people.president.memberId,
        council_id: t.council.councilId,
        form_id: formId,
        registration_id: null,
        action: 'list',
        ip: 'unknown',
      })),
    )
    for (const token of ['', `&accessToken=${encodeURIComponent(body.accessToken!)}`]) {
      const empty = await list(t, event, `?search=${encodeURIComponent('없는참가자')}${token}`)
      assert.equal(empty.status, 200)
      assert.deepEqual(((await empty.json()) as EventApplicantsResponse).applicants, [])
      assert.equal(await logs(t), 2)
    }
  }),
)

test(
  '행사 명단은 두 번째 양식 기록이 실패하면 앞 기록도 롤백하고 새 열람과 토큰 재조회 모두 개인정보를 차단한다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const first = await t.makeForm(event)
    const second = await t.makeForm(event)
    await t.makeRegistration(first, { name: '첫비밀' })
    await t.makeRegistration(second, { name: '둘째비밀' })
    const initial = (await (
      await list(t, event, '?search=' + encodeURIComponent('첫비밀'))
    ).json()) as EventApplicantsResponse
    assert.equal(await logs(t), 1)
    await t.pg.exec(
      `CREATE FUNCTION fail_second_form_log() RETURNS trigger AS $$ BEGIN IF NEW.form_id = '${second}'::uuid THEN RAISE EXCEPTION 'log down'; END IF; RETURN NEW; END $$ LANGUAGE plpgsql; CREATE TRIGGER fail_second_form_log BEFORE INSERT ON applicant_access_log FOR EACH ROW EXECUTE FUNCTION fail_second_form_log();`,
    )
    for (const query of ['', `?accessToken=${encodeURIComponent(initial.accessToken!)}`]) {
      const failed = await list(t, event, query)
      assert.equal(failed.status, 500)
      const text = await failed.text()
      for (const name of ['첫비밀', '둘째비밀']) assert.ok(!text.includes(name))
      assert.equal(await logs(t), 1)
    }
  }),
)

test(
  '일괄 납부의 DB 오류는 그 줄만 롤백하고 뒤의 줄도 적용한다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const form = await t.makeForm(event)
    const ids = []
    for (let i = 0; i < 3; i++) ids.push(await t.makeRegistration(form, { appliedFee: '5000' }))
    await t.pg.exec(
      `CREATE FUNCTION fail_one_deposit() RETURNS trigger AS $$ BEGIN IF NEW.registration_id = '${ids[1]}'::uuid THEN RAISE EXCEPTION 'private failure'; END IF; RETURN NEW; END $$ LANGUAGE plpgsql; CREATE TRIGGER fail_one_deposit BEFORE INSERT ON deposit FOR EACH ROW EXECUTE FUNCTION fail_one_deposit();`,
    )
    const body = (await (await bulk(t, event, ids)).json()) as BulkApplicantsResponse
    assert.deepEqual(
      body.results.map(row => row.error),
      [null, 'REQUEST_FAILED', null],
    )
    assert.equal(await t.count('SELECT count(*) AS n FROM deposit'), 2)
    assert.equal(await t.count("SELECT count(*) AS n FROM record WHERE kind = 'deposit'"), 2)
  }),
)

test(
  '확인 필요는 중복·환불 대기·마감 뒤 미입금이며 이름 검색의 %는 글자 그대로다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const form = await t.makeForm(event, { closesAt: new Date('2026-10-24T00:00:00Z') })
    const unpaid = await t.makeRegistration(form, { name: '100%참가자', appliedFee: '3000' })
    const refunded = await t.makeRegistration(form, { name: '환불대기', appliedFee: '4000' })
    const ordinary = await t.makeRegistration(form, { name: '무료' })
    assert.equal((await bulk(t, event, [refunded])).status, 200)
    assert.equal((await t.post(`/registrations/${refunded}/cancel`, {})).status, 200)
    const body = (await (
      await list(t, event, '?needsAttention=true')
    ).json()) as EventApplicantsResponse
    assert.deepEqual(
      body.applicants.map(row => row.id),
      [unpaid, refunded],
    )
    const token = encodeURIComponent(body.accessToken!)
    const none = (await (
      await list(t, event, `?needsAttention=false&accessToken=${token}`)
    ).json()) as EventApplicantsResponse
    assert.deepEqual(
      none.applicants.map(row => row.id),
      [ordinary],
    )
    const pending = (await (
      await list(t, event, `?registration=cancelled&deposit=refund_pending&accessToken=${token}`)
    ).json()) as EventApplicantsResponse
    assert.deepEqual(
      pending.applicants.map(row => row.id),
      [refunded],
    )
    const search = (await (
      await list(t, event, `?search=%25&accessToken=${token}`)
    ).json()) as EventApplicantsResponse
    assert.deepEqual(
      search.applicants.map(row => row.id),
      [unpaid],
    )
  }),
)

test(
  '행사 명단: 50줄씩 신청 순, 양식 열, 중복 경고와 검색·거르기, 쪽을 넘길 때 반환된 양식 기록',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const first = await t.makeForm(event, { name: '오전' })
    const second = await t.makeForm(event, { name: '오후' })
    const ids = []
    for (let i = 0; i < 51; i++)
      ids.push(
        await t.makeRegistration(i === 50 ? second : first, {
          name: `신청${i}`,
          studentId: i < 2 ? '202612345' : `2026${String(i).padStart(5, '0')}`,
        }),
      )
    await t.attend(ids[0]!)
    const response = await list(t, event)
    assert.equal(response.status, 200)
    const body = (await response.json()) as EventApplicantsResponse
    assert.equal(body.applicants.length, 50)
    assert.deepEqual(body.counts, { applicants: 51, attended: 1 })
    assert.equal(body.total, 51)
    assert.equal(body.canManage, true)
    assert.equal(body.showForm, true)
    assert.equal(body.showAffiliation, false)
    assert.deepEqual(
      body.applicants.slice(0, 2).map(row => row.needsAttention),
      [true, true],
    )
    assert.equal(body.applicants[0]!.formTitle, '오전')
    assert.equal(await logs(t), 1)
    const token = encodeURIComponent(body.accessToken!)
    const next = (await (
      await list(t, event, `?page=2&accessToken=${token}`)
    ).json()) as EventApplicantsResponse
    assert.equal(next.applicants.length, 1)
    assert.equal(next.applicants[0]!.formTitle, '오후')
    assert.deepEqual(
      (await t.pg.query('SELECT form_id FROM applicant_access_log ORDER BY id')).rows,
      [{ form_id: first }, { form_id: second }],
    )
    const found = (await (
      await list(
        t,
        event,
        `?search=202612345&needsAttention=true&attendance=attended&accessToken=${token}`,
      )
    ).json()) as EventApplicantsResponse
    assert.deepEqual(
      found.applicants.map(row => row.id),
      [ids[0]],
    )
    assert.equal(await logs(t), 3)
    assert.equal(
      (await list(t, event, `?page=2&accessToken=${token}`, 's-vicePresident')).status,
      400,
    )
    assert.equal((await list(t, event, `?accessToken=${token}x`)).status, 400)
    assert.equal(await logs(t), 3)
    await list(t, event)
    assert.equal(await logs(t), 4)
  }),
)

test(
  '행사 명단: 권한 없는 운영진은 신청 수·참석 수만, 다른 학생회·없는 행사는 404',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const form = await t.makeForm(event)
    const id = await t.makeRegistration(form, { name: '비밀신청자', studentId: '202612345' })
    await t.attend(id)
    const response = await list(t, event, '', 's-plain')
    assert.equal(response.status, 200)
    const body = (await response.json()) as EventApplicantsResponse
    assert.equal(body.canView, false)
    assert.equal(body.canManage, false)
    assert.deepEqual(body.applicants, [])
    assert.deepEqual(body.counts, { applicants: 1, attended: 1 })
    assert.equal(body.accessToken, null)
    assert.ok(!JSON.stringify(body).includes('비밀신청자'))
    assert.equal(await logs(t), 0)
    for (const target of [MISSING, await t.makeEvent({}, t.other), 'bad'])
      assert.equal((await list(t, target)).status, 404)
    assert.equal((await t.api.get(`${t.orgBase}/events/${event}/applicants`)).status, 401)
  }),
)

test(
  '행사 명단: 양식마다 기한 지난 개인정보를 먼저 비우며 기록 실패는 정보 응답을 막는다',
  withRegistrations(async t => {
    const event = await t.makeEvent({
      startsAt: new Date('2025-01-01T00:00:00Z'),
      endsAt: new Date('2025-01-01T01:00:00Z'),
    })
    for (const name of ['오전', '오후']) {
      const form = await t.makeForm(event, { name, closesAt: new Date('2025-01-01T00:00:00Z') })
      await t.makeRegistration(form, { name: '기한지남', studentId: '202612345' })
    }
    const body = (await (await list(t, event)).json()) as EventApplicantsResponse
    assert.deepEqual(body.applicants, [])
    assert.equal(await t.count('SELECT count(*) AS n FROM registration WHERE name IS NOT NULL'), 0)
    const liveEvent = await t.makeEvent()
    await t.makeRegistration(await t.makeForm(liveEvent), { name: '응답금지' })
    await t.pg.exec(
      "CREATE FUNCTION fail_event_log() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'log down'; END $$ LANGUAGE plpgsql; CREATE TRIGGER fail_event_log BEFORE INSERT ON applicant_access_log FOR EACH ROW EXECUTE FUNCTION fail_event_log();",
    )
    const failed = await list(t, liveEvent)
    assert.equal(failed.status, 500)
    assert.ok(!(await failed.text()).includes('응답금지'))
  }),
)

test(
  '일괄 납부: 각 신청의 적용 참가비, 이미 처리·남의 행사·남의 학생회는 줄별 실패하고 나머지는 남는다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const form = await t.makeForm(event)
    const first = await t.makeRegistration(form, { appliedFee: '3000' })
    const second = await t.makeRegistration(form, { appliedFee: '7000' })
    const free = await t.makeRegistration(form)
    const elsewhere = await t.makeRegistration(await t.makeForm(await t.makeEvent()), {
      appliedFee: '9000',
    })
    const theirEvent = await t.makeEvent({}, t.other)
    const theirs = await t.makeRegistration(
      await t.makeForm(theirEvent, {}, t.other),
      { appliedFee: '8000' },
      t.other,
    )
    const ids = [first, elsewhere, second, theirs, free]
    const response = await bulk(t, event, ids)
    assert.equal(response.status, 200)
    assert.deepEqual(((await response.json()) as BulkApplicantsResponse).results, [
      { registrationId: first, error: null },
      { registrationId: elsewhere, error: 'NOT_FOUND' },
      { registrationId: second, error: null },
      { registrationId: theirs, error: 'NOT_FOUND' },
      { registrationId: free, error: 'INVALID_INPUT' },
    ])
    const rows = (
      await t.pg.query('SELECT registration_id, amount FROM deposit ORDER BY registration_id')
    ).rows
    assert.deepEqual(rows, [
      { registration_id: first, amount: '3000' },
      { registration_id: second, amount: '7000' },
    ])
    const repeated = await bulk(t, event, [first])
    assert.deepEqual(((await repeated.json()) as BulkApplicantsResponse).results, [
      { registrationId: first, error: 'DEPOSIT_EXISTS' },
    ])
  }),
)

test(
  '일괄 출석: 다른 행사 신청을 섞어도 그 줄만 실패, 읽기 권한만 있으면 줄별 403',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const id = await t.makeRegistration(await t.makeForm(event))
    const wrong = await t.makeRegistration(await t.makeForm(await t.makeEvent()))
    const denied = await bulk(t, event, [id], { action: 'attendance', user: 's-financeMember' })
    assert.deepEqual(((await denied.json()) as BulkApplicantsResponse).results, [
      { registrationId: id, error: 'FORBIDDEN' },
    ])
    const response = await bulk(t, event, [wrong, id], { action: 'attendance' })
    assert.equal(response.status, 200)
    assert.deepEqual(((await response.json()) as BulkApplicantsResponse).results, [
      { registrationId: wrong, error: 'NOT_FOUND' },
      { registrationId: id, error: null },
    ])
    assert.equal(await t.count('SELECT count(*) AS n FROM attendance'), 1)
    assert.equal((await bulk(t, await t.makeEvent({}, t.other), [id])).status, 404)
  }),
)

test(
  '행사 명단 요청과 일괄 본문: 상한·모르는 키·중복·잘못된 id와 미인증을 막는다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    for (const query of [
      '?page=0',
      '?page=1&page=2',
      '?unknown=1',
      '?search=%00',
      '?search=' + encodeURIComponent('😀'.repeat(51)),
    ])
      assert.equal((await list(t, event, query)).status, 400)
    for (const body of [
      {},
      { registrationIds: [] },
      { registrationIds: Array(51).fill(MISSING) },
      { registrationIds: [MISSING, MISSING] },
      { registrationIds: ['x'] },
      { registrationIds: ['\ud800'] },
      { registrationIds: [MISSING], other: true },
    ]) {
      assert.equal((await t.post(`/events/${event}/applicants/deposit`, body)).status, 400)
    }
    assert.equal(
      (
        await t.api.post(`${t.orgBase}/events/${event}/applicants/deposit`, {
          registrationIds: [MISSING],
        })
      ).status,
      401,
    )
  }),
)
