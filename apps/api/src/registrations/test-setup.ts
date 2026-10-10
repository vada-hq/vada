import assert from 'node:assert/strict'
import type { RegistrationCreated, RegistrationEntry, RegistrationResponse } from '@vada/contracts'
import type { setupPurchases } from '../purchases/test-setup.js'

// 참가 신청·참가비 테스트가 같이 쓰는 도움 함수. 행사 e의 참가 신청을 다룬다.
export type Env = Awaited<ReturnType<typeof setupPurchases>>
export async function refused(pending: Response | Promise<Response>, status: number, error: string, label = error) {
  const response = await pending
  assert.equal(response.status, status, label)
  assert.deepEqual(await response.json(), { error }, label)
}
export const at = (value: string) => new Date(`${value}:00+09:00`)
export const registrationBase = '/events/e/registration'
export const formBody = (overrides: Record<string, unknown> = {}) => ({ opensAt: null, closesAt: '2999-08-19T23:59', capacity: null, notice: null,
  collectPhone: false, fee: 0, memberFee: null, ...overrides })
export const account = { version: 0, bank: '카카오뱅크', accountNumber: '3333-01-1234567', holder: '학생회' }
export const roster = { version: 0, label: '2999년 납부자', useUntil: '2999-12-31', members: [{ studentId: '2022000001', name: '김바다' },
  { studentId: '2022000002', name: 'Kim Bada' }, { studentId: '2022000004', name: '정하늘' }, { studentId: '2022000005', name: '오하늘' },
  { studentId: '2022000006', name: '윤서진' }] }
// 시계는 2999년 8월 1일이다. 재정(f)이 계좌와 명단을 넣고, 기획(p)이 행사 e에 일시를 넣는다. 끝나면 기획(p)으로 남는다.
export async function prepare(env: Env, { withAccount = true, withRoster = true } = {}) {
  env.clock.set(at('2999-08-01T00:00'))
  env.as('f')
  if (withAccount) await env.ok(env.request('POST', '/fee-account', account))
  if (withRoster) await env.ok(env.request('POST', '/dues-roster', roster))
  env.as('p')
  await env.ok(env.request('PATCH', '/events/e', { version: 1, startsAt: '2999-08-20T10:00', endsAt: '2999-08-20T18:00', place: '체육관' }))
}
export const create = (env: Env, overrides: Record<string, unknown> = {}) => env.ok<RegistrationResponse>(env.request('POST', registrationBase, formBody(overrides)), 201)
// 지금 설정에 바꿀 칸만 바꿔 보낸다.
export async function update(env: Env, overrides: Record<string, unknown> = {}) {
  const { form } = await env.ok<RegistrationResponse>(env.request('GET', registrationBase))
  return env.request('PATCH', registrationBase, { version: form!.version, accepting: form!.accepting, opensAt: form!.opensAt, closesAt: form!.closesAt,
    capacity: form!.capacity, notice: form!.notice, collectPhone: form!.collectPhone, fee: form!.fee, memberFee: form!.memberFee, ...overrides })
}
// 공개 신청으로 넣는다. 로그인은 그대로 둔다.
export async function apply(env: Env, code: string, name: string, studentId: string) {
  const user = env.state.userId
  env.as(null)
  const { token } = await env.ok<RegistrationCreated>(env.publicRequest('POST', `/public/registration-forms/${code}/entries`,
    { name, studentId, phone: null, agreed: true }), 201)
  env.as(user)
  return token
}
export const entries = async (env: Env) => (await env.ok<RegistrationResponse>(env.request('GET', registrationBase))).registrations
export const named = (list: RegistrationEntry[], name: string) => list.find(entry => entry.name === name)!
export const confirm = (env: Env, id: string, body: unknown = {}) => env.request('POST', `${registrationBase}/entries/${id}/payment`, body)
export const unconfirm = (env: Env, id: string, body: unknown = {}) => env.request('POST', `${registrationBase}/entries/${id}/payment/cancel`, body)
export const switchDues = (env: Env, id: string, body: unknown) => env.request('POST', `${registrationBase}/entries/${id}/dues`, body)
