import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ExpenseDetail, ExpensesResponse } from '@vada/contracts'
import { actorOf } from '../access/actor.js'
import { clockNow, updateRecord } from '../records/records.js'
import { NOON } from '../test-support/events.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'
import { expenseListOf } from './queries.js'

const listOf = async (t: SettlementKit, user = 's-plain') => {
  const response = await t.api.get(`/api/organizations/${t.council.councilId}/expenses`, user)
  assert.equal(response.status, 200)
  return (await response.json()) as ExpensesResponse
}
const departmentsOf = async (t: SettlementKit, user = 's-plain') =>
  Object.fromEntries(
    (await listOf(t, user)).expenses.map(row => [row.id, row.departments.map(d => d.name)]),
  )

test(
  '지출의 부서는 요청을 거친 지출은 요청한 사람, 직접 지출은 부탁한 사람의 지금 부서다',
  withSettlement(async t => {
    const { planning, finance } = t.council.departments
    const people = t.council.people
    const { request, line } = await t.requestWithItem(null)
    const viaRequest = await t.expense({ amount: '15000' })
    await t.pay(viaRequest, line)
    // 같은 요청의 품목 둘을 한 지출로 냈어도 부서와 지출 줄은 하나다.
    const second = await t.make(t.council, 'line_item', {
      requestId: request,
      name: '풀',
      quantity: 1,
    })
    await t.pay(viaRequest, second, '5000')
    const asked = await t.expense({ requestedBy: people.financeMember.memberId })
    // 먼저 낸 사람은 부서를 정하지 않는다.
    const nobody = await t.expense({ paidBy: people.planningMember.memberId })
    const { line: other } = await t.requestWithItem(null, {
      requestedBy: people.financeMember.memberId,
    })
    const both = await t.expense()
    await t.pay(both, line, '5000')
    await t.pay(both, other, '5000')
    assert.deepEqual(await departmentsOf(t), {
      [viaRequest]: ['기획부'],
      [asked]: ['재정부'],
      [nobody]: [],
      [both]: ['기획부', '재정부'],
    })
    const list = await listOf(t)
    assert.equal(list.expenses.length, 4)
    assert.equal(list.expenses.find(row => row.id === viaRequest)?.amount, 15000)
    assert.deepEqual(
      list.allocations?.filter(row => row.expenseId === viaRequest).map(row => row.amount),
      [10000, 5000],
    )
    assert.deepEqual(list.expenses.find(row => row.id === both)?.departments, [
      { id: planning, name: '기획부' },
      { id: finance, name: '재정부' },
    ])
    const response = await t.api.get(
      `/api/organizations/${t.council.councilId}/expenses/${viaRequest}`,
      's-plain',
    )
    const detail = ((await response.json()) as { expense: ExpenseDetail }).expense
    assert.deepEqual(detail.departments, [{ id: planning, name: '기획부' }])
  }),
)

test(
  '겸직이면 부서를 모두 주고, 끝난 소속과 다른 학생회의 부서는 주지 않는다',
  withSettlement(async t => {
    const person = t.council.people.planningMember.memberId
    const { line } = await t.requestWithItem(null)
    const paid = await t.expense()
    await t.pay(paid, line)
    await t.make(t.council, 'department_membership', {
      memberId: person,
      departmentId: t.council.departments.finance,
      cohortId: t.council.cohortId,
      departmentRank: null,
      startsAt: clockNow,
    })
    // 같은 사람이 다른 학생회의 부서에도 있다.
    await t.make(t.other, 'council_membership', {
      memberId: person,
      cohortId: t.other.cohortId,
      councilRank: null,
      startsAt: clockNow,
    })
    await t.make(t.other, 'department_membership', {
      memberId: person,
      departmentId: t.other.departments.planning,
      cohortId: t.other.cohortId,
      departmentRank: null,
      startsAt: clockNow,
    })
    assert.deepEqual(await departmentsOf(t), { [paid]: ['기획부', '재정부'] })
    const [placement] = await t.pg
      .query<{ id: string }>(
        'SELECT id FROM department_membership WHERE member_id = $1 AND department_id = $2',
        [person, t.council.departments.planning],
      )
      .then(result => result.rows)
    await t.db.transaction(tx =>
      updateRecord(tx, {
        kind: 'department_membership',
        id: placement!.id,
        actor: t.council.people.president.memberId,
        reason: null,
        changes: { endsAt: clockNow },
      }),
    )
    assert.deepEqual(await departmentsOf(t), { [paid]: ['재정부'] })
    // 다른 학생회의 목록에는 이 학생회의 지출과 부서가 섞이지 않는다.
    const otherList = await t.api.get(
      `/api/organizations/${t.other.councilId}/expenses`,
      'o-president',
    )
    assert.deepEqual(((await otherList.json()) as ExpensesResponse).expenses, [])
  }),
)

test(
  '같은 학생회의 다른 기수에 끝나지 않은 소속은 지금 부서가 아니다',
  withSettlement(async t => {
    const person = t.council.people.planningMember.memberId
    const { line } = await t.requestWithItem(null)
    const paid = await t.expense()
    await t.pay(paid, line)
    const past = await t.make(t.council, 'cohort', {
      name: '2025',
      startsOn: '2025-01-01',
      endsOn: '2025-12-31',
    })
    await t.make(t.council, 'council_membership', {
      memberId: person,
      cohortId: past,
      councilRank: null,
      startsAt: clockNow,
    })
    await t.make(t.council, 'department_membership', {
      memberId: person,
      departmentId: t.council.departments.finance,
      cohortId: past,
      departmentRank: null,
      startsAt: clockNow,
    })
    assert.deepEqual(await departmentsOf(t), { [paid]: ['기획부'] })
  }),
)

test(
  '부서를 붙여도 목록의 쿼리 수는 지출 하나와 서른에서 같다',
  withSettlement(async t => {
    const actor = (await actorOf(t.db, 's-president', t.council.councilId, NOON))!
    const queries: string[] = []
    const db = t.drizzle({ logger: { logQuery: query => void queries.push(query) } })
    const { line } = await t.requestWithItem(null)
    const first = await t.expense()
    await t.pay(first, line)
    assert.equal((await expenseListOf(db, actor, {})).expenses.length, 1)
    const single = queries.length
    for (let i = 0; i < 29; i++) {
      const { line: more } = await t.requestWithItem(null, {
        requestedBy: t.council.people.financeMember.memberId,
      })
      const paid = await t.expense({ requestedBy: null })
      await t.pay(paid, more)
    }
    queries.length = 0
    const list = await expenseListOf(db, actor, {})
    assert.equal(list.expenses.length, 30)
    assert.ok(list.expenses.every(row => row.departments.length === 1))
    assert.equal(queries.length, single)
  }),
)
