import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ApplicantAction, ApplicantsResponse } from '@vada/contracts'
import { createRateLimiter } from '../http/rate-limit.js'
import { type RegistrationKit, startRegistrations } from '../test-support/registrations.js'

// 신청자 한 줄 정책(기능 012 조각 4): 줄의 actions와 쓰기의 거절이 같은 판정에서 나온다(자주 잡힌 것 11·12).

// 칸마다 신청을 새로 만들어 쓰기를 수백 번 보내므로 쓰기 제한을 넉넉히 둔다.
const withKit = (body: (t: RegistrationKit) => Promise<void>) => async () => {
  const t = await startRegistrations({
    writeLimiter: createRateLimiter({ limit: 100_000, windowMs: 60_000 }),
  })
  try {
    await body(t)
  } finally {
    await t.close()
  }
}

const PRESIDENT = 's-president'
const FINANCE = 's-financeMember'
const PLAIN = 's-plain'
const FEE = 5000

type State = 'live' | 'attended' | 'paid' | 'pending' | 'done'
const STATES: State[] = ['live', 'attended', 'paid', 'pending', 'done']

const PATH: Record<ApplicantAction, [string, unknown]> = {
  'registration.check_in': ['attendance', {}],
  'registration.cancel_check_in': ['attendance/cancel', {}],
  'registration.cancel': ['cancel', {}],
  'deposit.confirm': ['deposit', { amount: FEE }],
  'deposit.cancel': ['deposit/cancel', { reason: '잘못 눌렀어요' }],
  'deposit.refund': ['refund', {}],
}
const ACTIONS = Object.keys(PATH) as ApplicantAction[]

// 권한이 있는데 상태가 막을 때 쓰기가 내는 코드. 빠진 칸은 허용이다.
// 출석한 신청의 출석은 조용히 already로 넘어가는 쓰기라 표에서 뺀다(버튼은 주지 않는다).
const BLOCKED: Record<State, Partial<Record<ApplicantAction, string>>> = {
  live: {
    'registration.cancel_check_in': 'NOT_CHECKED_IN',
    'deposit.cancel': 'NO_DEPOSIT',
    'deposit.refund': 'NOT_REFUNDABLE',
  },
  attended: {
    'registration.cancel': 'CHECKED_IN',
    'deposit.cancel': 'NO_DEPOSIT',
    'deposit.refund': 'NOT_REFUNDABLE',
  },
  paid: {
    'registration.cancel_check_in': 'NOT_CHECKED_IN',
    'deposit.confirm': 'DEPOSIT_EXISTS',
    'deposit.refund': 'NOT_REFUNDABLE',
  },
  pending: {
    'registration.check_in': 'NOT_FOUND',
    'registration.cancel_check_in': 'NOT_FOUND',
    'registration.cancel': 'NOT_FOUND',
    'deposit.confirm': 'NOT_FOUND',
  },
  done: Object.fromEntries(ACTIONS.map(a => [a, 'EVENT_COMPLETED'])),
}

// 읽기 actions(사람마다). 출석 안 한 신청의 [출석]은 이미 출석이면 숨긴다.
const SHOWN: Record<State, Record<string, ApplicantAction[]>> = {
  live: {
    [PRESIDENT]: ['registration.check_in', 'registration.cancel', 'deposit.confirm'],
    [FINANCE]: [],
  },
  attended: { [PRESIDENT]: ['registration.cancel_check_in', 'deposit.confirm'], [FINANCE]: [] },
  paid: {
    [PRESIDENT]: ['registration.check_in', 'registration.cancel', 'deposit.cancel'],
    [FINANCE]: [],
  },
  pending: { [PRESIDENT]: ['deposit.cancel'], [FINANCE]: ['deposit.refund'] },
  done: { [PRESIDENT]: [], [FINANCE]: [] },
}

async function build(t: RegistrationKit, state: State, name: string) {
  const event = await t.makeEvent()
  const [existing] = (await t.pg.query('SELECT id FROM account LIMIT 1')).rows as { id: string }[]
  const feeAccountId = existing?.id ?? (await t.makeAccount())
  const made = await t.created(event, { payerFee: FEE, nonPayerFee: FEE, feeAccountId })
  const { form } = made
  await t.applied(form.publicCode, { name, studentId: '202612345' })
  const id = (
    (await t.pg.query('SELECT id FROM registration ORDER BY id DESC LIMIT 1')).rows[0] as {
      id: string
    }
  ).id
  const post = async (tail: string, body: unknown = {}) =>
    assert.ok((await t.post(`/registrations/${id}/${tail}`, body)).ok, tail)
  if (state === 'attended') await post('attendance')
  if (state === 'paid' || state === 'pending' || state === 'done')
    await post('deposit', { amount: FEE })
  if (state === 'pending') await post('cancel')
  if (state === 'done') await t.complete(event)
  return { form, id }
}

const listed = async (t: RegistrationKit, formId: string, user: string) => {
  const response = await t.api.get(`${t.orgBase}/registration-forms/${formId}/applicants`, user)
  return ((await response.json()) as ApplicantsResponse).applicants
}

test(
  '신청자 줄의 actions는 상태 × 사람 표대로이고 완료한 행사의 줄은 비어 있다',
  withKit(async t => {
    for (const state of STATES) {
      const { form } = await build(t, state, '김줄')
      for (const user of [PRESIDENT, FINANCE]) {
        const [row] = await listed(t, form.id, user)
        assert.deepEqual(row!.actions, SHOWN[state][user], `${state} ${user}`)
      }
    }
  }),
)

const permittedTo = (user: string, action: ApplicantAction) =>
  user === PRESIDENT ? action !== 'deposit.refund' : user === FINANCE && action === 'deposit.refund'

// 쓰기를 보내 막은 코드(허용이면 null)를 본다.
async function attempt(t: RegistrationKit, state: State, user: string, action: ApplicantAction) {
  const { id } = await build(t, state, '김칸')
  const [tail, body] = PATH[action]
  const response = await t.post(`/registrations/${id}/${tail}`, body, user)
  return response.ok ? null : ((await response.json()) as { error: string }).error
}

test(
  '신청자 쓰기는 actions에 있으면 되고, 없으면 403이나 그 칸의 코드로 거절된다',
  withKit(async t => {
    for (const state of STATES)
      for (const user of [PRESIDENT, FINANCE, PLAIN])
        for (const action of ACTIONS) {
          // 출석한 신청의 출석은 조용히 넘어가는 쓰기라 칸에서 뺀다.
          if (state === 'attended' && action === 'registration.check_in') continue
          const cell = `${state} ${user} ${action}`
          const code = await attempt(t, state, user, action)
          const blocked = BLOCKED[state][action] ?? null
          assert.equal(code, permittedTo(user, action) ? blocked : 'FORBIDDEN', cell)
          // 읽기 actions에 있는 동작은 쓰기도 된다.
          if (SHOWN[state][user]?.includes(action))
            assert.equal(code, null, `${cell} 보이는데 거절`)
        }
  }),
)
