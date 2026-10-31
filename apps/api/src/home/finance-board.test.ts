import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { FinanceOverviewResponse, HomeResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'
import { createHomeRoutes } from './routes.js'

const now = new Date('2026-10-25T03:00:00Z')
function reader(t: SettlementKit) {
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      home: createHomeRoutes(t.db, testSession, { clock: () => now }),
    }),
  )
  return async (user = 's-financeMember') => {
    const response = await api.get(`/api/organizations/${t.council.councilId}/home`, user)
    assert.equal(response.status, 200)
    return (await response.json()) as HomeResponse
  }
}

test(
  '홈 재정 요약과 행사별 예산은 재정 개요와 같고 미입력·다른 학생회·기간 없음을 가른다',
  withSettlement(async t => {
    const read = reader(t)
    assert.equal((await read('s-president')).financeSummary?.overview, null)
    const eventId = await t.event({ name: '예산 행사' })
    const missing = await t.event({ name: '미입력 행사', startsAt: null })
    await t.event({ name: '다른 학생회', startsAt: null }, t.other)
    const { budget } = await t.budgetOf()
    await t.budgetItem(budget, { type: 'income', purpose: '학생회비', amount: '1000' })
    const item = await t.budgetItem(budget, { eventId, amount: '2000' })
    await t.expense({ amount: '3000', budgetItemId: item })
    const approved = await t.requestWithItem(eventId)
    await t.pg.query('UPDATE line_item SET amount = $1, budget_item_id = $2 WHERE id = $3', [
      '4000',
      item,
      approved.line,
    ])
    await t.approve(approved.line)
    await t.pay(await t.expense({ amount: '1000' }), approved.line, '1000')
    const other = await t.budgetOf(t.other)
    await t.budgetItem(other.budget, { type: 'income', amount: '9000' }, t.other)
    const finance = await read()
    const leadership = await read('s-president')
    const overview = (
      (await (
        await t.api.get(`/api/organizations/${t.council.councilId}/finance-overview`, 's-president')
      ).json()) as FinanceOverviewResponse
    ).overview!
    const { total, actual, committed, available } = overview
    assert.deepEqual(leadership.financeSummary?.overview, { total, actual, committed, available })
    assert.equal(available, -6000)
    assert.equal(committed, 3000)
    assert.deepEqual(leadership.financeSummary?.missing, [{ id: missing, name: '미입력 행사' }])
    assert.deepEqual(
      finance.financeBoard?.budgets.events
        .filter(row => row.budget !== null)
        .map(row => row.budget),
      overview.events,
    )
    assert.equal(
      finance.financeBoard?.budgets.events.find(row => row.event.id === missing)?.budget,
      null,
    )
    assert.equal(finance.financeBoard?.budgets.total, 2)
    // 홈의 '전체 N개'는 재정 '행사별' 표의 줄 수다.
    assert.deepEqual(overview.missingEvents, leadership.financeSummary?.missing)
    assert.equal(overview.events.length + overview.missingEvents.length, 2)
    assert.equal((await read('s-planningMember')).financeBoard, undefined)
    assert.equal((await read('s-planningMember')).financeSummary, undefined)
  }),
)

test(
  '가까운 품목은 지난 것 포함 14일 경계까지 승인·미결제만, 필요한 때와 요청 순이며 부분 결제도 빠진다',
  withSettlement(async t => {
    const read = reader(t)
    const make = async (title: string, neededBy: string | null, owner = t.council) => {
      const made = await t.requestWithItem(null, { title, neededBy }, owner)
      await t.pg.query('UPDATE line_item SET name = $1 WHERE id = $2', [title, made.line])
      await t.approve(made.line, 'approved', owner)
      return made
    }
    await make('경계', '2026-11-08')
    await make('경계 밖', '2026-11-09')
    await make('지남', '2026-10-24')
    await make('오늘 먼저', '2026-10-25')
    await make('오늘 나중', '2026-10-25')
    await make('날짜 없음', null)
    const foreign = await make('다른 학생회', '2026-10-24', t.other)
    const local = await make('다른 학생회 요청에 잘못 이은 품목', '2026-10-24')
    const localRequest = await t.requestWithItem(null, { neededBy: '2026-10-24' })
    // 양쪽 학생회 조건을 각각 지켜야 한다. 기록의 학생회와 요청의 학생회는 FK가 맞추지 않는다.
    await t.pg.query('UPDATE line_item SET request_id = $1 WHERE id = $2', [
      localRequest.request,
      foreign.line,
    ])
    await t.pg.query('UPDATE line_item SET request_id = $1 WHERE id = $2', [
      foreign.request,
      local.line,
    ])
    const cancelled = await make('취소 요청', '2026-10-25')
    await t.pg.query('UPDATE request SET cancelled_at = now() WHERE id = $1', [cancelled.request])
    const rejected = await make('취소 품목', '2026-10-25')
    await t.approve(rejected.line, 'cancelled')
    const partial = await make('부분 결제', '2026-10-25')
    const expense = await t.expense({ amount: '1' })
    await t.pay(expense, partial.line, '1')
    const nearby = (await read()).financeBoard!.nearby
    assert.equal(nearby.total, 4)
    assert.deepEqual(
      nearby.items.map(row => row.name),
      ['지남', '오늘 먼저', '오늘 나중', '경계'],
    )
    const paid = await t.expense({ amount: '1' })
    await t.pay(paid, nearby.items[0]!.id, '1')
    assert.equal((await read()).financeBoard!.nearby.total, 3)
  }),
)

test(
  '예외 정산은 같은 행사·수이고 겸직 조건은 부서 업무와 내가 책임자인 끝난 행사만 온다',
  withSettlement(async t => {
    const read = reader(t)
    await t.pg.query('UPDATE department_membership SET department_rank = $1 WHERE member_id = $2', [
      'head',
      t.council.people.financeMember.memberId,
    ])
    const ownerId = t.council.people.financeMember.memberId
    const owned = await t.event({
      name: '내 끝난 행사',
      ownerId,
      startsAt: new Date('2026-10-18T00:00:00Z'),
    })
    await t.event({ name: '다른 책임자 행사' })
    await t.event({ name: '남의 행사', ownerId: t.other.people.financeMember.memberId }, t.other)
    await t.make(t.council, 'task', {
      title: '재정 지남',
      departmentId: t.council.departments.finance,
      dueAt: new Date('2026-10-24T14:59:59Z'),
    })
    await t.make(t.council, 'task', {
      title: '타 부서',
      departmentId: t.council.departments.planning,
      dueAt: new Date('2026-10-24T14:59:59Z'),
    })
    const head = (await read()).financeBoard!
    assert.deepEqual(
      head.ownedEnded.map(row => row.event.id),
      [owned],
    )
    assert.deepEqual(
      head.departments.map(row => [row.overdue, row.unassigned]),
      [[1, 1]],
    )
    await t.pg.query(
      'UPDATE department_membership SET department_rank = null WHERE member_id = $1',
      [ownerId],
    )
    const member = (await read()).financeBoard!
    assert.deepEqual(member.departments, [])
    assert.deepEqual(member.ownedEnded, [])
    assert.equal(member.settling.total, 2)
    for (const row of member.settling.events) {
      const original = await t.settlement(row.event.id)
      assert.equal(
        row.settlement.remaining,
        original.remaining.reduce((sum, item) => sum + item.count, 0),
      )
    }
    assert.equal(head.settling.events.find(row => row.event.id === owned)?.endedDays, 7)
  }),
)
