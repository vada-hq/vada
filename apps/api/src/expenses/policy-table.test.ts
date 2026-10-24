import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  EVIDENCE_MAX,
  EXPENSE_ACTIONS,
  type ExpenseAction,
  type ExpenseResponse,
  type PhotoUploadResponse,
} from '@vada/contracts'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'

// 지출 정책의 구조 검사(기능 014 조각 6, work-method '검사와 시험'): 상태 × 사람 × EXPENSE_ACTIONS 표.
// 칸마다 읽기 actions에 있으면 그 쓰기가 성공하고, 없으면 403이나 그 칸의 코드로 거절된다.
// 동작이나 상태를 더하면 이 표에 줄을 더한다. 예외 목록은 없다.

const FORBIDDEN = 'FORBIDDEN'
const PEOPLE = { 재정부: 's-financeMember', 회장단: 's-president', 다른_운영진: 's-planningMember' }
type Person = keyof typeof PEOPLE
type Cells = Record<ExpenseAction, string | null>

const cells = (
  cancel: string | null,
  reimburse: string | null,
  update: string | null,
  attach: string | null,
): Cells => ({
  'expense.cancel': cancel,
  'expense.reimburse': reimburse,
  'expense.update': update,
  'expense.attach_evidence': attach,
})
const same = (code: string | null) => cells(code, code, code, code)
const COMPLETED = 'EVENT_COMPLETED'
const NOT_REIMBURSABLE = 'NOT_REIMBURSABLE'

type State = {
  name: string
  // 재정부의 칸. 다른 사람은 모두 403이다(지출의 동작은 재정부만이다).
  expected: Cells
  build: (t: SettlementKit, ids: { done: string; closedPeriodDay: Date }) => Promise<string>
}

const payer = (t: SettlementKit) => ({ paidBy: t.council.people.planningMember.memberId })
const STATES: State[] = [
  { name: '열림', expected: same(null), build: t => t.expense(payer(t)) },
  {
    name: '학생회 돈(먼저 낸 사람 없음)',
    expected: cells(null, NOT_REIMBURSABLE, null, null),
    build: t => t.expense({}),
  },
  {
    name: '취소됨',
    expected: cells(
      'EXPENSE_CANCELLED',
      NOT_REIMBURSABLE,
      'EXPENSE_CANCELLED',
      'EXPENSE_CANCELLED',
    ),
    build: t => t.expense({ ...payer(t), cancelledAt: new Date('2026-10-25T01:00:00Z') }),
  },
  {
    name: '환급함',
    expected: cells(null, NOT_REIMBURSABLE, null, null),
    build: t => t.expense({ ...payer(t), reimbursedAt: new Date('2026-10-25T01:00:00Z') }),
  },
  {
    name: '증빙 20장',
    expected: cells(null, null, null, 'EVIDENCE_LIMIT'),
    build: async t => {
      const id = await t.expense(payer(t))
      for (let n = 0; n < EVIDENCE_MAX; n += 1) await t.evidence(id)
      return id
    },
  },
  {
    name: '완료한 행사',
    expected: same(COMPLETED),
    build: (t, { done }) => t.expense({ ...payer(t), eventId: done }),
  },
  {
    name: '공개한 기간(취소만 막힌다)',
    expected: cells('PERIOD_CLOSED', null, null, null),
    build: (t, { closedPeriodDay }) => t.expense({ ...payer(t), paidAt: closedPeriodDay }),
  },
  {
    name: '완료한 행사, 공개한 기간(행사 완료가 먼저다)',
    expected: same(COMPLETED),
    build: (t, { done, closedPeriodDay }) =>
      t.expense({ ...payer(t), eventId: done, paidAt: closedPeriodDay }),
  },
]

const root = (t: SettlementKit) => `/api/organizations/${t.council.councilId}/expenses`
const codeOf = async (response: Response) =>
  response.ok ? null : ((await response.json()) as { error: string }).error

// 증빙 붙이기는 올리기 주소를 받아 객체를 두고 붙인다. 주소를 받는 것도 재정부만이라 403이면 거기서 멈춘다.
async function attach(t: SettlementKit, id: string, user: string) {
  const issued = await t.api.post(`${root(t)}/${id}/uploads`, {}, user)
  if (!issued.ok) return codeOf(issued)
  const { key } = (await issued.json()) as PhotoUploadResponse
  t.store.put(key)
  return codeOf(await t.api.post(`${root(t)}/${id}/evidence`, { key }, user))
}

const WRITE: Record<
  ExpenseAction,
  (t: SettlementKit, id: string, user: string) => Promise<string | null>
> = {
  'expense.cancel': async (t, id, user) =>
    codeOf(await t.api.post(`${root(t)}/${id}/cancel`, { reason: '잘못 적음' }, user)),
  'expense.reimburse': async (t, id, user) =>
    codeOf(await t.api.post(`${root(t)}/${id}/reimburse`, {}, user)),
  'expense.update': async (t, id, user) =>
    codeOf(await t.api.post(`${root(t)}/${id}`, { reason: '바뀐 사유' }, user)),
  'expense.attach_evidence': (t, id, user) => attach(t, id, user),
}

test(
  '상태 × 사람 × 동작: 읽기 actions에 있으면 쓰기가 성공하고, 없으면 403이나 그 칸의 코드로 거절된다',
  withSettlement(async t => {
    assert.deepEqual(
      Object.keys(WRITE).sort(),
      [...EXPENSE_ACTIONS].sort(),
      '표 열이 목록과 다르다',
    )
    const done = await t.event()
    await t.completion(done, 'completed', new Date('2026-10-24T03:00:00Z'))
    // 오늘이 든 기간과 겹치지 않는 지난 기간을 공개한다.
    const past = await t.make(t.council, 'fiscal_period', {
      name: '2026-1',
      startsOn: '2026-03-01',
      endsOn: '2026-08-31',
    })
    await t.make(t.council, 'account_closing', {
      fiscalPeriodId: past,
      publishedAt: new Date('2026-09-05T00:00:00Z'),
    })
    const ids = { done, closedPeriodDay: new Date('2026-05-10T03:00:00Z') }
    for (const state of STATES)
      for (const person of Object.keys(PEOPLE) as Person[])
        for (const action of EXPENSE_ACTIONS) {
          const cell = `${state.name} ${person} ${action}`
          const id = await state.build(t, ids)
          const user = PEOPLE[person]
          const read = (await (await t.api.get(`${root(t)}/${id}`, user)).json()) as ExpenseResponse
          const expected = person === '재정부' ? state.expected[action] : FORBIDDEN
          assert.equal(read.expense.actions.includes(action), expected === null, `${cell} actions`)
          assert.equal(await WRITE[action](t, id, user), expected, `${cell} 쓰기`)
        }
  }),
)
