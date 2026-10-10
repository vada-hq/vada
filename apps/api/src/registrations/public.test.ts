import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import type { EventResponse, MyRegistration, PublicRegistrationForm, RegistrationCreated, RegistrationResponse } from '@vada/contracts'
import { setupPurchases } from '../purchases/test-setup.js'

type Env = Awaited<ReturnType<typeof setupPurchases>>
async function refused(pending: Response | Promise<Response>, status: number, error: string, label = error) {
  const response = await pending
  assert.equal(response.status, status, label)
  assert.deepEqual(await response.json(), { error }, label)
}
const at = (value: string) => new Date(`${value}:00+09:00`)
const formBody = (overrides: Record<string, unknown> = {}) => ({ opensAt: null, closesAt: '2999-08-19T23:59', capacity: 2, notice: '문의: 학생회실',
  collectPhone: false, ...overrides })
const entryBody = (overrides: Record<string, unknown> = {}) => ({ name: '김바다', studentId: '2022-123456', phone: null, agreed: true, ...overrides })
// 시계는 2999년 8월 1일이다. 기획(p)이 행사 e에 일시를 넣고 참가 신청을 만든 뒤 로그인을 끊는다.
async function open(env: Env, overrides: Record<string, unknown> = {}) {
  env.clock.set(at('2999-08-01T00:00'))
  env.as('p')
  await env.ok<EventResponse>(env.request('PATCH', '/events/e', { version: 1, startsAt: '2999-08-20T10:00', endsAt: '2999-08-20T18:00', place: '체육관' }))
  const { form } = await env.ok<RegistrationResponse>(env.request('POST', '/events/e/registration', formBody(overrides)), 201)
  env.as(null)
  return form!
}
// 운영진(p)으로 설정을 바꾸고 다시 로그인을 끊는다.
async function settle(env: Env, change: Record<string, unknown>) {
  env.as('p')
  const { form } = await env.ok<RegistrationResponse>(env.request('GET', '/events/e/registration'))
  const body = { version: form!.version, accepting: form!.accepting, opensAt: form!.opensAt, closesAt: form!.closesAt, capacity: form!.capacity,
    notice: form!.notice, collectPhone: form!.collectPhone, ...change }
  await env.ok(env.request('PATCH', '/events/e/registration', body))
  env.as(null)
}
const formPath = (code: string) => `/public/registration-forms/${code}`
const apply = (env: Env, code: string, body: unknown) => env.publicRequest('POST', `${formPath(code)}/entries`, body)

test('공개 신청 화면: 학생회·행사·상태·남은 자리만 주고, 다른 신청자 정보는 주지 않는다', async () => {
  const env = await setupPurchases()
  try {
    const { code } = await open(env)
    const view = await env.ok<PublicRegistrationForm>(env.publicRequest('GET', formPath(code)))
    assert.deepEqual(view, { organizationName: 'A', event: { name: '체육대회', startsAt: '2999-08-20T10:00', endsAt: '2999-08-20T18:00', place: '체육관' },
      notice: '문의: 학생회실', collectPhone: false, state: 'open', opensAt: null, closesAt: '2999-08-19T23:59', remaining: 2, purgeAfter: '2999-09-19' })
    await env.ok(apply(env, code, entryBody()), 201)
    const after = await env.ok<PublicRegistrationForm>(env.publicRequest('GET', formPath(code)))
    assert.equal(after.remaining, 1)
    assert.equal(JSON.stringify(after).includes('김바다'), false)
    for (const missing of ['ABCD2345', code.toLowerCase(), `${code}2`, 'abc']) {
      await refused(env.publicRequest('GET', formPath(missing)), 404, 'NOT_FOUND', missing)
      await refused(apply(env, missing, entryBody({ studentId: '2022999999' })), 404, 'NOT_FOUND', missing)
    }
    // 정원이 없으면 남은 자리도 없다.
    await settle(env, { capacity: null })
    assert.equal((await env.ok<PublicRegistrationForm>(env.publicRequest('GET', formPath(code)))).remaining, null)
  } finally { await env.pg.close() }
})

test('신청: 학번을 정리해 저장하고 토큰은 해시만 남기며, 같은 학번은 하이픈·공백을 바꿔도 다시 받지 않는다', async () => {
  const env = await setupPurchases()
  const { pg } = env
  try {
    const { code } = await open(env, { capacity: null })
    const { token } = await env.ok<RegistrationCreated>(apply(env, code, entryBody()), 201)
    assert.match(token, /^[A-Za-z0-9_-]{22}$/)
    const { rows } = await pg.query<{ student_id: string; token_hash: string; name: string; phone: string | null }>('SELECT * FROM registrations')
    assert.deepEqual(rows.map(row => [row.student_id, row.name, row.phone, row.token_hash]),
      [['2022123456', '김바다', null, createHash('sha256').update(token).digest('hex')]])
    for (const studentId of [' 2022 123456 ', '2022123456', '20-22-12-34-56']) {
      await refused(apply(env, code, entryBody({ studentId, name: '다른 이름' })), 409, 'ALREADY_REGISTERED', studentId)
    }
    // 동의하지 않았거나 형식이 틀리면 400이다.
    for (const body of [entryBody({ agreed: false }), entryBody({ studentId: '12345' }), { ...entryBody(), agreed: undefined }, entryBody({ extra: 1 })]) {
      await refused(apply(env, code, body), 400, 'INVALID_INPUT', JSON.stringify(body))
    }
  } finally { await env.pg.close() }
})

test('휴대폰 번호: 받는 신청에는 꼭 넣고, 받지 않는 신청에는 넣을 수 없다', async () => {
  const env = await setupPurchases()
  const { pg } = env
  try {
    const { code } = await open(env, { capacity: null })
    await refused(apply(env, code, entryBody({ phone: '010-1234-5678' })), 400, 'INVALID_INPUT')
    await settle(env, { collectPhone: true })
    await refused(apply(env, code, entryBody({ phone: null })), 400, 'INVALID_INPUT')
    await env.ok(apply(env, code, entryBody({ phone: '010-1234-5678' })), 201)
    const { rows } = await pg.query<{ phone: string }>('SELECT phone FROM registrations')
    assert.deepEqual(rows.map(row => row.phone), ['01012345678'])
  } finally { await env.pg.close() }
})

test('정원: 한 자리 남았을 때 두 건이 함께 오면 하나만 받는다', async () => {
  const env = await setupPurchases()
  const { pg } = env
  try {
    const { code } = await open(env, { capacity: 2 })
    await env.ok(apply(env, code, entryBody({ studentId: '2022000001' })), 201)
    const responses = await Promise.all(['2022000002', '2022000003'].map(studentId => apply(env, code, entryBody({ studentId }))))
    assert.deepEqual(responses.map(response => response.status).sort(), [201, 409])
    assert.deepEqual(await responses.find(response => response.status === 409)!.json(), { error: 'REGISTRATION_FULL' })
    const { rows } = await pg.query<{ count: number }>('SELECT count(*)::int AS count FROM registrations WHERE purged_at IS NULL')
    assert.equal(rows[0]!.count, 2)
    assert.equal((await env.ok<PublicRegistrationForm>(env.publicRequest('GET', formPath(code)))).state, 'full')
    // 이미 신청한 사람이 다시 보내면 정원보다 이미 신청했다는 것을 먼저 알린다.
    await refused(apply(env, code, entryBody({ studentId: '2022000001' })), 409, 'ALREADY_REGISTERED')
  } finally { await env.pg.close() }
})

test('상태: 마감 시각 정각, 멈춤, 시작 전에는 받지 않고 시작 시각 정각부터 받는다', async () => {
  const env = await setupPurchases()
  try {
    const { code } = await open(env, { capacity: null })
    const stateOf = async () => (await env.ok<PublicRegistrationForm>(env.publicRequest('GET', formPath(code)))).state
    env.clock.set(at('2999-08-19T23:59'))
    assert.equal(await stateOf(), 'closed')
    await refused(apply(env, code, entryBody()), 409, 'REGISTRATION_NOT_OPEN', 'closed')
    env.clock.set(at('2999-08-01T00:00'))
    await settle(env, { accepting: false })
    assert.equal(await stateOf(), 'paused')
    await refused(apply(env, code, entryBody()), 409, 'REGISTRATION_NOT_OPEN', 'paused')
    await settle(env, { accepting: true, opensAt: '2999-08-05T10:00' })
    assert.equal(await stateOf(), 'upcoming')
    await refused(apply(env, code, entryBody()), 409, 'REGISTRATION_NOT_OPEN', 'upcoming')
    env.clock.set(at('2999-08-05T10:00'))
    assert.equal(await stateOf(), 'open')
    await env.ok(apply(env, code, entryBody()), 201)
  } finally { await env.pg.close() }
})

test('내 신청: 토큰으로 보고, 마감 전에는 멈춤이어도 스스로 취소하며, 취소한 뒤에는 찾을 수 없다', async () => {
  const env = await setupPurchases()
  try {
    const { code } = await open(env, { capacity: null })
    const lookup = (token: string) => env.publicRequest('POST', '/public/registrations/lookup', { token })
    const cancel = (token: string) => env.publicRequest('POST', '/public/registrations/cancel', { token })
    const { token } = await env.ok<RegistrationCreated>(apply(env, code, entryBody()), 201)
    const mine = await env.ok<MyRegistration>(lookup(token))
    assert.match(mine.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    assert.deepEqual({ ...mine, createdAt: '' }, { code, organizationName: 'A', event: { name: '체육대회', startsAt: '2999-08-20T10:00',
      endsAt: '2999-08-20T18:00', place: '체육관' }, name: '김바다', studentId: '2022123456', phone: null, createdAt: '', cancelled: false, cancellable: true })
    await refused(lookup('A'.repeat(22)), 404, 'NOT_FOUND')
    for (const bad of ['A'.repeat(21), `${'A'.repeat(20)}+/`]) await refused(lookup(bad), 400, 'INVALID_INPUT', bad)
    await settle(env, { accepting: false })
    const cancelled = await env.ok<MyRegistration>(cancel(token))
    assert.deepEqual([cancelled.cancelled, cancelled.cancellable, cancelled.name, cancelled.studentId, cancelled.phone], [true, false, null, null, null])
    await refused(lookup(token), 404, 'NOT_FOUND')
    await refused(cancel(token), 404, 'NOT_FOUND')
    // 취소하면 같은 학번으로 다시 신청할 수 있다.
    await settle(env, { accepting: true })
    const again = await env.ok<RegistrationCreated>(apply(env, code, entryBody()), 201)
    // 마감 뒤에는 스스로 취소하지 못하고, 보기는 된다.
    env.clock.set(at('2999-08-19T23:59'))
    await refused(cancel(again.token), 409, 'CANCEL_CLOSED')
    assert.equal((await env.ok<MyRegistration>(lookup(again.token))).cancellable, false)
    env.as('p')
    const staff = await env.ok<RegistrationResponse>(env.request('GET', '/events/e/registration'))
    assert.deepEqual([staff.form!.count, staff.registrations.length], [1, 1])
  } finally { await env.pg.close() }
})

test('보관 기간이 지난 신청은 토큰으로도 찾을 수 없다', async () => {
  const env = await setupPurchases()
  try {
    const { code } = await open(env, { capacity: null })
    const { token } = await env.ok<RegistrationCreated>(apply(env, code, entryBody()), 201)
    await env.pg.exec("UPDATE events SET starts_at = '2023-12-31T10:00+09', ends_at = '2024-01-01T10:00+09' WHERE id = 'e'")
    await refused(env.publicRequest('POST', '/public/registrations/lookup', { token }), 404, 'NOT_FOUND')
    await refused(env.publicRequest('POST', '/public/registrations/cancel', { token }), 404, 'NOT_FOUND')
  } finally { await env.pg.close() }
})
