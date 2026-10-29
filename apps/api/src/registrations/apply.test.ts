import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { korean, withRegistrations, type RegistrationKit } from '../test-support/registrations.js'

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')
const body = (response: Response) => response.json() as Promise<Record<string, unknown>>

// 참가비가 갈리는 양식(납부자 0원, 미납자 5000원, 휴대폰도 받는다)과 코드
async function splitForm(t: RegistrationKit, extra: Record<string, unknown> = {}) {
  const event = await t.makeEvent()
  const account = await t.makeAccount()
  const { form } = await t.activeForm(event, {
    payerFee: 0,
    nonPayerFee: 5000,
    feeAccountId: account,
    collectsPhone: true,
    ...extra,
  })
  return form
}
const person = { name: '김신청', studentId: '202612345', phone: '010-1234 5678' }

test(
  '신청하면 201과 토큰이 오고 DB에는 해시만 있다. 휴대폰은 공백과 -를 빼고 저장하며 판의 바꾼 사람은 비어 있다',
  withRegistrations(async t => {
    const form = await splitForm(t)
    const response = await t.apply(form.publicCode, person)
    assert.equal(response.status, 201)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const { token } = (await body(response)) as { token: string }
    assert.match(token, /^[A-Za-z0-9_-]{22}$/)
    const links = (await t.pg.query('SELECT registration_id, token_hash FROM registration_link'))
      .rows as { registration_id: string; token_hash: string }[]
    assert.equal(links.length, 1)
    assert.equal(links[0]!.token_hash, sha256(token))
    assert.notEqual(links[0]!.token_hash, token)
    const saved = (
      await t.pg.query('SELECT name, student_id, phone, applied_fee, form_id FROM registration')
    ).rows[0] as Record<string, string>
    assert.deepEqual(
      [saved.name, saved.student_id, saved.phone, saved.applied_fee, saved.form_id],
      ['김신청', '202612345', '01012345678', '5000', form.id],
    )
    const version = (
      await t.pg.query('SELECT version_no, changed_by FROM record_version WHERE record_id = $1', [
        links[0]!.registration_id,
      ])
    ).rows
    assert.deepEqual(version, [{ version_no: 1, changed_by: null }])
    // 같은 토큰을 다른 곳에 남기지 않았다.
    const dump = JSON.stringify((await t.pg.query('SELECT data FROM record_version')).rows)
    assert.ok(!dump.includes(token))
  }),
)

test(
  '적용 참가비: 참가비가 없으면 0, 두 값이 같으면 그 값이다. 학번을 받지 않는 양식에 학번이 오면 409이다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const account = await t.makeAccount()
    const off = { collectsStudentId: false }
    const none = (await t.activeForm(event, off)).form
    const same = (
      await t.activeForm(event, {
        payerFee: 3000,
        nonPayerFee: 3000,
        feeAccountId: account,
        ...off,
      })
    ).form
    const lastFee = async () =>
      Number(
        (
          (await t.pg.query('SELECT applied_fee FROM registration ORDER BY id DESC LIMIT 1'))
            .rows[0] as { applied_fee: string }
        ).applied_fee,
      )
    await t.applied(none.publicCode, { name: '가' })
    assert.equal(await lastFee(), 0)
    await t.applied(same.publicCode, { name: '나' })
    assert.equal(await lastFee(), 3000)
    // 받지 않는 학번은 409이다.
    const extra = await t.apply(same.publicCode, { name: '다', studentId: '202612345' })
    assert.equal(extra.status, 409)
    assert.deepEqual(await body(extra), { error: 'FORM_CHANGED' })
  }),
)

test(
  '적용 참가비는 신청한 날(한국)이 납부 기간 안이면 납부자 참가비이고 경계는 자정이다. 다른 학생회 명단과 뺀 줄은 맞지 않는다',
  withRegistrations(async t => {
    const form = await splitForm(t, { collectsPhone: false })
    const phoneless = { name: '김신청', studentId: '202612345' }
    await t.makeFeePayment({ paidFrom: '2026-10-20', paidUntil: '2026-10-25' })
    await t.makeFeePayment(
      { studentId: '202699999', paidFrom: '2026-10-01', paidUntil: '2026-10-31' },
      t.other,
    )
    await t.makeFeePayment({ studentId: null, paidFrom: '2026-10-20', paidUntil: '2026-10-25' })
    const feeAt = async (at: string, studentId = '202612345') => {
      t.setNow(korean(at))
      const token = await t.applied(form.publicCode, { ...phoneless, studentId })
      const row = (
        await t.pg.query('SELECT applied_fee FROM registration ORDER BY id DESC LIMIT 1')
      ).rows[0] as { applied_fee: string }
      // 같은 양식에 같은 학번을 다시 신청하려면 앞 신청을 취소한다(DEC-107). 적용 참가비는 그대로 남는다.
      assert.equal((await t.cancelMine(token)).status, 200)
      return Number(row.applied_fee)
    }
    assert.equal(await feeAt('2026-10-19T23:59:59'), 5000)
    assert.equal(await feeAt('2026-10-20T00:00:00'), 0)
    assert.equal(await feeAt('2026-10-25T23:59:59'), 0)
    assert.equal(await feeAt('2026-10-26T00:00:00'), 5000)
    // 다른 학생회 명단에만 있는 학번, 명단에 없는 학번은 미납자다.
    t.setNow(korean('2026-10-22T12:00:00'))
    assert.equal(await feeAt('2026-10-22T12:00:00', '202699999'), 5000)
    assert.equal(await feeAt('2026-10-22T12:00:00', '202600001'), 5000)
    // 명단이 나중에 바뀌어도 이미 정한 값은 그대로다.
    await t.pg.query(
      `UPDATE fee_payment SET paid_from = '2026-01-01', paid_until = '2026-01-02' WHERE student_id = '202612345'`,
    )
    const stored = (await t.pg.query('SELECT applied_fee FROM registration WHERE applied_fee = 0'))
      .rows
    assert.equal(stored.length, 2)
  }),
)

test(
  '받지 않는 칸이 오거나 받는 칸이 없으면 409 FORM_CHANGED이고 아무것도 쓰지 않는다',
  withRegistrations(async t => {
    const form = await splitForm(t)
    const cases: Record<string, unknown>[] = [
      { name: '가', phone: '01012345678' },
      { name: '가', studentId: '202612345' },
      { name: '가' },
    ]
    for (const input of cases) {
      const response = await t.apply(form.publicCode, input)
      assert.equal(response.status, 409, JSON.stringify(input))
      assert.deepEqual(await body(response), { error: 'FORM_CHANGED' })
    }
    // 학번도 휴대폰도 받지 않는 양식에 보내면 같다.
    const plain = (await t.activeForm(await t.makeEvent(), { collectsStudentId: false })).form
    for (const input of [
      { name: '가', phone: '01012345678' },
      { name: '가', studentId: '202612345' },
    ])
      assert.equal((await t.apply(plain.publicCode, input)).status, 409)
    // 학번을 받는 양식은 참가비가 없거나 하나여도 학번이 없으면 409이다(DEC-75).
    // splitForm이 대표 계좌를 이미 만들었다.
    const account = await t.makeAccount({ name: '행사', type: 'business' })
    for (const fees of [{}, { payerFee: 3000, nonPayerFee: 3000, feeAccountId: account }]) {
      const collecting = (await t.activeForm(await t.makeEvent(), fees)).form
      assert.equal(collecting.collectsStudentId, true)
      const response = await t.apply(collecting.publicCode, { name: '가' })
      assert.equal(response.status, 409, JSON.stringify(fees))
      assert.deepEqual(await body(response), { error: 'FORM_CHANGED' })
    }
    assert.equal(await t.count('SELECT count(*) AS n FROM registration'), 0)
    assert.equal(await t.count('SELECT count(*) AS n FROM registration_link'), 0)
  }),
)

test(
  '받는 중이 아니면 409 REGISTRATION_NOT_OPEN(시작 전, 멈춤, 마감), 정원이 차면 REGISTRATION_FULL이다. 취소한 신청은 자리를 비운다',
  withRegistrations(async t => {
    const form = await splitForm(t, { opensAt: '2026-10-26T09:00', capacity: 1 })
    const input = { name: '가', studentId: '202612345', phone: '01012345678' }
    const codeOf = async (at: string) => {
      t.setNow(korean(at))
      const response = await t.apply(form.publicCode, input)
      return [response.status, ((await body(response)) as { error?: string }).error]
    }
    assert.deepEqual(await codeOf('2026-10-26T08:59:59'), [409, 'REGISTRATION_NOT_OPEN'])
    t.setNow(korean('2026-10-26T09:00:00'))
    const token = await t.applied(form.publicCode, input)
    assert.deepEqual(await codeOf('2026-10-26T09:00:01'), [409, 'REGISTRATION_FULL'])
    assert.equal((await t.cancelMine(token)).status, 200)
    await t.post(`/registration-forms/${form.id}/pause`, {})
    assert.deepEqual(await codeOf('2026-10-26T10:00:00'), [409, 'REGISTRATION_NOT_OPEN'])
    await t.pg.query('UPDATE event SET starts_at = $1 WHERE id = $2', [
      korean('2026-11-02T12:00'),
      form.eventId,
    ])
    await t.post(`/registration-forms/${form.id}/resume`, {})
    assert.deepEqual(await codeOf('2026-11-01T17:59:59'), [201, undefined])
    t.setNow(korean('2026-11-01T18:00:00'))
    assert.deepEqual(await codeOf('2026-11-01T18:00:00'), [409, 'REGISTRATION_NOT_OPEN'])
  }),
)

test(
  '같은 양식에 취소하지 않은 같은 학번이 있으면 409 DUPLICATE_STUDENT_ID이고 아무것도 쓰지 않는다. 앞뒤 공백은 같은 학번이다(DEC-107)',
  withRegistrations(async t => {
    const form = await splitForm(t)
    await t.applied(form.publicCode, person)
    const receipts = await t.count('SELECT count(*) AS n FROM command_receipt')
    for (const studentId of [person.studentId, ` ${person.studentId} `]) {
      const again = await t.apply(form.publicCode, { ...person, name: '이신청', studentId })
      assert.equal(again.status, 409, studentId)
      assert.equal(again.headers.get('cache-control'), 'no-store')
      assert.deepEqual(await body(again), { error: 'DUPLICATE_STUDENT_ID' })
    }
    assert.equal(await t.count('SELECT count(*) AS n FROM registration'), 1)
    assert.equal(await t.count('SELECT count(*) AS n FROM registration_link'), 1)
    assert.equal(await t.count('SELECT count(*) AS n FROM command_receipt'), receipts)
    // 다른 학번은 된다.
    await t.applied(form.publicCode, { ...person, studentId: '202612346' })
  }),
)

test(
  '취소한 신청과 신청자 정보를 비운 신청의 학번은 같은 양식에 다시 신청할 수 있다(DEC-107)',
  withRegistrations(async t => {
    const form = await splitForm(t)
    const token = await t.applied(form.publicCode, person)
    assert.equal((await t.cancelMine(token)).status, 200)
    await t.applied(form.publicCode, person)
    // 1년이 지나 비운 신청은 학번이 없어 세지 않는다(DEC-55).
    await t.pg.query('UPDATE registration SET student_id = NULL WHERE cancelled_at IS NULL')
    await t.applied(form.publicCode, person)
    assert.equal(
      await t.count('SELECT count(*) AS n FROM registration WHERE cancelled_at IS NULL'),
      2,
    )
  }),
)

test(
  '같은 행사의 다른 양식에는 같은 학번으로 각각 신청하고, 다른 양식 사이의 같은 학번 표시는 그대로다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const first = (await t.activeForm(event)).form
    const second = (await t.activeForm(event)).form
    await t.applied(first.publicCode, { name: '가', studentId: '202612345' })
    await t.applied(second.publicCode, { name: '가', studentId: '202612345' })
    const listed = (await (
      await t.api.get(`${t.orgBase}/registration-forms/${first.id}/applicants`, 's-president')
    ).json()) as { applicants: { duplicateStudentId: boolean }[] }
    assert.deepEqual(
      listed.applicants.map(row => row.duplicateStudentId),
      [true],
    )
  }),
)

test(
  '학번을 받지 않는 양식은 같은 이름·휴대폰으로 여러 번 신청할 수 있다(DEC-107은 학번만 본다)',
  withRegistrations(async t => {
    const plain = (
      await t.activeForm(await t.makeEvent(), { collectsStudentId: false, collectsPhone: true })
    ).form
    const same = { name: '가', phone: '01012345678' }
    await t.applied(plain.publicCode, same)
    await t.applied(plain.publicCode, same)
    assert.equal(await t.count('SELECT count(*) AS n FROM registration'), 2)
  }),
)

test(
  '같은 학번 신청 둘이 함께 와도 하나만 되고 나머지는 DUPLICATE_STUDENT_ID다',
  withRegistrations(async t => {
    const form = await splitForm(t)
    const responses = await Promise.all([
      t.apply(form.publicCode, person),
      t.apply(form.publicCode, { ...person, name: '이신청' }),
    ])
    assert.deepEqual(
      responses.map(response => response.status).sort((a, b) => a - b),
      [201, 409],
    )
    const rejected = responses.find(response => response.status === 409)!
    assert.deepEqual(await body(rejected), { error: 'DUPLICATE_STUDENT_ID' })
    assert.equal(await t.count('SELECT count(*) AS n FROM registration'), 1)
  }),
)

test(
  '같은 명령 번호의 재전송은 같은 학번이어도 거절하지 않고 처음 신청의 새 링크를 받는다(DEC-84)',
  withRegistrations(async t => {
    const form = await splitForm(t)
    const sent = { ...person, commandId: '3f2b8a52-6c1e-4d0b-9a7e-2d5c8f1b4a61' }
    assert.equal((await t.apply(form.publicCode, sent)).status, 201)
    const again = await t.apply(form.publicCode, sent)
    assert.equal(again.status, 201)
    assert.equal(await t.count('SELECT count(*) AS n FROM registration'), 1)
    assert.equal((await t.lookup(((await body(again)) as { token: string }).token)).status, 200)
  }),
)

test(
  '모르는 코드와 형식이 틀린 코드는 가르지 않고 404이며, 다른 학생회 양식에 한 신청은 그 학생회 것이다',
  withRegistrations(async t => {
    for (const code of ['AAAAAAAA', 'short', '1111111O'])
      assert.equal((await t.apply(code, person)).status, 404, code)
    const otherEvent = await t.makeEvent({}, t.other)
    const otherAccount = await t.makeAccount({}, t.other)
    await t.makeForm(
      otherEvent,
      { publicCode: 'BBBBBBB2', payerFee: '0', nonPayerFee: '5000', feeAccountId: otherAccount },
      t.other,
    )
    await t.applied('BBBBBBB2', { name: '가', studentId: '202612345' })
    const owner = (
      await t.pg.query('SELECT r.council_id FROM registration g JOIN record r ON r.id = g.id')
    ).rows[0] as { council_id: string }
    assert.equal(owner.council_id, t.other.councilId)
  }),
)

test(
  '입력 경계: 필수값 누락, 빈 문자열·공백, 상한+1(이모지), NUL·홀로 쓰인 서러게이트, 모르는 키, 형식이 틀린 학번·휴대폰은 400이고 아무것도 쓰지 않는다',
  withRegistrations(async t => {
    const form = await splitForm(t)
    const bad: unknown[] = [
      {},
      { studentId: '202612345', phone: '01012345678' },
      { ...person, name: '' },
      { ...person, name: '   ' },
      { ...person, name: '😀'.repeat(51) },
      { ...person, name: '가\u0000나' },
      { ...person, name: '가\ud800' },
      { ...person, extra: 1 },
      { ...person, studentId: '12345' },
      { ...person, studentId: '1234567890123' },
      { ...person, studentId: '２０２６１２３４５' },
      { ...person, studentId: '' },
      { ...person, phone: '' },
      { ...person, phone: '02-123-4567' },
      { ...person, phone: '0101234567890123456789' },
      { ...person, phone: '010\u00001234567' },
      { ...person, name: 3 },
    ]
    for (const input of bad) {
      const response = await t.apply(form.publicCode, input)
      assert.equal(response.status, 400, JSON.stringify(input))
    }
    assert.equal(await t.count('SELECT count(*) AS n FROM registration'), 0)
    // 상한 그대로는 받는다(이모지 50자).
    const ok = await t.apply(form.publicCode, { ...person, name: '😀'.repeat(50) })
    assert.equal(ok.status, 201)
  }),
)

test(
  '신청이 실패해도 성공해도 로그에 이름, 학번, 휴대폰, 토큰이 남지 않는다',
  withRegistrations(async t => {
    const form = await splitForm(t)
    const logged: string[] = []
    const methods = ['log', 'info', 'warn', 'error', 'debug'] as const
    const originals = methods.map(name => console[name])
    for (const name of methods)
      console[name] = (...args: unknown[]) => void logged.push(args.map(String).join(' '))
    try {
      const token = await t.applied(form.publicCode, person)
      await t.apply(form.publicCode, { name: '가', studentId: '202612345' })
      await t.lookup(token)
      await t.cancelMine(token)
      await t.lookup(token)
    } finally {
      methods.forEach((name, index) => (console[name] = originals[index]!))
    }
    const all = logged.join('\n')
    for (const secret of ['김신청', '202612345', '01012345678', '010-1234'])
      assert.ok(!all.includes(secret), secret)
  }),
)

test(
  '학번 받기를 바꾸면 그 뒤의 신청부터 따르고, 이미 받은 학번은 그대로다(DEC-75)',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const { form } = await t.activeForm(event)
    assert.equal(form.collectsStudentId, true)
    await t.applied(form.publicCode, { name: '가', studentId: '202612345' })
    const edit = {
      name: form.name,
      opensAt: form.opensAt,
      closesAt: form.closesAt,
      capacity: form.capacity,
      notice: form.notice,
      collectsPhone: form.collectsPhone,
      collectsStudentId: false,
      payerFee: null,
      nonPayerFee: null,
      feeAccountId: null,
    }
    assert.equal((await t.post(`/registration-forms/${form.id}`, edit)).status, 200)
    const late = await t.apply(form.publicCode, { name: '나', studentId: '202654321' })
    assert.equal(late.status, 409)
    assert.deepEqual(await body(late), { error: 'FORM_CHANGED' })
    await t.applied(form.publicCode, { name: '나' })
    const rows = (await t.pg.query('SELECT name, student_id FROM registration ORDER BY id')).rows
    assert.deepEqual(rows, [
      { name: '가', student_id: '202612345' },
      { name: '나', student_id: null },
    ])
    // 다시 켜면 그 뒤의 신청은 학번이 있어야 한다.
    assert.equal(
      (await t.post(`/registration-forms/${form.id}`, { ...edit, collectsStudentId: true })).status,
      200,
    )
    assert.equal((await t.apply(form.publicCode, { name: '다' })).status, 409)
    await t.applied(form.publicCode, { name: '다', studentId: '202600001' })
  }),
)
