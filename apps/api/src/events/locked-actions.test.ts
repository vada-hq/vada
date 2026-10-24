import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ExpenseResponse, PurchaseRequestResponse } from '@vada/contracts'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'

// 완료한 행사에 매인 지출·요청은 잠금 범위의 동작(취소, 환급, 결재)을 `actions`에 주지 않는다(DEC-68).
// 지출의 행사 판단은 쓰기 잠금과 같은 함수(expenses/event-lock.ts)다.

const FINANCE = 's-financeMember'
const PLANNER = 's-planningMember'
const DAY = (value: string) => new Date(`${value}:00Z`)

const root = (t: SettlementKit) => `/api/organizations/${t.council.councilId}`
const expenseActions = async (t: SettlementKit, id: string) =>
  ((await (await t.api.get(`${root(t)}/expenses/${id}`, FINANCE)).json()) as ExpenseResponse)
    .expense.actions
const requestActions = async (t: SettlementKit, id: string, user: string) =>
  (
    (await (
      await t.api.get(`${root(t)}/purchase-requests/${id}`, user)
    ).json()) as PurchaseRequestResponse
  ).request.actions

test(
  '완료한 행사의 지출은 어떤 경로로 매였든 동작이 비고, 완료를 취소하면 돌아온다',
  withSettlement(async t => {
    const { budget } = await t.budgetOf()
    const event = await t.event()
    const item = await t.budgetItem(budget, { eventId: event })
    const viaEvent = await t.expense({
      eventId: event,
      paidBy: t.council.people.planningMember.memberId,
    })
    const viaItem = await t.expense({ budgetItemId: item })
    const request = await t.requestWithItem(event)
    await t.approve(request.line)
    const viaLine = await t.expense({})
    await t.pay(viaLine, request.line)
    const free = await t.expense({ paidBy: t.council.people.planningMember.memberId })
    const all = [viaEvent, viaItem, viaLine]
    for (const id of all) assert.notDeepEqual(await expenseActions(t, id), [], id)
    await t.completion(event, 'completed', DAY('2026-10-24T03:00'))
    for (const id of all) assert.deepEqual(await expenseActions(t, id), [], id)
    // 행사와 무관한 지출은 그대로다.
    assert.deepEqual(await expenseActions(t, free), [
      'expense.cancel',
      'expense.reimburse',
      'expense.update',
    ])
    await t.completion(event, 'completion_cancelled', DAY('2026-10-24T04:00'), '되돌림')
    for (const id of all) assert.notDeepEqual(await expenseActions(t, id), [], id)
  }),
)

test(
  '완료한 행사의 요청은 취소와 결재 동작이 비고, 다른 행사의 요청은 그대로다',
  withSettlement(async t => {
    const done = await t.event()
    const open = await t.event()
    const inDone = await t.requestWithItem(done)
    const inOpen = await t.requestWithItem(open)
    assert.deepEqual(await requestActions(t, inDone.request, FINANCE), ['purchase_request.decide'])
    assert.deepEqual(await requestActions(t, inDone.request, PLANNER), ['purchase_request.cancel'])
    await t.completion(done, 'completed', DAY('2026-10-24T03:00'))
    assert.deepEqual(await requestActions(t, inDone.request, FINANCE), [])
    assert.deepEqual(await requestActions(t, inDone.request, PLANNER), [])
    assert.deepEqual(await requestActions(t, inOpen.request, FINANCE), ['purchase_request.decide'])
    await t.completion(done, 'completion_cancelled', DAY('2026-10-24T04:00'), '되돌림')
    assert.deepEqual(await requestActions(t, inDone.request, FINANCE), ['purchase_request.decide'])
  }),
)

test(
  '취소한 지출은 고치기 동작이 없고, 고치기는 재정부에게만 보인다',
  withSettlement(async t => {
    const id = await t.expense({})
    const actions = async (user: string) =>
      ((await (await t.api.get(`${root(t)}/expenses/${id}`, user)).json()) as ExpenseResponse)
        .expense.actions
    assert.ok((await actions(FINANCE)).includes('expense.update'))
    assert.ok(!(await actions(PLANNER)).includes('expense.update'))
    const cancel = await t.api.post(
      `${root(t)}/expenses/${id}/cancel`,
      { reason: '잘못 적음' },
      FINANCE,
    )
    assert.equal(cancel.status, 200)
    assert.deepEqual(await actions(FINANCE), [])
  }),
)
