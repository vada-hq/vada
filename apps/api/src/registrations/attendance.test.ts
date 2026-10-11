import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkInCodeOf, checkInQrText, type CheckInScanResponse, type MyRegistration, type RegistrationResponse } from '@vada/contracts'
import { setupPurchases } from '../purchases/test-setup.js'
import { apply, checkIn, codeOf, create, entries, type Env, formBody, named, prepare, refused, registrationBase as base, scan, uncheck } from './test-setup.js'

const korean = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
const lookup = (env: Env, token: string) => env.ok<MyRegistration>(env.publicRequest('POST', '/public/registrations/lookup', { token }))
const cancelMine = (env: Env, token: string) => env.publicRequest('POST', '/public/registrations/cancel', { token })
const cancelEntry = (env: Env, id: string) => env.request('POST', `${base}/entries/${id}/cancel`, {})
const attendance = async (env: Env) => (await env.pg.query<{ checked_in_at: Date | null; checked_in_by: string | null }>(
  'SELECT checked_in_at, checked_in_by FROM registrations ORDER BY created_at, id')).rows

test('QR로 참석 확인: 찍으면 바로 참석으로 남기고, 이미 참석이면 바꾸지 않고 알린다', async () => {
  const env = await setupPurchases()
  try {
    await prepare(env)
    const { form } = await create(env, { fee: 5000 })
    await apply(env, form!.code, '김바다', '2022000001')
    const token = await apply(env, form!.code, '박참여', '2023000004')
    const first = await env.ok<CheckInScanResponse>(scan(env, { code: codeOf(token) }))
    const park = named(first.registrations, '박참여')
    assert.deepEqual(first.checkIn, { registrationId: park.id, already: false })
    assert.equal(first.form!.checkedIn, 1)
    assert.deepEqual(park.checkedIn?.by, { id: 'p', name: '기획' })
    assert.match(park.checkedIn!.at, korean)
    // 입금 전이어도 막지 않는다.
    assert.equal(park.paid, null)
    assert.equal(named(first.registrations, '김바다').checkedIn, null)
    // 다른 운영진이 같은 QR을 다시 찍어도 처음 확인이 그대로다.
    env.as('q')
    const again = await env.ok<CheckInScanResponse>(scan(env, { code: codeOf(token) }))
    assert.deepEqual(again.checkIn, { registrationId: park.id, already: true })
    assert.deepEqual([again.form!.checkedIn, named(again.registrations, '박참여').checkedIn], [1, park.checkedIn])
  } finally { await env.pg.close() }
})

test('QR로 참석 확인: 모르는 코드, 취소한 신청, 다른 행사·다른 학생회의 신청은 찾을 수 없다', async () => {
  const env = await setupPurchases()
  try {
    await prepare(env)
    const { form } = await create(env)
    const token = await apply(env, form!.code, '김바다', '2022000001')
    const cancelled = await apply(env, form!.code, '박참여', '2023000004')
    await env.ok(cancelEntry(env, named(await entries(env), '박참여').id))
    await refused(scan(env, { code: 'f'.repeat(64) }), 404, 'NOT_FOUND')
    await refused(scan(env, { code: codeOf(cancelled) }), 404, 'NOT_FOUND')
    // 같은 학생회의 다른 행사(e2) 신청은 e에서, e의 신청은 e2에서 찾을 수 없다.
    await env.ok(env.request('PATCH', '/events/e2', { version: 1, startsAt: '2999-08-20T10:00', endsAt: null, place: null, ownerDepartmentId: null, ownerMembershipId: null }))
    const other = await env.ok<RegistrationResponse>(env.request('POST', '/events/e2/registration', formBody({ closesAt: '2999-08-20T10:00' })), 201)
    const otherToken = await apply(env, other.form!.code, '이윤슬', '2023000003')
    await refused(scan(env, { code: codeOf(otherToken) }), 404, 'NOT_FOUND')
    await refused(env.request('POST', '/events/e2/registration/check-in', { code: codeOf(token) }), 404, 'NOT_FOUND')
    // 다른 학생회의 운영진은 자기 행사(ex)에 참가 신청을 열어도 e의 신청을 찾지 못한다.
    env.as('x')
    const theirs = (method: string, path: string, body?: unknown) => env.publicRequest(method, `/organizations/b${path}`, body)
    await env.ok(theirs('PATCH', '/events/ex', { version: 1, startsAt: '2999-08-20T10:00', endsAt: null, place: null, ownerDepartmentId: null, ownerMembershipId: null }))
    await env.ok(theirs('POST', '/events/ex/registration', formBody({ closesAt: '2999-08-20T10:00' })), 201)
    await refused(theirs('POST', '/events/ex/registration/check-in', { code: codeOf(token) }), 404, 'NOT_FOUND')
    assert.deepEqual((await attendance(env)).map(row => row.checked_in_at), [null, null, null])
  } finally { await env.pg.close() }
})

test('이름으로 참석 확인과 확인 취소: 상태를 지키고, 취소한 신청은 찾을 수 없다', async () => {
  const env = await setupPurchases()
  try {
    await prepare(env)
    const { form } = await create(env)
    await apply(env, form!.code, '김바다', '2022000001')
    await apply(env, form!.code, '박참여', '2023000004')
    const list = await entries(env)
    const kim = named(list, '김바다')
    const checked = await env.ok<RegistrationResponse>(checkIn(env, kim.id))
    assert.deepEqual([checked.form!.checkedIn, named(checked.registrations, '김바다').checkedIn?.by.id], [1, 'p'])
    await refused(checkIn(env, kim.id), 409, 'CHECKED_IN')
    const undone = await env.ok<RegistrationResponse>(uncheck(env, kim.id))
    assert.deepEqual([undone.form!.checkedIn, named(undone.registrations, '김바다').checkedIn], [0, null])
    await refused(uncheck(env, kim.id), 409, 'NOT_CHECKED_IN')
    assert.deepEqual((await attendance(env)).map(row => [row.checked_in_at, row.checked_in_by]), [[null, null], [null, null]])
    const park = named(list, '박참여')
    await env.ok(cancelEntry(env, park.id))
    await refused(checkIn(env, park.id), 404, 'NOT_FOUND')
    await refused(uncheck(env, park.id), 404, 'NOT_FOUND')
    await refused(checkIn(env, 'missing'), 404, 'NOT_FOUND')
  } finally { await env.pg.close() }
})

test('정산한 행사도 참석은 확인하고 취소한다', async () => {
  const env = await setupPurchases()
  try {
    await prepare(env)
    const { form } = await create(env)
    const token = await apply(env, form!.code, '김바다', '2022000001')
    env.as('f')
    await env.ok(env.request('POST', '/events/e/finance/settle', { version: 0, feeIncomeLineId: null }))
    env.as('p')
    const scanned = await env.ok<CheckInScanResponse>(scan(env, { code: codeOf(token) }))
    assert.deepEqual([scanned.settled, scanned.checkIn.already, scanned.form!.checkedIn], [true, false, 1])
    const id = scanned.checkIn.registrationId
    await env.ok(uncheck(env, id))
    assert.equal((await env.ok<RegistrationResponse>(checkIn(env, id))).form!.checkedIn, 1)
  } finally { await env.pg.close() }
})

test('참석을 확인한 신청은 운영진도 학생도 취소하지 못하고, 확인을 취소하면 다시 취소할 수 있다', async () => {
  const env = await setupPurchases()
  try {
    await prepare(env)
    const { form } = await create(env)
    const token = await apply(env, form!.code, '김바다', '2022000001')
    const { checkIn: { registrationId: id } } = await env.ok<CheckInScanResponse>(scan(env, { code: codeOf(token) }))
    await refused(cancelEntry(env, id), 409, 'CHECKED_IN')
    await refused(cancelMine(env, token), 409, 'CHECKED_IN')
    const mine = await lookup(env, token)
    assert.equal(mine.cancellable, false)
    assert.match(mine.checkedInAt!, korean)
    await env.ok(uncheck(env, id))
    const reopened = await lookup(env, token)
    assert.deepEqual([reopened.cancellable, reopened.checkedInAt], [true, null])
    const cancelled = await env.ok<MyRegistration>(cancelMine(env, token))
    assert.deepEqual([cancelled.cancelled, cancelled.checkInCode, cancelled.checkedInAt], [true, null, null])
  } finally { await env.pg.close() }
})

test('보관 기간이 지나 개인 칸을 지워도 참석 수는 남고, 그 QR은 찾을 수 없다', async () => {
  const env = await setupPurchases()
  try {
    await prepare(env)
    const { form } = await create(env)
    const token = await apply(env, form!.code, '김바다', '2022000001')
    await env.ok(scan(env, { code: codeOf(token) }))
    await env.pg.query("UPDATE events SET starts_at = '2024-01-01T10:00+09', ends_at = '2024-01-01T18:00+09' WHERE id = 'e'")
    const purged = await env.ok<RegistrationResponse>(env.request('GET', base))
    assert.deepEqual([purged.form!.purged, purged.registrations.length, purged.form!.checkedIn], [true, 0, 1])
    await refused(scan(env, { code: codeOf(token) }), 404, 'NOT_FOUND')
    assert.deepEqual((await attendance(env)).map(row => [row.checked_in_at instanceof Date, row.checked_in_by]), [[true, 'p']])
  } finally { await env.pg.close() }
})

test('내 신청: 참석 확인 코드는 토큰의 SHA-256이고 QR 글자로 오가며, 확인 전에는 참석 시각이 없다', async () => {
  const env = await setupPurchases()
  try {
    await prepare(env)
    const { form } = await create(env)
    const token = await apply(env, form!.code, '김바다', '2022000001')
    const mine = await lookup(env, token)
    assert.equal(mine.checkInCode, codeOf(token))
    assert.equal(checkInCodeOf(checkInQrText(mine.checkInCode!)), mine.checkInCode)
    assert.deepEqual([mine.checkedInAt, mine.cancellable], [null, true])
  } finally { await env.pg.close() }
})

test('참석 확인 권한과 본문: 미배정·다른 학생회는 403, 미인증은 401, 틀린 본문은 인증 전에 400이다', async () => {
  const env = await setupPurchases()
  try {
    await prepare(env)
    const { form } = await create(env)
    const token = await apply(env, form!.code, '김바다', '2022000001')
    const id = named(await entries(env), '김바다').id
    const code = codeOf(token)
    for (const user of ['n', 'x']) {
      env.as(user)
      await refused(scan(env, { code }), 403, 'FORBIDDEN', user)
      await refused(checkIn(env, id), 403, 'FORBIDDEN', user)
      await refused(uncheck(env, id), 403, 'FORBIDDEN', user)
    }
    env.as(null)
    assert.equal((await scan(env, { code })).status, 401)
    assert.equal((await checkIn(env, id)).status, 401)
    assert.equal((await uncheck(env, id)).status, 401)
    // 테스트 파일에 제어 문자를 그대로 쓰지 않는다.
    const nul = String.fromCharCode(0)
    const lone = String.fromCharCode(0xd800)
    for (const body of [{}, { code: '' }, { code: '   ' }, { code: code.slice(1) }, { code: `${code}0` }, { code: code.toUpperCase() },
      { code: `${code.slice(2)}😀` }, { code: `${code.slice(1)}${nul}` }, { code: `${code.slice(1)}${lone}` }, { code, extra: 1 }]) {
      await refused(scan(env, body), 400, 'INVALID_INPUT', JSON.stringify(body))
    }
    for (const body of [{ extra: 1 }, { code }]) {
      await refused(checkIn(env, id, body), 400, 'INVALID_INPUT', JSON.stringify(body))
      await refused(uncheck(env, id, body), 400, 'INVALID_INPUT', JSON.stringify(body))
    }
    assert.deepEqual((await attendance(env)).map(row => row.checked_in_at), [null])
  } finally { await env.pg.close() }
})
