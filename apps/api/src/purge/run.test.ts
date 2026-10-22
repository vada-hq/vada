import assert from 'node:assert/strict'
import { test } from 'node:test'
import { updateRecord } from '../records/records.js'
import { setErrorReporter } from '../http/on-error.js'
import { startFeePayments } from '../test-support/fee-payments.js'
import { korean, withRegistrations, type RegistrationKit } from '../test-support/registrations.js'
import { runPurge, startPurge } from './run.js'

const PERSON = { name: '김학생', studentId: '20260001', phone: '01012345678' }
// 신청마다 다른 해시(형식: 소문자 16진 64자)
const hashOf = (id: string) => id.replaceAll('-', '').repeat(2)

// 행사(끝 2026-11-01 18:00)의 양식 하나와 개인정보가 다 있는 신청 하나, 그 개인 링크, 값이 든 판 둘을 만든다.
async function applicant(t: RegistrationKit, endsAt = '2026-11-01T18:00', day = '2026-11-01') {
  const event = await t.makeEvent({
    startsAt: korean(`${day}T10:00`),
    endsAt: korean(endsAt),
  })
  const form = await t.makeForm(event, { collectsPhone: true })
  const id = await t.makeRegistration(form, PERSON)
  await t.pg.query('INSERT INTO registration_link (registration_id, token_hash) VALUES ($1, $2)', [
    id,
    hashOf(id),
  ])
  await t.change('registration', id, { phone: '01099998888' })
  return { event, form, id }
}

const valuesOf = async (t: RegistrationKit, id: string) => {
  const { rows } = await t.pg.query(
    'SELECT name, student_id, phone FROM registration WHERE id = $1',
    [id],
  )
  return rows[0] as { name: string | null; student_id: string | null; phone: string | null }
}
const leftInVersions = (t: RegistrationKit, id: string) =>
  t.count(
    `SELECT count(*) AS n FROM record_version WHERE record_id = $1
       AND (data ->> 'name' IS NOT NULL OR data ->> 'student_id' IS NOT NULL OR data ->> 'phone' IS NOT NULL)`,
    [id],
  )
const linksOf = (t: RegistrationKit, id: string) =>
  t.count('SELECT count(*) AS n FROM registration_link WHERE registration_id = $1', [id])

test(
  '신청자 정보는 행사 끝 날짜 + 1년의 한국 자정에 지금 값과 모든 판에서 비워지고 개인 링크 줄이 지워진다',
  withRegistrations(async t => {
    const { id } = await applicant(t)
    assert.equal(await t.versions(id), 2)
    assert.equal(await runPurge(t.db, korean('2027-10-31T23:59:59')), true)
    assert.deepEqual(await valuesOf(t, id), {
      name: '김학생',
      student_id: '20260001',
      phone: '01099998888',
    })
    assert.equal(await linksOf(t, id), 1)
    await runPurge(t.db, korean('2027-11-01T00:00:01'))
    assert.deepEqual(await valuesOf(t, id), { name: null, student_id: null, phone: null })
    assert.equal(await leftInVersions(t, id), 0)
    // 행과 판은 남는다.
    assert.equal(await t.versions(id), 2)
    assert.equal(await linksOf(t, id), 0)
    // 두 번 돌려도 같다.
    await runPurge(t.db, korean('2027-11-02T00:00:00'))
    assert.deepEqual(await valuesOf(t, id), { name: null, student_id: null, phone: null })
    assert.equal(await t.versions(id), 2)
  }),
)

test(
  '행사 날짜를 미루면 지울 날도 미뤄지고, 끝이 없으면 시작, 둘 다 없으면 양식 마감을 기준으로 한다',
  withRegistrations(async t => {
    const { event, id } = await applicant(t)
    await t.db.transaction(tx =>
      updateRecord(tx, {
        kind: 'event',
        id: event,
        actor: t.council.people.president.memberId,
        reason: null,
        changes: { endsAt: korean('2026-12-31T18:00') },
      }),
    )
    await runPurge(t.db, korean('2027-11-05T00:00:00'))
    assert.equal((await valuesOf(t, id)).name, '김학생')
    await runPurge(t.db, korean('2028-01-01T00:00:00'))
    assert.equal((await valuesOf(t, id)).name, null)

    const noEnd = await t.makeEvent({ startsAt: korean('2026-03-10T10:00') })
    const startOnly = await t.makeRegistration(await t.makeForm(noEnd), PERSON)
    const bare = await t.makeEvent()
    const closeOnly = await t.makeRegistration(await t.makeForm(bare), PERSON)
    await runPurge(t.db, korean('2027-03-09T23:59:59'))
    assert.equal((await valuesOf(t, startOnly)).name, '김학생')
    await runPurge(t.db, korean('2027-03-10T00:00:00'))
    assert.equal((await valuesOf(t, startOnly)).name, null)
    // 양식 마감은 2026-11-01이다.
    assert.equal((await valuesOf(t, closeOnly)).name, '김학생')
    await runPurge(t.db, korean('2027-11-01T00:00:00'))
    assert.equal((await valuesOf(t, closeOnly)).name, null)
  }),
)

test(
  '기한 전 양식의 신청과 다른 양식의 개인 링크는 건드리지 않는다. 취소해 이미 비어 링크만 남은 신청도 링크를 지운다',
  withRegistrations(async t => {
    const due = await applicant(t)
    const early = await applicant(t, '2027-06-01T18:00')
    const cancelled = await t.makeRegistration(due.form, { name: null, appliedFee: '0' })
    await t.pg.query(
      'INSERT INTO registration_link (registration_id, token_hash) VALUES ($1, $2)',
      [cancelled, 'b'.repeat(64)],
    )
    await runPurge(t.db, korean('2027-11-02T00:00:00'))
    assert.equal((await valuesOf(t, due.id)).name, null)
    assert.equal(await linksOf(t, cancelled), 0)
    assert.equal((await valuesOf(t, early.id)).name, '김학생')
    assert.equal(await linksOf(t, early.id), 1)
  }),
)

test(
  '양식 하나를 읽기 전에 그 양식의 기한이 지난 정보를 먼저 지운다. 운영진이 아니면 403이고 지우지 않는다',
  withRegistrations(async t => {
    // 현재 기수(2026년) 안에서 읽도록 2025년 행사로 둔다: 지울 날은 2026-03-01이다.
    const { form, id } = await applicant(t, '2025-03-01T18:00', '2025-03-01')
    t.setNow(korean('2026-03-01T00:00:01'))
    assert.equal(
      (await t.api.get(`${t.orgBase}/registration-forms/${form}`, 's-planningMember')).status,
      200,
    )
    assert.deepEqual(await valuesOf(t, id), { name: null, student_id: null, phone: null })
    assert.equal(await leftInVersions(t, id), 0)
    assert.equal(await linksOf(t, id), 0)

    const other = await applicant(t, '2025-03-01T18:00', '2025-03-01')
    assert.equal(
      (await t.api.get(`${t.orgBase}/registration-forms/${other.form}`, 'o-president')).status,
      403,
    )
    assert.equal((await t.api.get(`${t.orgBase}/registration-forms/${other.form}`)).status, 401)
    assert.equal((await valuesOf(t, other.id)).name, '김학생')
  }),
)

test(
  '열람 기록은 기록한 지 1년이 지나면 지워지고 기한 전 기록은 남는다',
  withRegistrations(async t => {
    const { form } = await applicant(t)
    const log = (at: string) =>
      t.pg.query(
        `INSERT INTO applicant_access_log (member_id, council_id, form_id, action, accessed_at, ip)
         VALUES ($1, $2, $3, 'list', $4, '203.0.113.7')`,
        [t.council.people.president.memberId, t.council.councilId, form, korean(at).toISOString()],
      )
    await log('2026-11-01T09:00:00')
    await log('2026-11-01T09:00:02')
    await runPurge(t.db, korean('2027-11-01T09:00:01'))
    assert.equal(await t.count('SELECT count(*) AS n FROM applicant_access_log'), 1)
    await runPurge(t.db, korean('2027-11-01T09:00:03'))
    assert.equal(await t.count('SELECT count(*) AS n FROM applicant_access_log'), 0)
  }),
)

test(
  '다른 실행이 잠금을 쥐고 있으면 건너뛰고 아무것도 지우지 않는다',
  withRegistrations(async t => {
    const { id } = await applicant(t)
    assert.equal(await runPurge(t.db, korean('2030-01-01T00:00:00'), async () => false), false)
    assert.equal((await valuesOf(t, id)).name, '김학생')
    assert.equal(await runPurge(t.db, korean('2030-01-01T00:00:00')), true)
    assert.equal((await valuesOf(t, id)).name, null)
  }),
)

test('납부 학번은 납부 끝 + 1년에 비워지고 2월 29일에 끝난 기간은 다음 해 3월 1일에 비워진다', async () => {
  const t = await startFeePayments()
  try {
    const put = (paidUntil: string, students: string) =>
      t.upload({ paidFrom: '2023-01-01', paidUntil, students })
    await put('2024-02-29', '20240229')
    await put('2024-08-31', '20240831')
    const student = (id: string) =>
      t.count('SELECT count(*) AS n FROM fee_payment WHERE student_id = $1', [id])
    const versioned = () =>
      t.count(`SELECT count(*) AS n FROM record_version WHERE data ->> 'student_id' IS NOT NULL`)
    const at = (value: string) => new Date(`${value}+09:00`)
    await runPurge(t.db, at('2025-02-28T23:59:59'))
    assert.equal(await student('20240229'), 1)
    await runPurge(t.db, at('2025-03-01T00:00:01'))
    assert.equal(await student('20240229'), 0)
    assert.equal(await student('20240831'), 1)
    assert.equal(await versioned(), 1)
    // 줄은 남는다.
    assert.equal(await t.count('SELECT count(*) AS n FROM fee_payment'), 2)
    await runPurge(t.db, at('2025-08-30T23:59:59'))
    assert.equal(await student('20240831'), 1)
    await runPurge(t.db, at('2025-08-31T00:00:01'))
    await runPurge(t.db, at('2025-08-31T00:00:01'))
    assert.equal(await student('20240831'), 0)
    assert.equal(await versioned(), 0)
  } finally {
    await t.close()
  }
})

test('지우기가 실패하면 서버는 멈추지 않고 뒤 작업 보고로 가며 메시지와 값은 담기지 않는다', async () => {
  const reported: { error: Error; fields: Record<string, unknown> }[] = []
  setErrorReporter((error, fields) => reported.push({ error, fields }))
  const logs: string[] = []
  const original = console.error
  console.error = (line: string) => logs.push(String(line))
  try {
    const failing = {
      transaction: () => Promise.reject(new Error('연결 문자열 postgres://비밀')),
    } as never
    const stop = startPurge(failing, { intervalMs: 3_600_000 })
    await new Promise(resolve => setImmediate(resolve))
    stop()
    assert.equal(reported.length, 1)
    assert.equal(reported[0]!.fields.route, 'background:purge')
    assert.equal(reported[0]!.fields.event, 'background_failed')
    assert.ok(!logs.join('').includes('비밀'))
    assert.equal(logs.length, 1)
  } finally {
    console.error = original
    setErrorReporter(undefined)
  }
})
