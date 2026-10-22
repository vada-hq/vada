import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHash } from 'node:crypto'
import type { PhotoUploadResponse } from '@vada/contracts'
import { addLink } from '../registrations/link.js'
import { purgeRegistrations } from '../registrations/purge.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'

// 완료한 행사의 기록 잠금(DEC-68)을 모든 경로에 건다. 새 경로를 더하면 이 표에 한 줄을 더한다.
// 확인을 지우면 그 경로의 줄이 실패해야 한다(경로마다 잠금 확인이 있는지 이 표가 본다).

const FINANCE = 's-financeMember'
const PRESIDENT = 's-president'
const OWNER = 's-planningMember'
let tokens = 0
const hashOf = (value: string) => createHash('sha256').update(value).digest('hex')
const DAY = (value: string) => new Date(`${value}:00Z`)
const EXPENSE = { vendor: '문구점', description: '마커', amount: 10000, paidOn: '2026-10-25' }

type Shared = { period: string; budget: string; account: string }
type Scene = Awaited<ReturnType<typeof sceneOf>>

async function sharedOf(t: SettlementKit): Promise<Shared> {
  const { period, budget } = await t.budgetOf()
  const account = await t.make(t.council, 'account', {
    name: '대표',
    bank: '국민은행',
    accountNumber: '123-45-6789012',
    holder: '학생회',
    type: 'main',
  })
  return { period, budget, account }
}

// 완료할 행사 하나와 그 행사에 매인 기록들. 줄마다 새로 만들어 서로 영향을 주지 않는다.
async function sceneOf(t: SettlementKit, shared: Shared) {
  const people = t.council.people
  const event = await t.event({ ownerId: people.planningMember.memberId })
  const item = await t.budgetItem(shared.budget, { eventId: event })
  const pending = await t.requestWithItem(event)
  const approved = await t.requestWithItem(event)
  await t.approve(approved.line)
  const paid = await t.requestWithItem(event)
  await t.approve(paid.line)
  const loose = await t.requestWithItem(null)
  const form = await t.form(event, t.council, {
    payerFee: '5000',
    nonPayerFee: '5000',
    feeAccountId: shared.account,
  })
  const code = (await t.pg.query('SELECT public_code FROM registration_form WHERE id = $1', [form]))
    .rows[0] as { public_code: string }
  const live = await t.registration(form)
  const token = `scene-token-${tokens++}`
  await addLink(t.db, live, token)
  const withDeposit = await t.registration(form)
  await t.deposit(withDeposit, { confirmedAt: DAY('2026-10-20T03:00') })
  const refundable = await t.registration(form)
  await t.deposit(refundable, { confirmedAt: DAY('2026-10-20T03:00') })
  await t.change('registration', refundable, { cancelledAt: DAY('2026-10-21T03:00') })
  const attended = await t.registration(form)
  await t.make(t.council, 'attendance', {
    registrationId: attended,
    confirmedAt: DAY('2026-10-21T03:00'),
    method: 'qr',
  })
  const expenseOfEvent = await t.expense({
    eventId: event,
    paidBy: people.planningMember.memberId,
  })
  const expenseViaLines = await t.expense({ budgetItemId: null })
  await t.pay(expenseViaLines, paid.line)
  return {
    event,
    item,
    pending,
    approved,
    loose,
    form,
    publicCode: code.public_code,
    account: shared.account,
    token,
    live,
    withDeposit,
    refundable,
    attended,
    expenseOfEvent,
    expenseViaLines,
  }
}

const post =
  (t: SettlementKit) =>
  (path: string, body: unknown, user = PRESIDENT) =>
    t.api.post(`/api/organizations/${t.council.councilId}${path}`, body, user)

type Row = [string, (t: SettlementKit, s: Scene) => Promise<Response> | Response]

const rows: Row[] = [
  // 행사
  [
    '행사 고치기',
    (t, s) =>
      post(t)(
        `/events/${s.event}`,
        { name: '바꾼 이름', startsAt: '2026-10-20T09:00', endsAt: null, place: null },
        OWNER,
      ),
  ],
  ['책임자 바꾸기', (t, s) => post(t)(`/events/${s.event}/owner`, { ownerId: null })],
  // 요청
  ['요청 취소', (t, s) => post(t)(`/purchase-requests/${s.pending.request}/cancel`, {}, OWNER)],
  [
    '결재(그 행사 요청)',
    (t, s) =>
      post(t)(
        `/purchase-requests/${s.pending.request}/decisions`,
        {
          decisions: [
            { lineItemId: s.pending.line, outcome: 'approved', amount: 1000, budgetItemId: s.item },
          ],
        },
        FINANCE,
      ),
  ],
  [
    '결재에서 그 행사 예산 항목 고르기',
    (t, s) =>
      post(t)(
        `/purchase-requests/${s.loose.request}/decisions`,
        {
          decisions: [
            { lineItemId: s.loose.line, outcome: 'approved', amount: 1000, budgetItemId: s.item },
          ],
        },
        FINANCE,
      ),
  ],
  // 지출
  [
    '그 행사 품목을 결제하는 지출 적기',
    (t, s) =>
      post(t)(
        '/expenses',
        { ...EXPENSE, lines: [{ lineItemId: s.approved.line, amount: 10000 }] },
        FINANCE,
      ),
  ],
  [
    '그 행사 예산 항목을 고른 지출 적기',
    (t, s) => post(t)('/expenses', { ...EXPENSE, budgetItemId: s.item }, FINANCE),
  ],
  [
    '그 행사 지출 취소',
    (t, s) => post(t)(`/expenses/${s.expenseOfEvent}/cancel`, { reason: '잘못' }, FINANCE),
  ],
  [
    '그 행사 품목을 결제한 지출 취소(지출에는 행사가 없다)',
    (t, s) => post(t)(`/expenses/${s.expenseViaLines}/cancel`, { reason: '잘못' }, FINANCE),
  ],
  ['그 행사 지출 환급', (t, s) => post(t)(`/expenses/${s.expenseOfEvent}/reimburse`, {}, FINANCE)],
  [
    '그 행사 지출 증빙 붙이기',
    async (t, s) => {
      // 올리기 주소는 DB에 쓰지 않아 완료한 행사에서도 받는다.
      const issued = await post(t)(`/expenses/${s.expenseOfEvent}/uploads`, {}, FINANCE)
      assert.equal(issued.status, 200)
      const { key } = (await issued.json()) as PhotoUploadResponse
      t.store.put(key)
      return post(t)(`/expenses/${s.expenseOfEvent}/evidence`, { key }, FINANCE)
    },
  ],
  // 신청 양식(007의 쓰기 경로)
  [
    '양식 만들기',
    (t, s) =>
      post(t)(`/events/${s.event}/registration-forms`, {
        name: '둘째 신청',
        closesAt: '2026-11-01T18:00',
      }),
  ],
  [
    '양식 고치기',
    (t, s) =>
      post(t)(`/registration-forms/${s.form}`, {
        name: '바꾼 신청',
        opensAt: null,
        closesAt: '2026-11-02T18:00',
        capacity: null,
        notice: null,
        collectsPhone: false,
        payerFee: 5000,
        nonPayerFee: 5000,
        feeAccountId: s.account,
      }),
  ],
  ['양식 멈추기', (t, s) => post(t)(`/registration-forms/${s.form}/pause`, {})],
  ['양식 다시 받기', (t, s) => post(t)(`/registration-forms/${s.form}/resume`, {})],
  [
    '공개 신청',
    (t, s) =>
      t.api.post(`/api/public/registration-forms/${s.publicCode}/apply`, { name: '박신청' }),
  ],
  ['스스로 취소', (t, s) => t.api.post('/api/public/registrations/cancel', { token: s.token })],
  ['운영진 취소', (t, s) => post(t)(`/registrations/${s.live}/cancel`, {})],
  ['QR 출석', (t, s) => post(t)(`/events/${s.event}/check-in`, { tokenHash: hashOf(s.token) })],
  ['이름 출석', (t, s) => post(t)(`/registrations/${s.live}/attendance`, {})],
  ['출석 취소', (t, s) => post(t)(`/registrations/${s.attended}/attendance/cancel`, {})],
  // 입금과 환불
  ['입금 확인', (t, s) => post(t)(`/registrations/${s.live}/deposit`, {})],
  [
    '입금 확인 취소',
    (t, s) => post(t)(`/registrations/${s.withDeposit}/deposit/cancel`, { reason: '잘못' }),
  ],
  ['환불함', (t, s) => post(t)(`/registrations/${s.refundable}/refund`, {}, FINANCE)],
]

const errorOf = async (response: Response) => ((await response.json()) as { error?: string }).error

const writes = async (t: SettlementKit) =>
  JSON.stringify([
    (await t.pg.query('SELECT count(*)::int AS n FROM record')).rows,
    (await t.pg.query('SELECT count(*)::int AS n FROM record_version')).rows,
  ])

test(
  '완료한 행사에서 잠금 범위의 모든 쓰기 경로는 409 EVENT_COMPLETED이고 아무것도 쓰지 않으며, 완료를 취소하면 다시 된다',
  withSettlement(async t => {
    const shared = await sharedOf(t)
    for (const [name, run] of rows) {
      const s = await sceneOf(t, shared)
      await t.completion(s.event, 'completed', DAY('2026-10-24T03:00'))
      const before = await writes(t)
      const locked = await run(t, s)
      assert.equal(locked.status, 409, name)
      assert.equal(await errorOf(locked), 'EVENT_COMPLETED', name)
      assert.equal(await writes(t), before, `${name}: 기록이 남았다`)
      await t.completion(s.event, 'completion_cancelled', DAY('2026-10-24T04:00'), '되돌림')
      const reopened = await run(t, s)
      assert.ok(reopened.status < 400, `${name}: 완료 취소 뒤 ${reopened.status}`)
    }
  }),
)

test(
  '완료한 행사에서도 잠금 밖은 된다: 업무 쓰기, 기한 지우기, 학생회비 명단, 모든 읽기',
  withSettlement(async t => {
    const s = await sceneOf(t, await sharedOf(t))
    await t.completion(s.event, 'completed', DAY('2026-10-24T03:00'))
    const created = await post(t)('/tasks', { title: '현수막', eventId: s.event })
    assert.equal(created.status, 201)
    const fee = await post(t)(
      '/fee-payments',
      { paidFrom: '2026-03-01', paidUntil: '2026-08-31', students: '202612345' },
      FINANCE,
    )
    assert.equal(fee.status, 200)
    // 기한 지우기는 행사 상태를 보지 않고 돈다(DEC-55의 보관 기간).
    await t.db.transaction(tx => purgeRegistrations(tx, new Date('2030-01-01T00:00:00Z')))
    const [after] = (await t.pg.query('SELECT name FROM registration WHERE id = $1', [s.live]))
      .rows as { name: string | null }[]
    assert.equal(after?.name, null)
    for (const path of [
      `/events/${s.event}`,
      `/events/${s.event}/settlement`,
      `/events/${s.event}/registration-forms`,
      `/registration-forms/${s.form}/applicants`,
      `/purchase-requests/${s.pending.request}`,
      `/expenses/${s.expenseOfEvent}`,
    ]) {
      const response = await t.api.get(
        `/api/organizations/${t.council.councilId}${path}`,
        PRESIDENT,
      )
      assert.equal(response.status, 200, path)
    }
  }),
)

test(
  '다른 행사와 완료하지 않은 행사는 잠기지 않는다: 완료한 행사의 줄은 그 행사에만 걸린다',
  withSettlement(async t => {
    const shared = await sharedOf(t)
    const locked = await sceneOf(t, shared)
    const open = await sceneOf(t, shared)
    await t.completion(locked.event, 'completed', DAY('2026-10-24T03:00'))
    const response = await post(t)(`/registrations/${open.live}/deposit`, {})
    assert.equal(response.status, 201)
    const update = await post(t)(
      `/events/${open.event}`,
      { name: '열린 행사', startsAt: '2026-10-20T09:00', endsAt: null, place: null },
      OWNER,
    )
    assert.equal(update.status, 200)
  }),
)
