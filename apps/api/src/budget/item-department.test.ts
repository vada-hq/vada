import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { BudgetItemView, BudgetResponse } from '@vada/contracts'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'

// 예산 항목의 담당 부서(부장 홈 '우리 부서가 맡은 예산', 대표 10/30): 더할 때 고르고, 고치기에서 바꾸거나 비운다.
// 같은 학생회의 부서만 되고(아니면 409 DEPARTMENT_INVALID), 바꾼 값은 판에 남는다.

const FINANCE = 's-financeMember'
const MISSING_DEPARTMENT = '01900000-0000-7000-8000-0000000000ff'

const root = (t: SettlementKit) => `/api/organizations/${t.council.councilId}`
const post = (t: SettlementKit, path: string, body: unknown, user = FINANCE) =>
  t.api.post(`${root(t)}${path}`, body, user)
const errorOf = async (response: Response) => ((await response.json()) as { error?: string }).error
const viewOf = async (response: Response) => (await response.json()) as BudgetResponse
const named = (view: BudgetResponse, purpose: string) =>
  view.items.find(item => item.purpose === purpose) as BudgetItemView
const itemCount = async (t: SettlementKit) =>
  Number((await t.pg.query<{ n: string }>('SELECT count(*) AS n FROM budget_item')).rows[0]!.n)
const versionDepartments = async (t: SettlementKit, id: string) =>
  (
    await t.pg.query<{ department: string | null }>(
      `SELECT data->>'department_id' AS department FROM record_version
       WHERE record_id = $1 ORDER BY version_no`,
      [id],
    )
  ).rows.map(row => row.department)

test(
  '더하기: 담당 부서를 고르면 응답과 읽기에 부서 이름표가 오고 판 1에 남는다. 빼면 비고, null도 된다',
  withSettlement(async t => {
    await t.budgetOf()
    const planning = t.council.departments.planning
    const one = await post(t, '/budget-items', {
      purpose: '가을 축제 상금',
      amount: 600000,
      departmentId: planning,
    })
    assert.equal(one.status, 201)
    const prize = named(await viewOf(one), '가을 축제 상금')
    assert.deepEqual(prize.department, { id: planning, name: '기획부' })
    assert.deepEqual(await versionDepartments(t, prize.id), [planning])
    const many = await post(t, '/budget-items/batch', {
      items: [
        { purpose: '홍보비', amount: 1000, departmentId: t.council.departments.finance },
        { purpose: '비품', amount: 1000 },
        { purpose: '예비비', amount: 1000, departmentId: null },
      ],
    })
    assert.equal(many.status, 201)
    const view = await viewOf(many)
    assert.deepEqual(named(view, '홍보비').department, {
      id: t.council.departments.finance,
      name: '재정부',
    })
    assert.equal(named(view, '비품').department, null)
    assert.equal(named(view, '예비비').department, null)
    const read = await viewOf(await t.api.get(`${root(t)}/budget`, 's-plain'))
    assert.deepEqual(read, view)
  }),
)

test(
  '더하기: 다른 학생회의 부서나 없는 부서는 409 DEPARTMENT_INVALID이고 여러 행이면 한 행도 남지 않는다. 모양이 틀리면 400이다',
  withSettlement(async t => {
    await t.budgetOf()
    const good = { purpose: '비품', amount: 1000, departmentId: t.council.departments.planning }
    for (const [label, departmentId] of [
      ['다른 학생회 부서', t.other.departments.planning],
      ['없는 부서', MISSING_DEPARTMENT],
      ['부서가 아닌 기록', t.council.councilId],
    ] as const) {
      const single = await post(t, '/budget-items', { purpose: '상금', amount: 1, departmentId })
      assert.equal(single.status, 409, label)
      assert.equal(await errorOf(single), 'DEPARTMENT_INVALID', label)
      const batch = await post(t, '/budget-items/batch', {
        items: [good, { purpose: '상금', amount: 1, departmentId }],
      })
      assert.equal(await errorOf(batch), 'DEPARTMENT_INVALID', label)
    }
    for (const [label, departmentId] of [
      ['빈 글', ''],
      ['너무 긴 값', `${MISSING_DEPARTMENT}0`],
      ['숫자', 1],
      ['NUL', `${MISSING_DEPARTMENT.slice(0, -1)}\u0000`],
    ] as const) {
      const response = await post(t, '/budget-items', { purpose: '상금', amount: 1, departmentId })
      assert.equal(response.status, 400, label)
      assert.equal(await errorOf(response), 'INVALID_INPUT', label)
    }
    assert.equal(await itemCount(t), 0)
  }),
)

test(
  '고치기: 담당 부서를 바꾸고 비우면 판에 남고, 빼고 보내면 그대로다. 다른 학생회·없는 부서는 409이고 바뀌지 않는다',
  withSettlement(async t => {
    const { budget } = await t.budgetOf()
    const item = await t.budgetItem(budget, { purpose: '상금', amount: '600000' })
    const { planning, finance } = t.council.departments
    const edit = (body: Record<string, unknown>, user = FINANCE) =>
      post(
        t,
        `/budget-items/${item}`,
        { purpose: '상금', amount: 600000, reason: '맡김', ...body },
        user,
      )
    const departmentNow = async () =>
      named(await viewOf(await t.api.get(`${root(t)}/budget`, FINANCE)), '상금').department
    for (const user of ['s-president', 's-planningHead', 'o-financeMember'])
      assert.equal((await edit({ departmentId: planning }, user)).status, 403, user)
    const set = await edit({ departmentId: planning })
    assert.equal(set.status, 200)
    assert.deepEqual(named(await viewOf(set), '상금').department, { id: planning, name: '기획부' })
    assert.equal((await edit({ amount: 500000 })).status, 200)
    assert.deepEqual(await departmentNow(), { id: planning, name: '기획부' })
    for (const departmentId of [t.other.departments.planning, MISSING_DEPARTMENT]) {
      const refused = await edit({ departmentId })
      assert.equal(refused.status, 409)
      assert.equal(await errorOf(refused), 'DEPARTMENT_INVALID')
    }
    assert.deepEqual(await departmentNow(), { id: planning, name: '기획부' })
    assert.equal((await edit({ departmentId: finance })).status, 200)
    assert.equal((await edit({ departmentId: null })).status, 200)
    assert.equal(await departmentNow(), null)
    assert.deepEqual(await versionDepartments(t, item), [null, planning, planning, finance, null])
  }),
)
