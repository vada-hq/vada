import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clockNow } from '../records/records.js'
import { MISSING, withSettlement } from '../test-support/settlement.js'

const ZERO = {
  pending_items: 0,
  unpaid_items: 0,
  no_evidence: 0,
  no_reason: 0,
  unreimbursed: 0,
  refund_pending: 0,
}

test(
  '예산과 실제: 항목마다 쓴 돈(결제 내역과 직접 이은 지출), 지출 합, 참가비, 차이가 정수 원이다',
  withSettlement(async t => {
    const ev = await t.event()
    const { budget, period } = await t.budgetOf()
    const spendItem = await t.budgetItem(budget, { eventId: ev, amount: '100000', purpose: '비품' })
    const incomeItem = await t.budgetItem(budget, {
      eventId: ev,
      type: 'income',
      amount: '30000',
      purpose: '후원',
    })
    // 결제 내역으로 쓴 3000 + 직접 이은 지출 7000
    const { line } = await t.requestWithItem(ev)
    await t.pg.query('UPDATE line_item SET budget_item_id = $1 WHERE id = $2', [spendItem, line])
    await t.approve(line)
    const paid = await t.expense({ eventId: ev, amount: '3000' })
    await t.pay(paid, line, '3000')
    await t.expense({ eventId: ev, amount: '7000', budgetItemId: spendItem })
    // 이 행사가 아닌 지출은 합에 들지 않는다
    await t.expense({ amount: '99999' })
    const otherEvent = await t.event({ name: '다른 행사' })
    await t.expense({ eventId: otherEvent, amount: '88888' })
    // 수입 항목에 이은 수입
    await t.make(t.council, 'income', {
      fiscalPeriodId: period,
      source: 'donation',
      amount: '12000',
      receivedOn: '2026-10-21',
      budgetItemId: incomeItem,
    })
    const f = await t.form(ev)
    const r1 = await t.registration(f)
    const r2 = await t.registration(f)
    await t.deposit(r1, { amount: '5000' })
    await t.deposit(r2, { amount: '5000', refundedAt: clockNow, refundAmount: '2000' })
    const s = await t.settlement(ev)
    assert.equal(s.budget.expense, 100000)
    assert.equal(s.budget.income, 30000)
    assert.deepEqual(
      s.budget.items.map(item => [item.type, item.amount, item.used]),
      [
        ['expense', 100000, 10000],
        ['income', 30000, 12000],
      ],
    )
    assert.equal(s.actual.expense, 10000)
    assert.equal(s.actual.fee, 8000)
    assert.equal(s.actual.depositCount, 2)
    assert.equal(s.difference, 90000)
    assert.equal(typeof s.actual.fee, 'number')
  }),
)

test(
  '남은 것 다섯과 환불 대기: 각각 하나씩 해결하면 그 줄만 빠진다',
  withSettlement(async t => {
    const ev = await t.event()
    // 결재 대기 품목
    const pending = await t.requestWithItem(ev, { title: '대기 요청' })
    // 승인했지만 결제하지 않은 품목
    const unpaid = await t.requestWithItem(ev, { title: '승인 요청' })
    await t.approve(unpaid.line)
    // 증빙, 사유, 환급이 빠진 지출 하나
    const bare = await t.expense({
      eventId: ev,
      reason: null,
      paidBy: t.council.people.planningMember.memberId,
    })
    // 환불 대기 신청
    const f = await t.form(ev)
    const cancelled = await t.registration(f, { cancelledAt: clockNow })
    const refund = await t.deposit(cancelled)
    assert.deepEqual(await t.remainingOf(ev), {
      pending_items: 1,
      unpaid_items: 1,
      no_evidence: 1,
      no_reason: 1,
      unreimbursed: 1,
      refund_pending: 1,
    })
    const first = await t.settlement(ev)
    assert.equal(first.settled, false)
    const titles = (kind: string) =>
      first.remaining
        .find(item => item.kind === kind)
        ?.targets.map(target => (target.type === 'request' ? target.title : target.id))
    assert.deepEqual(titles('pending_items'), ['대기 요청'])
    assert.deepEqual(titles('unpaid_items'), ['승인 요청'])
    assert.deepEqual(titles('no_evidence'), [bare])
    assert.deepEqual(titles('refund_pending'), [])

    await t.pg.query('UPDATE expense SET reimbursed_at = now() WHERE id = $1', [bare])
    assert.deepEqual(await t.remainingOf(ev), { ...(await t.remainingOf(ev)), unreimbursed: 0 })
    assert.equal((await t.remainingOf(ev)).no_reason, 1)
    await t.pg.query("UPDATE expense SET reason = '행사 준비' WHERE id = $1", [bare])
    assert.equal((await t.remainingOf(ev)).no_reason, 0)
    await t.evidence(bare)
    assert.equal((await t.remainingOf(ev)).no_evidence, 0)
    await t.pay(bare, unpaid.line)
    assert.equal((await t.remainingOf(ev)).unpaid_items, 0)
    await t.approve(pending.line, 'rejected')
    assert.equal((await t.remainingOf(ev)).pending_items, 0)
    assert.equal((await t.remainingOf(ev)).refund_pending, 1)
    await t.pg.query('UPDATE deposit SET refunded_at = now(), refund_amount = 5000 WHERE id = $1', [
      refund,
    ])
    assert.deepEqual(await t.remainingOf(ev), ZERO)
    assert.equal((await t.settlement(ev)).settled, true)
  }),
)

test(
  '공백만 있는 사유도 사유가 없는 것으로 센다',
  withSettlement(async t => {
    const ev = await t.event()
    const id = await t.expense({ eventId: ev })
    await t.evidence(id)
    await t.pg.query("UPDATE expense SET reason = '  ' WHERE id = $1", [id])
    assert.equal((await t.remainingOf(ev)).no_reason, 1)
  }),
)

test(
  '취소한 요청·지출·입금은 숫자와 남은 것에서 빠지고, 다른 행사와 상시 지출은 섞이지 않는다',
  withSettlement(async t => {
    const ev = await t.event()
    const elsewhere = await t.event({ name: '다른 행사' })
    const { budget } = await t.budgetOf()
    await t.budgetItem(budget, { eventId: ev, amount: '50000' })
    await t.budgetItem(budget, { eventId: elsewhere, amount: '70000' })
    await t.budgetItem(budget, { amount: '90000' })
    await t.requestWithItem(ev, { cancelledAt: clockNow })
    const unpaid = await t.requestWithItem(elsewhere)
    await t.approve(unpaid.line)
    await t.requestWithItem(null)
    await t.expense({ eventId: ev, amount: '1000', cancelledAt: clockNow, reason: null })
    await t.expense({ eventId: elsewhere, amount: '2000', reason: null })
    await t.expense({ amount: '4000', reason: null })
    const f = await t.form(ev)
    const cancelledRegistration = await t.registration(f, { cancelledAt: clockNow })
    await t.deposit(cancelledRegistration, { cancelledAt: clockNow })
    const live = await t.registration(f)
    await t.deposit(live, { amount: '3000', cancelledAt: clockNow })
    const s = await t.settlement(ev)
    assert.equal(s.budget.expense, 50000)
    assert.equal(s.actual.expense, 0)
    assert.equal(s.actual.fee, 0)
    assert.equal(s.actual.depositCount, 0)
    assert.equal(s.difference, 50000)
    assert.deepEqual(await t.remainingOf(ev), ZERO)
    assert.equal(s.settled, true)
    assert.equal((await t.remainingOf(elsewhere)).unpaid_items, 1)
  }),
)

test(
  '다른 학생회의 기록은 내 행사 정산에 섞이지 않는다(학생회 거르기)',
  withSettlement(async t => {
    const ev = await t.event()
    // 같은 학생회 확인이 막는 연결을 SQL로 억지로 만든다: 다른 학생회의 지출·예산 항목·요청이 우리 행사를 가리킨다.
    const theirs = await t.event({}, t.other)
    const theirExpense = await t.expense({ eventId: theirs, reason: null }, t.other)
    const { budget } = await t.budgetOf(t.other)
    const theirItem = await t.budgetItem(budget, { eventId: theirs, amount: '777' }, t.other)
    const theirRequest = await t.requestWithItem(theirs, {}, t.other)
    await t.pg.query('UPDATE expense SET event_id = $1 WHERE id = $2', [ev, theirExpense])
    await t.pg.query('UPDATE budget_item SET event_id = $1 WHERE id = $2', [ev, theirItem])
    await t.pg.query('UPDATE request SET event_id = $1 WHERE id = $2', [ev, theirRequest.request])
    // 다른 학생회의 신청 양식·환불 대기·입금도 같다(입금 기록은 다른 학생회 신청에 이은 채로 둔다)
    const theirForm = await t.form(theirs, t.other)
    const theirRegistration = await t.registration(theirForm, { cancelledAt: clockNow }, t.other)
    await t.make(t.other, 'deposit', {
      registrationId: theirRegistration,
      amount: '5000',
      confirmedAt: clockNow,
    })
    await t.pg.query('UPDATE registration_form SET event_id = $1 WHERE id = $2', [ev, theirForm])
    const s = await t.settlement(ev)
    assert.equal(s.actual.fee, 0)
    assert.equal(s.actual.depositCount, 0)
    assert.equal(s.actual.expense, 0)
    assert.equal(s.budget.expense, 0)
    assert.deepEqual(await t.remainingOf(ev), ZERO)
  }),
)

test(
  '응답에 신청자 이름과 휴대폰 번호가 없다',
  withSettlement(async t => {
    const ev = await t.event()
    const f = await t.form(ev)
    const cancelled = await t.registration(f, {
      cancelledAt: clockNow,
      name: '홍길동비밀',
      phone: '01099998888',
    })
    await t.deposit(cancelled)
    const text = await (await t.read(ev)).text()
    assert.equal(text.includes('홍길동비밀'), false)
    assert.equal(text.includes('01099998888'), false)
    assert.equal(text.includes('"name":"김학생"'), false)
    assert.equal((await t.remainingOf(ev)).refund_pending, 1)
  }),
)

test(
  '완료 결재는 누가·언제·사유로 오고, 마지막이 완료일 때만 완료다(목록과 상세의 상태도)',
  withSettlement(async t => {
    const ev = await t.event()
    const status = async () => {
      const { events } = (await (await t.api.get(t.base, 's-president')).json()) as {
        events: { id: string; status: string }[]
      }
      const detail = (await (await t.api.get(`${t.base}/${ev}`, 's-president')).json()) as {
        event: { status: string }
      }
      assert.equal(events.find(item => item.id === ev)?.status, detail.event.status)
      return detail.event.status
    }
    assert.equal(await status(), 'ended')
    assert.equal((await t.settlement(ev)).completed, false)
    await t.completion(ev, 'completed', new Date('2026-10-21T00:00:00Z'), '정산 끝')
    assert.equal(await status(), 'completed')
    let s = await t.settlement(ev)
    assert.equal(s.completed, true)
    assert.deepEqual(
      s.approvals.map(a => [a.outcome, a.by?.name, a.reason]),
      [['completed', 's president', '정산 끝']],
    )
    await t.completion(ev, 'completion_cancelled', new Date('2026-10-22T00:00:00Z'), '수정')
    assert.equal(await status(), 'ended')
    s = await t.settlement(ev)
    assert.equal(s.completed, false)
    assert.equal(s.approvals.length, 2)
    await t.completion(ev, 'completed', new Date('2026-10-23T00:00:00Z'))
    assert.equal(await status(), 'completed')
    // 다른 행사의 완료는 섞이지 않는다
    const second = await t.event({ name: '둘째' })
    assert.equal((await t.settlement(second)).completed, false)
  }),
)

test(
  '다른 학생회 행사와 형식이 틀린 번호는 404, 운영진이 아니면 403, 로그인하지 않으면 401이고 no-store다',
  withSettlement(async t => {
    const theirs = await t.event({}, t.other)
    const ev = await t.event()
    assert.equal((await t.read(theirs)).status, 404)
    assert.equal((await t.read(MISSING)).status, 404)
    assert.equal((await t.read('not-a-uuid')).status, 404)
    assert.equal((await t.read(ev, 's-ended')).status, 403)
    assert.equal((await t.read('not-a-uuid', 's-ended')).status, 403)
    assert.equal((await t.read(ev, 'o-president')).status, 403)
    assert.equal((await t.read(ev, '')).status, 401)
    const ok = await t.read(ev, 's-plain')
    assert.equal(ok.status, 200)
    assert.equal(ok.headers.get('cache-control'), 'no-store')
  }),
)
