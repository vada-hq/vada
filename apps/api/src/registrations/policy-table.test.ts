import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  APPLICANT_ACTIONS,
  FORM_ACTIONS,
  FORM_LIST_ACTIONS,
  type ApplicantAction,
  type FormAction,
  type FormListAction,
  type ApplicantsResponse,
  type RegistrationForm,
} from '@vada/contracts'
import { createRateLimiter } from '../http/rate-limit.js'
import { korean, type RegistrationKit, startRegistrations } from '../test-support/registrations.js'

// 신청 정책의 구조 검사(기능 012 조각 6, work-method '검사와 시험'): 양식 상태 × 사람 × 양식 동작,
// 신청자 상태 × 사람 × 신청자 동작 표. 칸마다 읽기 actions에 있으면 그 쓰기가 성공하고, 없으면 403이나 그 칸의 코드로 거절된다.
// 동작이나 상태를 더하면 이 표에 줄을 더한다. 읽기와 쓰기가 갈리는 칸은 아래 EXCEPTIONS에 이유를 달아 둔다.
// 사람: 관리 권한(회장), 열람만·재정부(재정부원: 신청자 보기와 환불함만), 권한 없음.

// 읽기에 없는데 쓰기가 조용히 성공하는 칸. 칸이 표와 같아지면 이 목록도 실패한다(낡은 예외를 남기지 않는다).
const EXCEPTIONS: Record<string, string> = {
  '양식 받는 중 회장 form.activate': '이미 활성 양식은 판을 늘리지 않는다',
  '양식 받는 중 회장 form.resume': '이미 그 상태인 다시 받기는 조용히 200이다(012-3 M3)',
  '양식 멈춤 회장 form.pause': '이미 그 상태인 멈추기는 조용히 200이다(012-3 M3)',
  '신청자 attended 회장 registration.check_in':
    '출석한 신청의 [출석]은 decide 밖에서 숨기고 쓰기는 200 already다(012-4 M2)',
}
const usedExceptions = new Set<string>()
// 돌아간 표(칸 이름의 첫 낱말: 양식, 신청자). 일부 시험만 돌려도 예외 목록 검사가 돌아간 표만 본다.
const ranTables = new Set<string>()
const TABLES = ['양식', '신청자']
// 칸 하나를 맞춘다: 예외 칸은 읽기에 없고 쓰기가 expected(성공)인 것을, 아니면 읽기와 쓰기가 같은 것을 본다.
function checkCell(cell: string, shown: boolean, code: string | null, expected: string | null) {
  ranTables.add(cell.split(' ')[0]!)
  assert.equal(code, expected, `${cell} 쓰기`)
  if (cell in EXCEPTIONS) {
    usedExceptions.add(cell)
    assert.equal(shown, false, `${cell} 예외인데 읽기에 있다`)
    assert.equal(code, null, `${cell} 예외인데 쓰기가 거절된다`)
  } else assert.equal(shown, expected === null, `${cell} 읽기 actions`)
}

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

type State = 'free' | 'live' | 'attended' | 'paid' | 'pending' | 'done'
const STATES: State[] = ['free', 'live', 'attended', 'paid', 'pending', 'done']

const PATH: Record<ApplicantAction, [string, unknown]> = {
  'registration.check_in': ['attendance', {}],
  'registration.cancel_check_in': ['attendance/cancel', {}],
  'registration.cancel': ['cancel', {}],
  'deposit.confirm': ['deposit', { amount: FEE }],
  'deposit.cancel': ['deposit/cancel', { reason: '잘못 눌렀어요' }],
  'deposit.refund': ['refund', {}],
}
const ACTIONS = Object.keys(PATH) as ApplicantAction[]
const NAMES: Record<string, string> = { [PRESIDENT]: '회장', [FINANCE]: '재정', [PLAIN]: '일반' }

// 권한이 있는데 상태가 막을 때 쓰기가 내는 코드. 빠진 칸은 허용이다.
// 출석한 신청의 출석은 조용히 already로 넘어가는 쓰기라 EXCEPTIONS에 둔다(버튼은 주지 않는다).
const BLOCKED: Record<State, Partial<Record<ApplicantAction, string>>> = {
  // 참가비 없는 신청은 입금을 확인하지 않는다(쓰기는 400).
  free: {
    'registration.cancel_check_in': 'NOT_CHECKED_IN',
    'deposit.confirm': 'INVALID_INPUT',
    'deposit.cancel': 'NO_DEPOSIT',
    'deposit.refund': 'NOT_REFUNDABLE',
  },
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
  free: { [PRESIDENT]: ['registration.check_in', 'registration.cancel'], [FINANCE]: [] },
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

// 상태마다 신청에 해 둘 쓰기
const STEPS: Partial<Record<State, [string, unknown][]>> = {
  attended: [['attendance', {}]],
  paid: [['deposit', { amount: FEE }]],
  pending: [
    ['deposit', { amount: FEE }],
    ['cancel', {}],
  ],
  done: [['deposit', { amount: FEE }]],
}
async function setUp(state: State, post: (tail: string, body: unknown) => Promise<void>) {
  for (const [tail, body] of STEPS[state] ?? []) await post(tail, body)
}

async function build(t: RegistrationKit, state: State, name: string) {
  const event = await t.makeEvent()
  const [existing] = (await t.pg.query('SELECT id FROM account LIMIT 1')).rows as { id: string }[]
  const feeAccountId = existing?.id ?? (await t.makeAccount())
  const fee = state === 'free' ? 0 : FEE
  const made = await t.activeForm(event, {
    payerFee: fee,
    nonPayerFee: fee,
    ...(fee ? { feeAccountId } : {}),
  })
  const { form } = made
  await t.applied(form.publicCode, { name, studentId: '202612345' })
  const id = (
    (await t.pg.query('SELECT id FROM registration ORDER BY id DESC LIMIT 1')).rows[0] as {
      id: string
    }
  ).id
  const post = async (tail: string, body: unknown = {}) =>
    assert.ok((await t.post(`/registrations/${id}/${tail}`, body)).ok, tail)
  await setUp(state, post)
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
          const cell = `신청자 ${state} ${NAMES[user]} ${action}`
          const code = await attempt(t, state, user, action)
          const blocked = BLOCKED[state][action] ?? null
          const expected = permittedTo(user, action) ? blocked : 'FORBIDDEN'
          checkCell(cell, SHOWN[state][user]?.includes(action) ?? false, code, expected)
        }
  }),
)

test('표의 열은 계약의 동작 목록과 같다', () => {
  assert.deepEqual([...ACTIONS].sort(), [...APPLICANT_ACTIONS].sort())
  assert.deepEqual(Object.keys(WRITE_FORM).sort(), [...FORM_LIST_ACTIONS, ...FORM_ACTIONS].sort())
  for (const state of STATES) {
    assert.deepEqual(Object.keys(SHOWN[state]).sort(), [FINANCE, PRESIDENT].sort(), state)
    for (const user of [PRESIDENT, FINANCE])
      for (const action of SHOWN[state][user]!) assert.ok(ACTIONS.includes(action), action)
  }
})

// 양식 동작의 쓰기. 신청자 보기는 읽기라 GET이다.
const HASH = 'a'.repeat(64)
type FormWrite = FormListAction | FormAction
const WRITE_FORM: Record<FormWrite, (form: RegistrationForm) => [string, unknown] | string> = {
  'form.create': form => [
    `/events/${form.eventId}/registration-forms`,
    { ...EDIT, name: '새 양식', closesAt: '2026-11-01T18:00' },
  ],
  'form.update': form => [
    `/registration-forms/${form.id}`,
    { ...EDIT, name: form.name, closesAt: form.closesAt },
  ],
  'form.pause': form => [`/registration-forms/${form.id}/pause`, {}],
  'form.activate': form => [`/registration-forms/${form.id}/activate`, {}],
  'form.resume': form => [`/registration-forms/${form.id}/resume`, {}],
  'form.check_in': form => [`/events/${form.eventId}/check-in`, { tokenHash: HASH }],
  'form.view_applicants': form => `/registration-forms/${form.id}/applicants`,
}
const EDIT = {
  opensAt: null,
  capacity: null,
  notice: null,
  collectsPhone: false,
  collectsStudentId: true,
  payerFee: null,
  nonPayerFee: null,
  feeAccountId: null,
}
const FORM_COLUMNS = [...FORM_LIST_ACTIONS, ...FORM_ACTIONS]
type FormState = '받는 중' | '멈춤' | '마감' | '완료'
const FORM_STATES: FormState[] = ['받는 중', '멈춤', '마감', '완료']
const FORM_USERS: [string, string][] = [
  ['회장', PRESIDENT],
  ['재정', FINANCE],
  ['일반', PLAIN],
]

// 칸의 코드(null은 허용). 회장은 상태가 막는 코드, 재정부는 신청자 보기만, 일반은 모두 403이다.
function formCode(state: FormState, user: string, action: FormWrite) {
  if (user === PLAIN) return 'FORBIDDEN'
  if (action === 'form.view_applicants') return null
  if (user === FINANCE) return 'FORBIDDEN'
  if (state === '완료') return 'EVENT_COMPLETED'
  const stateChange =
    action === 'form.pause' || action === 'form.resume' || action === 'form.activate'
  return state === '마감' && stateChange ? 'FORM_CLOSED' : null
}

async function buildForm(t: RegistrationKit, state: FormState) {
  const event = await t.makeEvent({
    ownerId: t.council.people.planningMember.memberId,
    startsAt: korean('2026-11-02T12:00'),
  })
  const closesAt = state === '마감' ? korean('2026-10-24T12:00') : korean('2026-11-01T18:00')
  const id = await t.makeForm(event, { closesAt })
  if (state === '멈춤') assert.ok((await t.post(`/registration-forms/${id}/pause`, {})).ok)
  if (state === '완료') await t.complete(event)
  return t.detail(id)
}

async function attemptForm(
  t: RegistrationKit,
  form: RegistrationForm,
  action: FormWrite,
  user: string,
) {
  const request = WRITE_FORM[action](form)
  const response =
    typeof request === 'string'
      ? await t.api.get(`${t.orgBase}${request}`, user)
      : await t.post(...request, user)
  // QR 출석은 없는 토큰이라 허용이면 404다.
  if (response.ok || (action === 'form.check_in' && response.status === 404)) return null
  return ((await response.json()) as { error: string }).error
}

test(
  '양식 상태 × 사람 × 동작: 읽기 actions에 있으면 쓰기가 성공하고, 없으면 403이나 그 칸의 코드로 거절된다',
  withKit(async t => {
    for (const state of FORM_STATES)
      for (const [name, user] of FORM_USERS)
        for (const action of FORM_COLUMNS) {
          const form = await buildForm(t, state)
          const shown =
            action === 'form.create'
              ? (await t.list(form.eventId, user)).actions.includes(action)
              : (await t.detail(form.id, user)).actions.includes(action)
          const code = await attemptForm(t, form, action, user)
          checkCell(`양식 ${state} ${name} ${action}`, shown, code, formCode(state, user, action))
        }
  }),
)

test('예외 목록의 칸은 모두 표에서 만났고 여전히 읽기와 쓰기가 갈린다', () => {
  // 첫 낱말이 알려진 표 이름이 아니면(오타, 표 이름 바꾸기) 그 예외는 검사에서 빠지므로 막는다.
  for (const cell of Object.keys(EXCEPTIONS))
    assert.ok(TABLES.includes(cell.split(' ')[0]!), `${cell} 표 이름을 모른다`)
  const ran = Object.keys(EXCEPTIONS).filter(cell => ranTables.has(cell.split(' ')[0]!))
  assert.deepEqual([...usedExceptions].sort(), ran.sort())
})
