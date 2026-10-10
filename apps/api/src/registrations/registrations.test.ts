import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { EventResponse, RegistrationResponse } from '@vada/contracts'
import { setupPurchases } from '../purchases/test-setup.js'

type Env = Awaited<ReturnType<typeof setupPurchases>>
const base = '/events/e/registration'
async function refused(pending: Response | Promise<Response>, status: number, error: string, label = error) {
  const response = await pending
  assert.equal(response.status, status, label)
  assert.deepEqual(await response.json(), { error }, label)
}
const formBody = (overrides: Record<string, unknown> = {}) => ({ opensAt: null, closesAt: '2999-08-19T23:59', capacity: 2, notice: '문의: 학생회실',
  collectPhone: false, fee: 0, memberFee: null, ...overrides })
const korean = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
// 시계는 2999년 8월 1일이고, 기획(p)이 행사 e에 2999년 8월 20일 10~18시를 넣는다.
async function prepare(env: Env) {
  env.clock.set(new Date('2999-08-01T00:00+09:00'))
  env.as('p')
  await env.ok<EventResponse>(env.request('PATCH', '/events/e', { version: 1, startsAt: '2999-08-20T10:00', endsAt: '2999-08-20T18:00', place: '체육관' }))
}
const create = (env: Env, overrides: Record<string, unknown> = {}) =>
  env.ok<RegistrationResponse>(env.request('POST', base, formBody(overrides)), 201)
// 공개 신청 경로 없이 신청을 넣는다. 신청 순서는 created_at으로 정한다.
async function register(env: Env, formId: string, n: number, phone: string | null = null) {
  await env.pg.query(`INSERT INTO registrations (id,organization_id,form_id,token_hash,name,student_id,phone,created_at)
    VALUES ($1,'a',$2,$3,$4,$5,$6,'2999-07-01T00:00Z'::timestamptz + make_interval(mins => $7))`,
  [`r${n}`, formId, n.toString(16).padStart(64, '0'), `신청자${n}`, String(2022000000 + n), phone, n])
}

test('참가 신청 만들기: 부서가 있는 구성원이 행사마다 하나 만들고, 행사 시작과 마감 조건을 지킨다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok } = env
  try {
    await prepare(env)
    assert.deepEqual(await ok<RegistrationResponse>(request('GET', base)), { form: null, registrations: [], account: null, roster: null, settled: false })
    const { form, registrations } = await create(env)
    assert.match(form!.code, /^[2-9A-HJ-NP-Z]{8}$/)
    assert.deepEqual({ ...form!, id: '', code: '', updatedAt: '' }, { id: '', code: '', accepting: true, opensAt: null, closesAt: '2999-08-19T23:59',
      capacity: 2, notice: '문의: 학생회실', collectPhone: false, version: 1, state: 'open', count: 0, purgeAfter: '2999-09-19', purged: false, updatedAt: '',
      fee: 0, memberFee: null, payments: { count: 0, total: 0 } })
    assert.deepEqual(registrations, [])
    await refused(request('POST', base, formBody()), 409, 'REGISTRATION_EXISTS')
    // 행사 시작이 없으면 만들 수 없고, 마감은 행사 끝(끝이 없으면 시작)보다 늦을 수 없다.
    await refused(request('POST', '/events/e2/registration', formBody()), 409, 'EVENT_TIME_REQUIRED')
    await ok(request('PATCH', '/events/e2', { version: 1, startsAt: '2999-08-20T10:00', endsAt: null, place: null }))
    await refused(request('POST', '/events/e2/registration', formBody({ closesAt: '2999-08-20T10:01' })), 409, 'DEADLINE_AFTER_EVENT')
    const sameMinute = await ok<RegistrationResponse>(request('POST', '/events/e2/registration', formBody({ closesAt: '2999-08-20T10:00' })), 201)
    assert.equal(sameMinute.form!.purgeAfter, '2999-09-19')
    // 다른 학생회의 행사와 없는 행사는 찾을 수 없다.
    for (const event of ['ex', 'missing']) {
      await refused(request('GET', `/events/${event}/registration`), 404, 'NOT_FOUND', event)
      await refused(request('POST', `/events/${event}/registration`, formBody()), 404, 'NOT_FOUND', event)
    }
    const { rows } = await pg.query<{ count: number }>('SELECT count(*)::int AS count FROM registration_forms')
    assert.equal(rows[0]!.count, 2)
  } finally { await env.pg.close() }
})

test('참가 신청 권한: 미배정·다른 학생회·미인증은 막고, 재정과 회장단은 쓴다', async () => {
  const env = await setupPurchases()
  const { request, ok, as } = env
  try {
    await prepare(env)
    const { form } = await create(env)
    await register(env, form!.id, 1)
    const update = { version: 1, accepting: true, ...formBody() }
    for (const user of ['n', 'x']) {
      as(user)
      await refused(request('GET', base), 403, 'FORBIDDEN', user)
      await refused(request('POST', base, formBody()), 403, 'FORBIDDEN', user)
      await refused(request('PATCH', base, update), 403, 'FORBIDDEN', user)
      await refused(request('POST', `${base}/entries/r1/cancel`, {}), 403, 'FORBIDDEN', user)
    }
    as(null)
    assert.equal((await request('GET', base)).status, 401)
    assert.equal((await request('PATCH', base, update)).status, 401)
    assert.equal((await request('POST', `${base}/entries/r1/cancel`, {})).status, 401)
    for (const user of ['f', 'l', 'q']) {
      as(user)
      assert.equal((await ok<RegistrationResponse>(request('GET', base))).registrations.length, 1, user)
    }
  } finally { await env.pg.close() }
})

test('참가 신청 본문이 틀리면 인증 전에 400으로 거절한다', async () => {
  const env = await setupPurchases()
  const { request } = env
  try {
    env.as(null)
    const nul = String.fromCharCode(0)
    const lone = String.fromCharCode(0xd800)
    const update = { version: 1, accepting: true, ...formBody() }
    const bodies = [{ ...formBody(), closesAt: undefined }, formBody({ notice: '   ' }), formBody({ notice: '😀'.repeat(1001) }),
      formBody({ notice: `안내${nul}` }), formBody({ notice: `안내${lone}` }), formBody({ capacity: 5001 }), formBody({ capacity: 0 }),
      formBody({ opensAt: '2999-08-19T23:59' }), formBody({ closesAt: '2999-02-30T10:00' }), { ...formBody(), collectPhone: undefined },
      formBody({ extra: 1 })]
    for (const body of bodies) await refused(request('POST', base, body), 400, 'INVALID_INPUT', JSON.stringify(body).slice(0, 80))
    for (const body of [formBody(), { ...update, version: undefined }, { ...update, accepting: undefined }, { ...update, version: 0 }]) {
      await refused(request('PATCH', base, body), 400, 'INVALID_INPUT', JSON.stringify(body).slice(0, 80))
    }
    await refused(request('POST', `${base}/entries/r1/cancel`, { reason: '중복' }), 400, 'INVALID_INPUT')
  } finally { await env.pg.close() }
})

test('참가 신청 수정: 멈추고 비우고 버전을 지키며, 휴대폰 받기를 끄면 받은 번호를 지운다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok } = env
  try {
    await prepare(env)
    const { form } = await create(env, { collectPhone: true, capacity: 10 })
    await register(env, form!.id, 1, '01012345678')
    await register(env, form!.id, 2, '01087654321')
    const paused = await ok<RegistrationResponse>(request('PATCH', base, { version: 1, accepting: false, ...formBody({ collectPhone: true, capacity: 10 }) }))
    assert.deepEqual([paused.form!.state, paused.form!.accepting, paused.form!.version], ['paused', false, 2])
    assert.deepEqual(paused.registrations.map(entry => entry.phone), ['01012345678', '01087654321'])
    await refused(request('PATCH', base, { version: 1, accepting: true, ...formBody() }), 409, 'VERSION_CONFLICT')
    await refused(request('PATCH', base, { version: 2, accepting: true, ...formBody({ closesAt: '2999-08-20T18:01' }) }), 409, 'DEADLINE_AFTER_EVENT')
    const cleared = await ok<RegistrationResponse>(request('PATCH', base, { version: 2, accepting: true, ...formBody({ capacity: null, notice: null,
      opensAt: '2999-07-15T10:00', collectPhone: false }) }))
    assert.deepEqual([cleared.form!.state, cleared.form!.capacity, cleared.form!.notice, cleared.form!.opensAt, cleared.form!.collectPhone],
      ['open', null, null, '2999-07-15T10:00', false])
    assert.deepEqual(cleared.registrations.map(entry => entry.phone), [null, null])
    const { rows } = await pg.query<{ count: number }>('SELECT count(*)::int AS count FROM registrations WHERE phone IS NOT NULL')
    assert.equal(rows[0]!.count, 0)
    // 없는 참가 신청은 고칠 수 없다.
    await refused(request('PATCH', '/events/e2/registration', { version: 1, accepting: true, ...formBody() }), 404, 'NOT_FOUND')
  } finally { await env.pg.close() }
})

test('정원 줄이기: 들어온 신청은 그대로 두고 정원 참이 되며, 한 명이 취소해도 정원 이상이면 그대로다', async () => {
  const env = await setupPurchases()
  const { request, ok } = env
  try {
    await prepare(env)
    const { form } = await create(env, { capacity: 5 })
    for (const n of [1, 2]) await register(env, form!.id, n)
    const reduced = await ok<RegistrationResponse>(request('PATCH', base, { version: 1, accepting: true, ...formBody({ capacity: 1 }) }))
    assert.deepEqual([reduced.form!.state, reduced.form!.count, reduced.registrations.length], ['full', 2, 2])
    const cancelled = await ok<RegistrationResponse>(request('POST', `${base}/entries/r1/cancel`, {}))
    assert.deepEqual([cancelled.form!.state, cancelled.form!.count, cancelled.registrations.map(entry => entry.id)], ['full', 1, ['r2']])
  } finally { await env.pg.close() }
})

test('운영진 취소: 그 사람의 정보를 바로 지우고 신청 수에서 빼며, 명단은 신청 순서다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok } = env
  try {
    await prepare(env)
    const { form } = await create(env, { capacity: null })
    for (const n of [3, 1, 2]) await register(env, form!.id, n)
    const listed = await ok<RegistrationResponse>(request('GET', base))
    assert.deepEqual(listed.registrations.map(entry => entry.id), ['r1', 'r2', 'r3'])
    assert.deepEqual({ ...listed.registrations[0]!, createdAt: '' }, { id: 'r1', name: '신청자1', studentId: '2022000001', phone: null, createdAt: '',
      duesMember: null, fee: 0, paid: null })
    assert.match(listed.registrations[0]!.createdAt, korean)
    assert.equal(listed.form!.count, 3)
    const after = await ok<RegistrationResponse>(request('POST', `${base}/entries/r2/cancel`, {}))
    assert.deepEqual([after.form!.count, after.registrations.map(entry => entry.id)], [2, ['r1', 'r3']])
    const { rows } = await pg.query<{ token_hash: string | null; name: string | null; student_id: string | null; cancelled_by: string | null;
      cancelled_at: Date | null; purged_at: Date | null }>("SELECT * FROM registrations WHERE id = 'r2'")
    assert.deepEqual([rows[0]!.token_hash, rows[0]!.name, rows[0]!.student_id, rows[0]!.cancelled_by], [null, null, null, 'p'])
    assert.ok(rows[0]!.cancelled_at && rows[0]!.purged_at)
    await refused(request('POST', `${base}/entries/r2/cancel`, {}), 404, 'NOT_FOUND')
    await refused(request('POST', `${base}/entries/missing/cancel`, {}), 404, 'NOT_FOUND')
    // 다른 행사의 신청은 이 경로로 취소할 수 없다.
    await ok(request('PATCH', '/events/e2', { version: 1, startsAt: '2999-08-20T10:00', endsAt: null, place: null }))
    const other = await ok<RegistrationResponse>(request('POST', '/events/e2/registration', formBody({ closesAt: '2999-08-20T10:00' })), 201)
    await register(env, other.form!.id, 9)
    await refused(request('POST', `${base}/entries/r9/cancel`, {}), 404, 'NOT_FOUND')
  } finally { await env.pg.close() }
})

test('보관 기간이 지난 신청은 읽기 전에 지우고, 신청 수만 남긴다', async () => {
  const env = await setupPurchases()
  const { pg, request, ok } = env
  try {
    await prepare(env)
    const { form } = await create(env)
    await register(env, form!.id, 1, null)
    await pg.exec("UPDATE events SET starts_at = '2023-12-31T10:00+09', ends_at = '2024-01-01T10:00+09' WHERE id = 'e'")
    const { form: purgedForm, registrations } = await ok<RegistrationResponse>(request('GET', base))
    assert.deepEqual([purgedForm!.purged, purgedForm!.count, purgedForm!.purgeAfter, registrations], [true, 1, '2024-01-31', []])
    const { rows } = await pg.query<{ name: string | null }>("SELECT name FROM registrations WHERE id = 'r1'")
    assert.equal(rows[0]!.name, null)
  } finally { await env.pg.close() }
})
