import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clockNow } from '../records/records.js'
import { earn, readClosing, spend } from '../test-support/closing.js'
import { withSettlement } from '../test-support/settlement.js'

// 결산서 숫자(기능 009 조각 3). 기간은 2026-09-01~2027-02-28이다.

test(
  '결제 시각의 한국 날짜가 기간 안인 지출만 든다: 시작 -1초와 끝 +1초는 빠지고 경계 안은 든다',
  withSettlement(async t => {
    const { period } = await t.budgetOf()
    await spend(t, '2026-08-31T14:59:59Z', 1) // 한국 8/31 23:59:59
    await spend(t, '2026-08-31T15:00:00Z', 10) // 한국 9/1 00:00:00
    await spend(t, '2027-02-28T14:59:59Z', 100) // 한국 2/28 23:59:59
    await spend(t, '2027-02-28T15:00:00Z', 1000) // 한국 3/1 00:00:00
    const closing = await readClosing(t, period)
    assert.equal(closing.expense.total, 110)
    assert.equal(closing.expense.noItem, 110)
  }),
)

test(
  '취소한 지출과 수입은 뺀다. 다른 학생회의 지출과 수입은 들지 않는다',
  withSettlement(async t => {
    const { period } = await t.budgetOf()
    await spend(t, '2026-10-20T00:00:00Z', 500)
    await spend(t, '2026-10-20T00:00:00Z', 7, { cancelledAt: clockNow })
    await earn(t, period, 3000)
    await earn(t, period, 11, { cancelledAt: clockNow })
    // 앞 기간의 수입은 이 기간 결산서에 들지 않는다
    const old = await t.make(t.council, 'fiscal_period', {
      name: '2026-1',
      startsOn: '2026-03-01',
      endsOn: '2026-08-31',
    })
    await earn(t, old, 99, { receivedOn: '2026-05-01' })
    // 다른 학생회의 지출·수입
    const theirs = await t.budgetOf(t.other)
    const theirAccount = await t.make(t.other, 'account', {
      name: '다른 통장',
      bank: '국민',
      accountNumber: '999',
      holder: '다른 학생회',
      type: 'main',
    })
    const theirExpense = await t.expense(
      { amount: '123456', paidAt: new Date('2026-10-20T00:00:00Z'), accountId: theirAccount },
      t.other,
    )
    const theirEvidence = await t.make(t.other, 'evidence', {
      expenseId: theirExpense,
      type: 'receipt',
    })
    await t.make(t.other, 'file', {
      name: 'evidence.jpg',
      mediaType: 'image/jpeg',
      sizeBytes: 4321,
      storageKey: `k-${theirEvidence}`,
      attachedToId: theirEvidence,
    })
    await t.make(t.other, 'income', {
      fiscalPeriodId: theirs.period,
      source: 'fee',
      amount: '654321',
      receivedOn: '2026-10-21',
    })
    const closing = await readClosing(t, period)
    assert.equal(closing.expense.total, 500)
    assert.equal(closing.income.total, 3000)
    assert.equal(closing.remaining, 2500)
    // 다른 학생회의 지출·계좌·사진은 점검, 내보내기 정보, 계좌 줄에 들지 않는다
    assert.deepEqual(
      closing.checks.map(check => [check.kind, check.count]),
      [
        ['no_evidence', 1],
        ['no_reason', 0],
        ['unreimbursed', 0],
        ['no_account', 1],
        ['no_item', 1],
        ['other_period_item', 0],
      ],
    )
    assert.deepEqual(closing.exportInfo, {
      expenseCount: 1,
      incomeCount: 1,
      photoCount: 0,
      photoBytes: 0,
      tooLarge: false,
    })
    assert.deepEqual(
      closing.accounts.map(line => line.account),
      [null],
    )
  }),
)

test(
  '예산 항목별 예산·결산·차이·집행률, 항목 없음, 다른 기간 항목, 결제 내역의 품목 항목',
  withSettlement(async t => {
    const { period, budget } = await t.budgetOf()
    const rent = await t.budgetItem(budget, { purpose: '대관', amount: '200000' })
    await t.budgetItem(budget, { purpose: '예비', amount: '0' })
    const fund = await t.budgetItem(budget, {
      type: 'income',
      purpose: '학생회비',
      amount: '50000',
    })
    // 다른 기간(앞)의 예산 항목
    const old = await t.make(t.council, 'fiscal_period', {
      name: '2026-1',
      startsOn: '2026-03-01',
      endsOn: '2026-08-31',
    })
    const oldBudget = await t.make(t.council, 'budget', { fiscalPeriodId: old })
    const oldItem = await t.budgetItem(oldBudget, { purpose: '지난 비품' })
    await spend(t, '2026-10-20T00:00:00Z', 30000, { budgetItemId: rent })
    await spend(t, '2026-10-21T00:00:00Z', 5000)
    await spend(t, '2026-10-22T00:00:00Z', 400, { budgetItemId: oldItem })
    // 결제 내역이 있는 지출은 품목의 예산 항목으로 센다
    const { line } = await t.requestWithItem(null)
    await t.pg.query('UPDATE line_item SET budget_item_id = $1 WHERE id = $2', [rent, line])
    await t.approve(line)
    const paid = await spend(t, '2026-10-23T00:00:00Z', 20000)
    await t.pay(paid, line, '20000')
    await earn(t, period, 40000, { budgetItemId: fund })
    await earn(t, period, 6000, { source: 'grant' })
    const { expense, income } = await readClosing(t, period)
    assert.deepEqual(
      expense.items.map(i => [i.purpose, i.budget, i.actual, i.difference, i.rate]),
      [
        ['대관', 200000, 50000, 150000, 25],
        ['예비', 0, 0, 0, null],
      ],
    )
    assert.deepEqual([expense.noItem, expense.otherPeriod, expense.total], [5000, 400, 55400])
    assert.deepEqual(
      income.items.map(i => [i.purpose, i.budget, i.actual, i.difference]),
      [['학생회비', 50000, 40000, -10000]],
    )
    assert.deepEqual([income.noItem, income.total], [6000, 46000])
  }),
)

test(
  '참가비 줄은 참가비 수입 합 그대로다(환불을 다시 빼지 않는다). 이월금은 수입 합에 들고 따로 보인다',
  withSettlement(async t => {
    const { period } = await t.budgetOf()
    const ev = await t.event()
    const f = await t.form(ev)
    // 입금 5000 가운데 2000을 환불: 참가비 수입은 이미 3000이다(DEC-68)
    const r = await t.registration(f)
    await t.deposit(r, { amount: '5000', refundedAt: clockNow, refundAmount: '2000' })
    await earn(t, period, 3000, { source: 'participation_fee', description: '봄 축제 참가비' })
    await earn(t, period, 10000, { source: 'carryover', receivedOn: '2026-09-01' })
    await spend(t, '2026-10-20T00:00:00Z', 4000)
    const { income, remaining } = await readClosing(t, period)
    assert.deepEqual(
      income.bySource.map(s => [s.source, s.count, s.amount]),
      [
        ['carryover', 1, 10000],
        ['participation_fee', 1, 3000],
      ],
    )
    assert.deepEqual([income.carryover, income.noItem, income.total], [10000, 3000, 13000])
    assert.equal(remaining, 9000)
  }),
)

test(
  '계좌별: 닫은 계좌도 보이고 계좌 미지정 줄이 있으며 이월금은 계좌 줄에 없다',
  withSettlement(async t => {
    const { period } = await t.budgetOf()
    const open = await t.make(t.council, 'account', {
      name: '대표',
      bank: '국민',
      accountNumber: '111',
      holder: '학생회',
      type: 'main',
    })
    const closed = await t.make(t.council, 'account', {
      name: '옛 통장',
      bank: '국민',
      accountNumber: '222',
      holder: '학생회',
      type: 'main',
      closedOn: '2026-09-30',
    })
    await earn(t, period, 8000, { accountId: open })
    await earn(t, period, 2000, { accountId: closed })
    await earn(t, period, 500)
    await earn(t, period, 70000, { source: 'carryover', receivedOn: '2026-09-01' })
    await spend(t, '2026-10-20T00:00:00Z', 3000, { accountId: open })
    await spend(t, '2026-10-20T00:00:00Z', 40)
    const { accounts } = await readClosing(t, period)
    assert.deepEqual(
      accounts.map(a => [
        a.account?.name ?? null,
        a.account?.closed ?? null,
        a.income,
        a.expense,
        a.difference,
      ]),
      [
        ['대표', false, 8000, 3000, 5000],
        ['옛 통장', true, 2000, 0, 2000],
        [null, null, 500, 40, 460],
      ],
    )
  }),
)

test(
  '점검: 증빙·사유·환급·계좌·예산 항목이 빠진 지출과 다른 기간 항목. 취소한 지출과 기간 밖 지출은 세지 않는다',
  withSettlement(async t => {
    const { period, budget } = await t.budgetOf()
    const item = await t.budgetItem(budget, { purpose: '대관' })
    const bank = await t.make(t.council, 'account', {
      name: '대표',
      bank: '국민',
      accountNumber: '111',
      holder: '학생회',
      type: 'main',
    })
    const old = await t.make(t.council, 'fiscal_period', {
      name: '2026-1',
      startsOn: '2026-03-01',
      endsOn: '2026-08-31',
    })
    const oldItem = await t.budgetItem(
      await t.make(t.council, 'budget', { fiscalPeriodId: old }),
      {},
    )
    const ok = await spend(t, '2026-10-20T00:00:00Z', 100, {
      budgetItemId: item,
      accountId: bank,
      paidBy: t.council.people.planningMember.memberId,
      reimbursedAt: clockNow,
    })
    await t.evidence(ok)
    await spend(t, '2026-10-20T00:00:00Z', 200, { reason: '  ' })
    await spend(t, '2026-10-20T00:00:00Z', 300, { budgetItemId: oldItem, accountId: bank })
    await spend(t, '2026-10-20T00:00:00Z', 150, { accountId: bank })
    await spend(t, '2026-10-20T00:00:00Z', 400, {
      paidBy: t.council.people.planningMember.memberId,
    })
    await spend(t, '2026-10-20T00:00:00Z', 500, { cancelledAt: clockNow })
    await spend(t, '2027-03-01T00:00:00Z', 600)
    const closing = await readClosing(t, period)
    const counts = Object.fromEntries(closing.checks.map(c => [c.kind, c.count]))
    assert.deepEqual(counts, {
      no_evidence: 4,
      no_reason: 1,
      unreimbursed: 1,
      no_account: 2,
      no_item: 3,
      other_period_item: 1,
    })
    const reasonless = closing.checks.find(c => c.kind === 'no_reason')
    assert.deepEqual(
      reasonless?.targets.map(target => target.type === 'expense' && target.amount),
      [200],
    )
  }),
)
