import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { qrTextOf, tokenHashOfQr, type MyRegistration } from '@vada/contracts'
import { createRecord } from '../records/records.js'
import { korean, withRegistrations, type RegistrationKit } from '../test-support/registrations.js'

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')
const person = { name: '김신청', studentId: '202612345', phone: '01012345678' }

async function split(t: RegistrationKit) {
  const event = await t.makeEvent({
    name: '가을 축제',
    startsAt: korean('2026-11-05T14:00'),
    endsAt: korean('2026-11-05T18:00'),
    place: '대운동장',
  })
  const account = await t.makeAccount()
  const { form } = await t.created(event, {
    payerFee: 0,
    nonPayerFee: 5000,
    feeAccountId: account,
    collectsPhone: true,
    notice: '문의는 카톡',
  })
  return form
}
const mineOf = async (t: RegistrationKit, token: string) =>
  (await (await t.lookup(token)).json()) as MyRegistration
const errorOf = async (response: Response) => ((await response.json()) as { error: string }).error

test(
  '개인 링크 조회: 내가 넣은 것, 적용 참가비, 참가비가 있으면 계좌, QR 글자(대문자 해시), 출석과 취소 가능 여부를 준다',
  withRegistrations(async t => {
    const form = await split(t)
    const token = await t.applied(form.publicCode, person)
    const response = await t.lookup(token)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await response.json(), {
      councilName: 's 학생회',
      event: {
        name: '가을 축제',
        startsAt: '2026-11-05T14:00',
        endsAt: '2026-11-05T18:00',
        place: '대운동장',
      },
      form: { name: form.name, opensAt: null, closesAt: '2026-11-01T18:00', notice: '문의는 카톡' },
      mine: person,
      appliedFee: 5000,
      account: { bank: '국민은행', accountNumber: '123-45-6789012', holder: '한양대 학생회' },
      qrText: `VADA:${sha256(token).toUpperCase()}`,
      attended: false,
      cancellable: true,
      purgeOn: '2027-11-05',
    })
    // QR 글자는 대문자이고 저장된 소문자 해시와 맞춰진다.
    const mine = await mineOf(t, token)
    assert.equal(tokenHashOfQr(mine.qrText), sha256(token))
    assert.equal(qrTextOf(sha256(token)), mine.qrText)
    const stored = (await t.pg.query('SELECT token_hash FROM registration_link')).rows[0] as {
      token_hash: string
    }
    assert.equal(tokenHashOfQr(mine.qrText), stored.token_hash)
  }),
)

test(
  '참가비가 0이면 계좌를 주지 않고, 출석하면 취소할 수 없다. 마감 뒤에도 취소할 수 없다',
  withRegistrations(async t => {
    const form = await split(t)
    t.setNow(korean('2026-10-25T12:00'))
    await t.makeFeePayment({ paidFrom: '2026-10-01', paidUntil: '2026-10-31' })
    const token = await t.applied(form.publicCode, person)
    const free = await mineOf(t, token)
    assert.deepEqual([free.appliedFee, free.account], [0, null])
    assert.equal(free.cancellable, true)
    const id = (await t.pg.query('SELECT id FROM registration')).rows[0] as { id: string }
    await t.attend(id.id)
    const attended = await mineOf(t, token)
    assert.deepEqual([attended.attended, attended.cancellable], [true, false])
    t.setNow(korean('2026-11-01T17:59:59'))
    const second = await t.applied(form.publicCode, { ...person, name: '이신청' })
    assert.equal((await mineOf(t, second)).cancellable, true)
    t.setNow(korean('2026-11-01T18:00:00'))
    assert.equal((await mineOf(t, second)).cancellable, false)
  }),
)

test(
  '모르는 토큰, 형식이 틀린 토큰은 가르지 않고 404이다. 모르는 키는 400이고 본문이 없어도 400이다',
  withRegistrations(async t => {
    const form = await split(t)
    await t.applied(form.publicCode, person)
    for (const token of ['x', 'A'.repeat(22), 'A'.repeat(64), sha256('a')]) {
      for (const call of [t.lookup, t.cancelMine]) {
        const response = await call(token)
        assert.equal(response.status, 404, token)
        assert.deepEqual(await response.json(), { error: 'NOT_FOUND' })
        assert.equal(response.headers.get('cache-control'), 'no-store')
      }
    }
    for (const bad of [
      {},
      { token: '' },
      { token: '   ' },
      { token: 'a'.repeat(65) },
      { token: 'a\u0000b' },
      { token: 1 },
      { token: 'a', x: 1 },
    ]) {
      assert.equal(
        (await t.publicPost('/registrations/lookup', bad)).status,
        400,
        JSON.stringify(bad),
      )
      assert.equal(
        (await t.publicPost('/registrations/cancel', bad)).status,
        400,
        JSON.stringify(bad),
      )
    }
    // 저장된 해시 자체로는 조회되지 않는다(토큰이 아니다).
    const stored = (await t.pg.query('SELECT token_hash FROM registration_link')).rows[0] as {
      token_hash: string
    }
    assert.equal((await t.lookup(stored.token_hash)).status, 404)
  }),
)

test(
  '스스로 취소는 이름·학번·휴대폰을 지금 값과 모든 판에서 비우고 링크를 지우며, 그 뒤 같은 토큰은 404이고 판의 바꾼 사람은 비어 있다',
  withRegistrations(async t => {
    const form = await split(t)
    const token = await t.applied(form.publicCode, person)
    const other = await t.applied(form.publicCode, { ...person, name: '이신청' })
    const id = (await t.pg.query(`SELECT id FROM registration WHERE name = '김신청'`)).rows[0] as {
      id: string
    }
    // 판이 둘 이상이 되게 이전 판에도 값이 있게 한다.
    await t.change('registration', id.id, { appliedFee: '5000' })
    const before = await t.versions(id.id)
    assert.equal(before, 2)
    // 다른 학생회의 신청도 하나 둔다. 취소는 이 신청의 판만 비워야 한다.
    const foreignEvent = await t.makeEvent({}, t.other)
    const foreignForm = await t.makeForm(foreignEvent, {}, t.other)
    await t.db.transaction(tx =>
      createRecord(tx, {
        kind: 'registration',
        councilId: t.other.councilId,
        actor: null,
        values: { formId: foreignForm, ...person, name: '남신청', appliedFee: '0' },
      }),
    )
    const response = await t.cancelMine(token)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { cancelled: true })
    const row = (
      await t.pg.query(
        'SELECT name, student_id, phone, cancelled_at FROM registration WHERE id = $1',
        [id.id],
      )
    ).rows[0] as Record<string, unknown>
    assert.deepEqual([row.name, row.student_id, row.phone], [null, null, null])
    assert.ok(row.cancelled_at)
    // 모든 판에서 비워졌다: 어느 판에도 김신청, 학번, 번호가 없다.
    const versions = (
      await t.pg.query(
        'SELECT version_no, data, changed_by FROM record_version WHERE record_id = $1 ORDER BY version_no',
        [id.id],
      )
    ).rows as { version_no: number; data: Record<string, unknown>; changed_by: string | null }[]
    assert.equal(versions.length, 3)
    for (const version of versions) {
      assert.deepEqual(
        [version.data.name, version.data.student_id, version.data.phone],
        [null, null, null],
      )
      assert.ok(!JSON.stringify(version.data).includes('김신청'))
    }
    // 신청자가 바꾼 판은 바꾼 사람이 비어 있고, 값 말고는 남는다.
    assert.equal(versions[2]!.changed_by, null)
    assert.ok(versions[2]!.data.cancelled_at)
    assert.equal(versions[2]!.data.applied_fee, 5000)
    assert.equal(await t.count('SELECT count(*) AS n FROM registration_link'), 1)
    for (const call of [t.lookup, t.cancelMine]) {
      const again = await call(token)
      assert.equal(again.status, 404)
    }
    // 다른 신청은 그대로다.
    assert.equal((await mineOf(t, other)).mine.name, '이신청')
    // 같은 양식의 다른 신청과 다른 학생회 신청은 판에도 값이 남아 있다.
    for (const name of ['이신청', '남신청'])
      assert.equal(
        await t.count(
          `SELECT count(*) AS n FROM record_version v WHERE v.data ->> 'name' = $1
             AND v.data ->> 'student_id' IS NOT NULL AND v.data ->> 'phone' IS NOT NULL`,
          [name],
        ),
        1,
        name,
      )
    assert.equal(await t.count(`SELECT count(*) AS n FROM registration WHERE name = '이신청'`), 1)
  }),
)

test(
  '취소하면 자리가 돌아온다. 멈춘 양식에서도 취소된다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const { form } = await t.created(event, { capacity: 1, collectsStudentId: false })
    const token = await t.applied(form.publicCode, { name: '가' })
    assert.equal((await t.apply(form.publicCode, { name: '나' })).status, 409)
    await t.post(`/registration-forms/${form.id}/pause`, {})
    assert.equal((await t.cancelMine(token)).status, 200)
    await t.post(`/registration-forms/${form.id}/resume`, {})
    assert.equal((await t.publicForm(form.publicCode)).remaining, 1)
    assert.equal((await t.apply(form.publicCode, { name: '나' })).status, 201)
  }),
)

test(
  '마감 뒤는 409 CANCEL_CLOSED, 출석 뒤는 409 CHECKED_IN이고 아무것도 바꾸지 않는다',
  withRegistrations(async t => {
    const form = await split(t)
    const first = await t.applied(form.publicCode, person)
    const second = await t.applied(form.publicCode, { ...person, name: '이신청' })
    const id = (await t.pg.query(`SELECT id FROM registration WHERE name = '김신청'`)).rows[0] as {
      id: string
    }
    await t.attend(id.id)
    const attended = await t.cancelMine(first)
    assert.equal(attended.status, 409)
    assert.equal(await errorOf(attended), 'CHECKED_IN')
    t.setNow(korean('2026-11-01T17:59:59'))
    assert.equal(await errorOf(await t.cancelMine(first)), 'CHECKED_IN')
    t.setNow(korean('2026-11-01T18:00:00'))
    const closed = await t.cancelMine(second)
    assert.equal(closed.status, 409)
    assert.equal(await errorOf(closed), 'CANCEL_CLOSED')
    assert.equal(
      await t.count('SELECT count(*) AS n FROM registration WHERE cancelled_at IS NOT NULL'),
      0,
    )
    assert.equal(await t.count(`SELECT count(*) AS n FROM registration WHERE name IS NOT NULL`), 2)
    assert.equal(await t.count('SELECT count(*) AS n FROM registration_link'), 2)
  }),
)

test(
  '공개 응답에 운영진과 내부 번호가 없다',
  withRegistrations(async t => {
    const form = await split(t)
    const token = await t.applied(form.publicCode, person)
    const text = await (await t.lookup(token)).text()
    for (const secret of [
      form.id,
      form.eventId,
      t.council.councilId,
      t.council.people.president.memberId,
      'feeAccount',
      'publicCode',
      form.publicCode,
      sha256(token).toLowerCase(),
    ])
      assert.ok(!text.includes(secret), `응답에 ${secret}이 있다`)
  }),
)
