import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BudgetPlanResponse, MyRegistration, PublicRegistrationForm, RegistrationResponse } from '@vada/contracts'
import { setupPurchases } from '../purchases/test-setup.js'
import { account, apply, at, confirm, create, entries, type Env, formBody, named, prepare, refused, registrationBase as base, roster, switchDues,
  unconfirm, update } from './test-setup.js'

const korean = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

test('참가비 설정: 계좌 없이 참가비를, 쓸 수 있는 명단 없이 납부자 참가비를 정할 수 없다', async () => {
  const env = await setupPurchases()
  try {
    await prepare(env, { withAccount: false, withRoster: false })
    await refused(env.request('POST', base, formBody({ fee: 5000 })), 409, 'FEE_ACCOUNT_REQUIRED')
    // 무료는 계좌 없이 된다.
    const free = await create(env)
    assert.deepEqual([free.form!.fee, free.form!.memberFee, free.form!.payments, free.account, free.roster], [0, null, { count: 0, total: 0 }, null, null])
    await refused(update(env, { fee: 5000 }), 409, 'FEE_ACCOUNT_REQUIRED')
    env.as('f')
    await env.ok(env.request('POST', '/fee-account', account))
    env.as('p')
    await refused(update(env, { fee: 5000, memberFee: 0 }), 409, 'DUES_ROSTER_REQUIRED')
    const charged = await env.ok<RegistrationResponse>(update(env, { fee: 5000 }))
    assert.deepEqual([charged.form!.fee, charged.form!.memberFee, charged.account],
      [5000, null, { bank: '카카오뱅크', accountNumber: '3333-01-1234567', holder: '학생회' }])
    // 기한이 지난 명단도 없는 것으로 본다.
    env.as('f')
    await env.ok(env.request('POST', '/dues-roster', roster))
    env.as('p')
    await env.pg.query("UPDATE dues_rosters SET use_until = '2999-07-31'")
    await refused(update(env, { memberFee: 0 }), 409, 'DUES_ROSTER_REQUIRED')
    await env.pg.query("UPDATE dues_rosters SET use_until = '2999-12-31'")
    const member = await env.ok<RegistrationResponse>(update(env, { memberFee: 0 }))
    assert.deepEqual([member.form!.memberFee, member.roster], [0, { label: '2999년 납부자', useUntil: '2999-12-31' }])
    // 운영진 응답에는 납부자 목록이 없다.
    assert.equal(JSON.stringify(member).includes('Kim Bada'), false)
    // 이미 켠 납부자 참가비는 명단 기한이 지나도 다른 설정을 막지 않는다.
    await env.pg.query("UPDATE dues_rosters SET use_until = '2999-07-31'")
    assert.equal((await env.ok<RegistrationResponse>(update(env, { notice: '문의: 학생회실', memberFee: 1000 }))).form!.memberFee, 1000)
  } finally { await env.pg.close() }
})

test('참가비 정하기: 납부자 참가비를 켜면 지금 신청을 명단과 다시 맞추고, 끄면 구분을 지우며, 금액은 설정을 따른다', async () => {
  const env = await setupPurchases()
  try {
    await prepare(env)
    const { form } = await create(env, { fee: 5000 })
    await apply(env, form!.code, '김바다', '2022000001')
    await apply(env, form!.code, '이윤슬', '2023000003')
    assert.deepEqual((await entries(env)).map(entry => [entry.name, entry.duesMember, entry.fee, entry.paid]),
      [['김바다', null, 5000, null], ['이윤슬', null, 5000, null]])
    const on = (await env.ok<RegistrationResponse>(update(env, { memberFee: 0 }))).registrations
    assert.deepEqual(on.map(entry => [entry.name, entry.duesMember, entry.fee]), [['김바다', true, 0], ['이윤슬', false, 5000]])
    const priced = (await env.ok<RegistrationResponse>(update(env, { fee: 7000, memberFee: 1000 }))).registrations
    assert.deepEqual(priced.map(entry => [entry.name, entry.duesMember, entry.fee]), [['김바다', true, 1000], ['이윤슬', false, 7000]])
    const off = (await env.ok<RegistrationResponse>(update(env, { memberFee: null }))).registrations
    assert.deepEqual(off.map(entry => [entry.name, entry.duesMember, entry.fee]), [['김바다', null, 7000], ['이윤슬', null, 7000]])
  } finally { await env.pg.close() }
})

test('신청할 때 학번과 이름이 둘 다 맞아야 납부자다: 공백·대소문자는 무시하고, 쓰는 기한 다음 날부터는 미납자다', async () => {
  const env = await setupPurchases()
  try {
    await prepare(env)
    const { form } = await create(env, { fee: 5000, memberFee: 0 })
    await apply(env, form!.code, '김 바다', '2022-000001')
    await apply(env, form!.code, 'KIM  BADA', '2022000002')
    await apply(env, form!.code, '정하늘아', '2022000004')
    await apply(env, form!.code, '박해랑', '2023000003')
    await env.pg.query("UPDATE dues_rosters SET use_until = '2999-08-05'")
    env.clock.set(at('2999-08-05T23:59'))
    await apply(env, form!.code, '오하늘', '2022000005')
    env.clock.set(at('2999-08-06T00:00'))
    await apply(env, form!.code, '윤서진', '2022000006')
    assert.deepEqual((await entries(env)).map(entry => [entry.name, entry.duesMember, entry.fee]), [['김 바다', true, 0], ['KIM  BADA', true, 0],
      ['정하늘아', false, 5000], ['박해랑', false, 5000], ['오하늘', true, 0], ['윤서진', false, 5000]])
  } finally { await env.pg.close() }
})

test('입금 확인: 낼 돈이 있는 신청만 확인하고, 확인 취소와 참가비 바꾸기는 상태를 지킨다', async () => {
  const env = await setupPurchases()
  try {
    await prepare(env)
    const { form } = await create(env, { fee: 7000, memberFee: 0 })
    await apply(env, form!.code, '김바다', '2022000001')
    await apply(env, form!.code, '이윤슬', '2023000003')
    const list = await entries(env)
    const kim = named(list, '김바다')
    const lee = named(list, '이윤슬')
    const paid = await env.ok<RegistrationResponse>(confirm(env, lee.id))
    const leePaid = named(paid.registrations, '이윤슬')
    assert.deepEqual([leePaid.fee, leePaid.paid?.amount, leePaid.paid?.by], [7000, 7000, { id: 'p', name: '기획' }])
    assert.match(leePaid.paid!.at, korean)
    assert.deepEqual(paid.form!.payments, { count: 1, total: 7000 })
    await refused(confirm(env, lee.id), 409, 'PAYMENT_CONFIRMED')
    await refused(switchDues(env, lee.id, { duesMember: true }), 409, 'PAYMENT_CONFIRMED')
    await refused(confirm(env, kim.id), 409, 'NO_FEE')
    // 다른 운영진도 확인을 취소한다.
    env.as('q')
    const unpaid = await env.ok<RegistrationResponse>(unconfirm(env, lee.id))
    assert.deepEqual([named(unpaid.registrations, '이윤슬').paid, unpaid.form!.payments], [null, { count: 0, total: 0 }])
    await refused(unconfirm(env, lee.id), 409, 'PAYMENT_NOT_CONFIRMED')
    // 납부자로 바꾸면 납부자 참가비다. 같은 구분으로 바꾸면 그대로다.
    const switched = await env.ok<RegistrationResponse>(switchDues(env, lee.id, { duesMember: true }))
    assert.deepEqual([named(switched.registrations, '이윤슬').duesMember, named(switched.registrations, '이윤슬').fee], [true, 0])
    assert.deepEqual(await env.ok<RegistrationResponse>(switchDues(env, lee.id, { duesMember: true })), switched)
    // 납부자 참가비가 없으면 참가비를 바꿀 수 없다.
    await env.ok(update(env, { memberFee: null }))
    await refused(switchDues(env, lee.id, { duesMember: false }), 409, 'INVALID_STATE')
  } finally { await env.pg.close() }
})

test('금액 잠금: 입금 확인이 있으면 금액을 바꿀 수 없고, 확인한 신청을 운영진이 취소해도 받은 돈과 잠금이 남는다', async () => {
  const env = await setupPurchases()
  try {
    await prepare(env)
    const { form } = await create(env, { fee: 7000 })
    await apply(env, form!.code, '이윤슬', '2023000003')
    const lee = named(await entries(env), '이윤슬')
    await env.ok(confirm(env, lee.id))
    await refused(update(env, { fee: 8000 }), 409, 'FEE_LOCKED')
    await refused(update(env, { memberFee: 0 }), 409, 'FEE_LOCKED')
    const noted = await env.ok<RegistrationResponse>(update(env, { notice: '입금 기한: 8월 10일' }))
    assert.equal(noted.form!.notice, '입금 기한: 8월 10일')
    const cancelled = await env.ok<RegistrationResponse>(env.request('POST', `${base}/entries/${lee.id}/cancel`, {}))
    assert.deepEqual([cancelled.registrations.length, cancelled.form!.payments], [0, { count: 1, total: 7000 }])
    await refused(update(env, { fee: 8000 }), 409, 'FEE_LOCKED')
    const { rows } = await env.pg.query<{ name: string | null; paid_amount: number }>('SELECT name, paid_amount FROM registrations')
    assert.deepEqual(rows.map(row => [row.name, row.paid_amount]), [[null, 7000]])
  } finally { await env.pg.close() }
})

test('정산이 끝난 행사는 입금 확인·확인 취소·참가비 바꾸기·금액 변경을 막는다', async () => {
  const env = await setupPurchases()
  try {
    await prepare(env)
    const { form } = await create(env, { fee: 7000, memberFee: 0 })
    await apply(env, form!.code, '이윤슬', '2023000003')
    await apply(env, form!.code, '박해랑', '2023000004')
    const list = await entries(env)
    await env.ok(confirm(env, named(list, '이윤슬').id))
    assert.equal((await env.ok<RegistrationResponse>(env.request('GET', base))).settled, false)
    // 받은 참가비가 있으면 행사가 회계 기간에 들어 있어야 정산된다.
    env.as('f')
    const period = await env.ok<BudgetPlanResponse>(env.request('POST', '/budget/periods', { name: '2999년 1학기', startsOn: '2999-03-01',
      endsOn: '2999-08-31' }), 201)
    await env.ok(env.request('POST', `/budget/periods/${period.period.id}/plan`, { version: period.period.version, name: period.period.name,
      startsOn: period.period.startsOn, endsOn: period.period.endsOn, incomes: [], operating: [], events: [{ eventId: 'e', version: 0 }] }))
    await env.ok(env.request('POST', '/events/e/finance/settle', { version: 0, feeIncomeLineId: null }))
    env.as('p')
    assert.equal((await env.ok<RegistrationResponse>(env.request('GET', base))).settled, true)
    // 참가 신청을 만들지 않은 행사도 정산 상태를 준다.
    assert.equal((await env.ok<RegistrationResponse>(env.request('GET', '/events/e2/registration'))).settled, false)
    await refused(confirm(env, named(list, '박해랑').id), 409, 'EVENT_SETTLED')
    await refused(unconfirm(env, named(list, '이윤슬').id), 409, 'EVENT_SETTLED')
    await refused(switchDues(env, named(list, '박해랑').id, { duesMember: true }), 409, 'EVENT_SETTLED')
    await refused(update(env, { fee: 8000 }), 409, 'EVENT_SETTLED')
    // 금액이 같으면 다른 설정은 바꾼다.
    assert.equal((await env.ok<RegistrationResponse>(update(env, { notice: '정산 뒤 안내' }))).form!.notice, '정산 뒤 안내')
  } finally { await env.pg.close() }
})

test('입금 확인·참가비 바꾸기: 취소했거나 정보를 지운 신청, 다른 학생회 행사의 신청은 찾을 수 없다', async () => {
  const env = await setupPurchases()
  try {
    await prepare(env)
    const { form } = await create(env, { fee: 7000, memberFee: 0 })
    await apply(env, form!.code, '이윤슬', '2023000003')
    await apply(env, form!.code, '박해랑', '2023000004')
    const list = await entries(env)
    const lee = named(list, '이윤슬')
    const park = named(list, '박해랑')
    await env.ok(env.request('POST', `${base}/entries/${park.id}/cancel`, {}))
    await refused(confirm(env, park.id), 404, 'NOT_FOUND')
    await refused(unconfirm(env, park.id), 404, 'NOT_FOUND')
    await refused(switchDues(env, park.id, { duesMember: true }), 404, 'NOT_FOUND')
    await refused(confirm(env, 'missing'), 404, 'NOT_FOUND')
    await refused(env.request('POST', `/events/ex/registration/entries/${lee.id}/payment`, {}), 404, 'NOT_FOUND')
    await refused(env.request('POST', `/events/e2/registration/entries/${lee.id}/payment`, {}), 404, 'NOT_FOUND')
    // 보관 기간이 지나 정보를 지운 신청도 찾을 수 없다.
    await env.pg.query("UPDATE events SET starts_at = '2024-01-01T10:00+09', ends_at = '2024-01-01T18:00+09' WHERE id = 'e'")
    await refused(confirm(env, lee.id), 404, 'NOT_FOUND')
    await refused(switchDues(env, lee.id, { duesMember: true }), 404, 'NOT_FOUND')
  } finally { await env.pg.close() }
})

test('입금 확인·참가비 바꾸기 권한과 본문: 미배정·다른 학생회는 403, 미인증은 401, 틀린 본문은 인증 전에 400이다', async () => {
  const env = await setupPurchases()
  try {
    await prepare(env)
    const { form } = await create(env, { fee: 7000, memberFee: 0 })
    await apply(env, form!.code, '이윤슬', '2023000003')
    const lee = named(await entries(env), '이윤슬')
    for (const user of ['n', 'x']) {
      env.as(user)
      await refused(confirm(env, lee.id), 403, 'FORBIDDEN', user)
      await refused(unconfirm(env, lee.id), 403, 'FORBIDDEN', user)
      await refused(switchDues(env, lee.id, { duesMember: true }), 403, 'FORBIDDEN', user)
    }
    env.as(null)
    assert.equal((await confirm(env, lee.id)).status, 401)
    assert.equal((await unconfirm(env, lee.id)).status, 401)
    assert.equal((await switchDues(env, lee.id, { duesMember: true })).status, 401)
    for (const body of [{ extra: 1 }, { amount: 7000 }]) {
      await refused(confirm(env, lee.id, body), 400, 'INVALID_INPUT', JSON.stringify(body))
      await refused(unconfirm(env, lee.id, body), 400, 'INVALID_INPUT', JSON.stringify(body))
    }
    for (const body of [{}, { duesMember: 'yes' }, { duesMember: null }, { duesMember: true, extra: 1 }]) {
      await refused(switchDues(env, lee.id, body), 400, 'INVALID_INPUT', JSON.stringify(body))
    }
    for (const body of [{ ...formBody(), fee: undefined }, { ...formBody(), memberFee: undefined }, formBody({ fee: 1_000_001 }), formBody({ fee: -1 }),
      formBody({ fee: 5000, memberFee: 5000 }), formBody({ fee: '5000' })]) {
      await refused(env.request('POST', base, body), 400, 'INVALID_INPUT', JSON.stringify(body))
    }
    const { rows } = await env.pg.query<{ paid_at: Date | null }>('SELECT paid_at FROM registrations')
    assert.deepEqual(rows.map(row => row.paid_at), [null])
  } finally { await env.pg.close() }
})

const lookup = (env: Env, token: string) => env.ok<MyRegistration>(env.publicRequest('POST', '/public/registrations/lookup', { token }))
const accountView = { bank: '카카오뱅크', accountNumber: '3333-01-1234567', holder: '학생회' }

test('공개 화면: 신청 화면에 참가비를 알리고, 내 신청은 구분·낼 돈·계좌·입금 상태를 준다', async () => {
  const env = await setupPurchases()
  try {
    await prepare(env)
    const { form } = await create(env, { fee: 5000, memberFee: 0 })
    const view = await env.ok<PublicRegistrationForm>(env.publicRequest('GET', `/public/registration-forms/${form!.code}`))
    assert.deepEqual([view.fee, view.memberFee], [5000, 0])
    const memberToken = await apply(env, form!.code, '김바다', '2022000001')
    const otherToken = await apply(env, form!.code, '이윤슬', '2023000003')
    assert.deepEqual((await lookup(env, memberToken)).payment, { basis: 'member', fee: 0, paidAt: null, account: null })
    const before = await lookup(env, otherToken)
    assert.deepEqual([before.payment, before.cancellable], [{ basis: 'nonmember', fee: 5000, paidAt: null, account: accountView }, true])
    await env.ok(confirm(env, named(await entries(env), '이윤슬').id))
    const after = await lookup(env, otherToken)
    assert.deepEqual([after.payment?.basis, after.payment?.fee, after.payment?.account, after.cancellable], ['nonmember', 5000, null, false])
    assert.match(after.payment!.paidAt!, korean)
    // 납부자 참가비가 없으면 모두 같은 참가비다.
    await env.ok(unconfirm(env, named(await entries(env), '이윤슬').id))
    await env.ok(update(env, { memberFee: null }))
    assert.deepEqual((await lookup(env, memberToken)).payment, { basis: 'flat', fee: 5000, paidAt: null, account: accountView })
  } finally { await env.pg.close() }
})

test('공개 화면: 참가비가 없는 신청은 내 신청에 참가비가 없고, 무료 신청 화면은 0원이다', async () => {
  const env = await setupPurchases()
  try {
    await prepare(env, { withAccount: false, withRoster: false })
    const { form } = await create(env)
    const view = await env.ok<PublicRegistrationForm>(env.publicRequest('GET', `/public/registration-forms/${form!.code}`))
    assert.deepEqual([view.fee, view.memberFee], [0, null])
    const token = await apply(env, form!.code, '김바다', '2022000001')
    assert.equal((await lookup(env, token)).payment, null)
  } finally { await env.pg.close() }
})

test('엇갈림: 학생이 조회한 뒤 운영진이 입금을 확인하면, 그 학생의 스스로 취소는 막히고 확인은 그대로 남는다', async () => {
  const env = await setupPurchases()
  try {
    await prepare(env)
    const { form } = await create(env, { fee: 5000 })
    const token = await apply(env, form!.code, '이윤슬', '2023000003')
    assert.equal((await lookup(env, token)).cancellable, true)
    await env.ok(confirm(env, named(await entries(env), '이윤슬').id))
    await refused(env.publicRequest('POST', '/public/registrations/cancel', { token }), 409, 'PAYMENT_CONFIRMED')
    const list = await entries(env)
    assert.deepEqual([list.length, named(list, '이윤슬').paid?.amount], [1, 5000])
  } finally { await env.pg.close() }
})

test('보관 기간이 지나 개인 칸을 지워도 납부 구분과 입금 칸은 남는다', async () => {
  const env = await setupPurchases()
  try {
    await prepare(env)
    const { form } = await create(env, { fee: 5000, memberFee: 1000 })
    await apply(env, form!.code, '이윤슬', '2023000003')
    await env.ok(confirm(env, named(await entries(env), '이윤슬').id))
    await env.pg.query("UPDATE events SET starts_at = '2024-01-01T10:00+09', ends_at = '2024-01-01T18:00+09' WHERE id = 'e'")
    const purged = await env.ok<RegistrationResponse>(env.request('GET', base))
    assert.deepEqual([purged.registrations.length, purged.form!.payments], [0, { count: 1, total: 5000 }])
    const { rows } = await env.pg.query<{ name: string | null; dues_member: boolean; paid_amount: number; paid_at: Date | null }>(
      'SELECT name, dues_member, paid_amount, paid_at FROM registrations')
    assert.deepEqual(rows.map(row => [row.name, row.dues_member, row.paid_amount, row.paid_at instanceof Date]), [[null, false, 5000, true]])
  } finally { await env.pg.close() }
})
