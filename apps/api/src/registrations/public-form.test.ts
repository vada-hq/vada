import assert from 'node:assert/strict'
import { test } from 'node:test'
import { korean, withRegistrations } from '../test-support/registrations.js'

test(
  '초안의 공개 링크는 읽어도 새 신청을 받지 않고 신청·개인 링크·영수증이 남지 않는다',
  withRegistrations(async t => {
    const { form } = await t.created(await t.makeEvent())
    assert.equal((await t.publicForm(form.publicCode)).status, 'paused')
    const response = await t.apply(form.publicCode, { name: '김학생', studentId: '202612345' })
    assert.equal(response.status, 409)
    assert.deepEqual(await response.json(), { error: 'REGISTRATION_NOT_OPEN' })
    assert.equal(await t.count('SELECT count(*) AS n FROM registration'), 0)
    assert.equal(await t.count('SELECT count(*) AS n FROM registration_link'), 0)
    assert.equal(await t.count('SELECT count(*) AS n FROM command_receipt'), 0)
    assert.equal(await t.versions(form.id), 1)
  }),
)

test(
  '로그인 없이 공개 코드로 읽고, 응답은 정해진 칸만 담으며 no-store이다',
  withRegistrations(async t => {
    const event = await t.makeEvent({
      name: '가을 축제',
      place: '대운동장',
      startsAt: korean('2026-11-05T14:00'),
      endsAt: korean('2026-11-05T18:00'),
    })
    const account = await t.makeAccount()
    const { form } = await t.activeForm(event, {
      opensAt: '2026-10-26T09:00',
      capacity: 10,
      notice: '문의는 카톡 @학생회',
      collectsPhone: true,
      payerFee: 0,
      nonPayerFee: 5000,
      feeAccountId: account,
    })
    t.setNow(korean('2026-10-27T10:00'))
    await t.makeRegistration(form.id, {
      name: '김신청',
      studentId: '202612345',
      phone: '01012345678',
    })
    const { response, text } = await t.publicRead(form.publicCode)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(JSON.parse(text), {
      councilName: 's 학생회',
      event: {
        name: '가을 축제',
        startsAt: '2026-11-05T14:00',
        endsAt: '2026-11-05T18:00',
        place: '대운동장',
      },
      form: {
        name: form.name,
        opensAt: '2026-10-26T09:00',
        closesAt: '2026-11-01T18:00',
        notice: '문의는 카톡 @학생회',
      },
      status: 'open',
      remaining: 9,
      payerFee: 0,
      nonPayerFee: 5000,
      collectsStudentId: true,
      collectsPhone: true,
      purgeOn: '2027-11-05',
    })
    // 계좌, 신청자, 운영진, 내부 번호는 어느 곳에도 없다.
    const secrets = [
      '123-45-6789012',
      '한양대 학생회',
      '국민은행',
      '김신청',
      '202612345',
      '01012345678',
      form.id,
      event,
      account,
      t.council.councilId,
      t.council.people.president.memberId,
      'financeMember',
      'feeAccount',
      'publicCode',
    ]
    for (const secret of secrets) assert.ok(!text.includes(secret), `응답에 ${secret}이 있다`)
  }),
)

test(
  '모르는 코드와 형식이 틀린 코드는 가르지 않고 404이며 이것도 no-store이다. 소문자로 옮겨 적어도 읽힌다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const { form } = await t.activeForm(event)
    for (const code of [
      'AAAAAAAA',
      'short',
      '1111111O',
      'a'.repeat(100),
      'AAAAAAA%20',
      '..%2F..',
    ]) {
      const { response, text } = await t.publicRead(code)
      assert.equal(response.status, 404, code)
      assert.equal(text, JSON.stringify({ error: 'NOT_FOUND' }), code)
      assert.equal(response.headers.get('cache-control'), 'no-store', code)
    }
    assert.equal((await t.publicRead(form.publicCode.toLowerCase())).response.status, 200)
  }),
)

test(
  '상태와 남은 자리는 읽을 때마다 센다: 멈춤, 마감, 정원 참, 취소한 신청은 세지 않는다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const { form } = await t.activeForm(event, { capacity: 2 })
    const read = () => t.publicForm(form.publicCode)
    assert.deepEqual([(await read()).status, (await read()).remaining], ['open', 2])
    const first = await t.makeRegistration(form.id)
    await t.makeRegistration(form.id)
    assert.deepEqual([(await read()).status, (await read()).remaining], ['full', 0])
    await t.change('registration', first, { cancelledAt: new Date() })
    assert.deepEqual([(await read()).status, (await read()).remaining], ['open', 1])
    await t.post(`/registration-forms/${form.id}/pause`, {})
    assert.equal((await read()).status, 'paused')
    t.setNow(korean('2026-11-01T18:00:00'))
    assert.equal((await read()).status, 'closed')
  }),
)

test(
  '학번 받기는 양식의 칸 그대로다: 빼면 받고 끄면 받지 않으며, 두 참가비는 null이거나 그 값이다(DEC-75)',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const account = await t.makeAccount()
    const read = async (body: Record<string, unknown>) =>
      t.publicForm((await t.activeForm(event, body)).form.publicCode)
    const none = await read({})
    assert.deepEqual(
      [none.collectsStudentId, none.payerFee, none.nonPayerFee, none.collectsPhone],
      [true, null, null, false],
    )
    const off = await read({ collectsStudentId: false })
    assert.equal(off.collectsStudentId, false)
    const same = await read({
      payerFee: 3000,
      nonPayerFee: 3000,
      feeAccountId: account,
      collectsStudentId: false,
    })
    assert.deepEqual([same.collectsStudentId, same.payerFee, same.nonPayerFee], [false, 3000, 3000])
    const free = await read({ payerFee: 0, nonPayerFee: 0 })
    assert.equal(free.collectsStudentId, true)
    const differ = await read({ payerFee: 0, nonPayerFee: 3000, feeAccountId: account })
    assert.equal(differ.collectsStudentId, true)
  }),
)

test(
  '공개 경로는 읽기만 한다: 같은 주소로 쓰려 하면 거절되고 양식은 그대로다',
  withRegistrations(async t => {
    const event = await t.makeEvent()
    const { form } = await t.activeForm(event)
    const response = await t.api.post(`/api/public/registration-forms/${form.publicCode}`, {})
    assert.notEqual(response.status, 200)
    assert.equal(await t.versions(form.id), 1)
  }),
)
