import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { TaskDetail } from '@vada/contracts'
import { ITEM, detailOf, runPurchases, type PurchaseKit } from '../test-support/purchases.js'

const PLANNER = 's-planningMember'
const FINANCE = 's-financeMember'
const PRESIDENT = 's-president'
const two = { title: '마커와 자석', items: [ITEM, { name: '자석', quantity: 2 }] }

const tasksBase = (s: PurchaseKit, councilId = s.council.councilId) =>
  `/api/organizations/${councilId}/tasks`
async function taskFor(s: PurchaseKit, user = PRESIDENT, councilId = s.council.councilId) {
  const person = councilId === s.council.councilId ? s.council : s.other
  const response = await s.api.post(
    tasksBase(s, councilId),
    { title: '현수막 사기', assigneeId: person.people.planningMember.memberId },
    user,
  )
  assert.equal(response.status, 201)
  return ((await response.json()) as { task: TaskDetail }).task.id
}
const statusOf = async (s: PurchaseKit, id: string) =>
  (await s.pg.query<{ status: string }>('SELECT status FROM task WHERE id = $1', [id])).rows[0]!
    .status
const detailOfTask = async (s: PurchaseKit, id: string) =>
  ((await (await s.api.get(`${tasksBase(s)}/${id}`, PRESIDENT)).json()) as { task: TaskDetail })
    .task
const setStatus = (s: PurchaseKit, id: string, status: string) =>
  s.api.post(`${tasksBase(s)}/${id}/status`, { status }, PRESIDENT)

// 지출 적기 API로 품목들을 결제한다(적기가 결제 내역을 만드는 길 그대로). 지출 번호를 돌려준다.
async function pay(s: PurchaseKit, itemIds: string[], councilId = s.council.councilId) {
  const user = councilId === s.council.councilId ? FINANCE : 'o-financeMember'
  const response = await s.api.post(
    `/api/organizations/${councilId}/expenses`,
    {
      vendor: '문구점',
      description: '마커',
      amount: 1000 * itemIds.length,
      paidOn: '2026-10-25',
      lines: itemIds.map(lineItemId => ({ lineItemId, amount: 1000 })),
    },
    user,
  )
  assert.equal(response.status, 201)
  return ((await response.json()) as { expense: { id: string } }).expense.id
}
const cancelExpense = (s: PurchaseKit, id: string) =>
  s.api.post(
    `/api/organizations/${s.council.councilId}/expenses/${id}/cancel`,
    { reason: '잘못 적음' },
    FINANCE,
  )
const cancelItem = (s: PurchaseKit, requestId: string, itemId: string) =>
  s.api.post(`${s.base}/${requestId}/items/${itemId}/cancel`, { reason: '안 사요' }, FINANCE)

async function linked(s: PurchaseKit, body: object = two) {
  const taskId = await taskFor(s)
  const request = await s.made({ ...body, taskId }, PLANNER)
  return { taskId, request, ids: request.items.map(item => item.id) }
}

test(
  '승인만으로는 끝나지 않고 마지막 품목을 결제하는 지출 적기에서 request_finished로 끝난다',
  runPurchases(async s => {
    const { taskId, ids } = await linked(s)
    for (const id of ids) await s.decide(id, 'approved')
    assert.equal(await statusOf(s, taskId), 'in_progress')
    await pay(s, [ids[0]!])
    assert.equal(await statusOf(s, taskId), 'in_progress')
    await pay(s, [ids[1]!])
    assert.equal(await statusOf(s, taskId), 'done')
    const last = (await detailOfTask(s, taskId)).history.at(-1)!
    assert.equal(last.cause, 'request_finished')
    assert.equal(last.by, null)
  }),
)

test(
  '한 지출이 품목을 모두 결제해도 한 번에 끝나고, 끝남을 되돌린 뒤 증빙·지출 고치기·결제 취소는 덮지 않는다',
  runPurchases(async s => {
    const { taskId, ids } = await linked(s)
    for (const id of ids) await s.decide(id, 'approved')
    const expenseId = await pay(s, ids)
    assert.equal(await statusOf(s, taskId), 'done')
    assert.equal((await setStatus(s, taskId, 'todo')).status, 200)
    const versions = await s.versions(taskId)
    const edit = await s.api.post(
      `/api/organizations/${s.council.councilId}/expenses/${expenseId}`,
      { reason: '고침' },
      FINANCE,
    )
    assert.equal(edit.status, 200)
    assert.equal((await cancelExpense(s, expenseId)).status, 200)
    assert.equal(await statusOf(s, taskId), 'todo')
    assert.equal(await s.versions(taskId), versions)
  }),
)

test(
  '지출을 취소해 결제가 없어져도 업무는 뒤로 가지 않고, 다시 결제해 모두 끝나면 다시 끝남이 된다',
  runPurchases(async s => {
    const { taskId, ids } = await linked(s)
    for (const id of ids) await s.decide(id, 'approved')
    const expenseId = await pay(s, ids)
    assert.equal(await statusOf(s, taskId), 'done')
    assert.equal((await cancelExpense(s, expenseId)).status, 200)
    assert.equal(await statusOf(s, taskId), 'done')
    assert.equal((await setStatus(s, taskId, 'in_progress')).status, 200)
    await pay(s, ids)
    assert.equal(await statusOf(s, taskId), 'done')
    assert.equal((await detailOfTask(s, taskId)).history.at(-1)!.cause, 'request_finished')
  }),
)

test(
  '품목 취소(결재 기록 cancelled)도 끝남에 든다: 남은 품목을 결제한 뒤 나머지를 취소하면 끝난다',
  runPurchases(async s => {
    const { taskId, request, ids } = await linked(s)
    for (const id of ids) await s.decide(id, 'approved')
    await pay(s, [ids[0]!])
    assert.equal(await statusOf(s, taskId), 'in_progress')
    const response = await cancelItem(s, request.id, ids[1]!)
    assert.equal(response.status, 200)
    assert.equal(await statusOf(s, taskId), 'done')
    const last = (await detailOfTask(s, taskId)).history.at(-1)!
    assert.equal(last.cause, 'request_finished')
    assert.equal(last.by, null)
  }),
)

test(
  '품목이 모두 취소되면 마지막 취소에서 끝난다',
  runPurchases(async s => {
    const { taskId, request, ids } = await linked(s)
    for (const id of ids) await s.decide(id, 'approved')
    assert.equal((await cancelItem(s, request.id, ids[0]!)).status, 200)
    assert.equal(await statusOf(s, taskId), 'in_progress')
    assert.equal((await cancelItem(s, request.id, ids[1]!)).status, 200)
    assert.equal(await statusOf(s, taskId), 'done')
  }),
)

test(
  '요청을 취소해도 업무는 그대로다',
  runPurchases(async s => {
    const { taskId, request } = await linked(s)
    assert.equal((await s.api.post(`${s.base}/${request.id}/cancel`, {}, PLANNER)).status, 204)
    assert.equal(await statusOf(s, taskId), 'in_progress')
  }),
)

test(
  '결과물이 둘이면 둘 다 결제해야 끝나고, 다른 학생회의 같은 모양 자료는 건드리지 않는다',
  runPurchases(async s => {
    const taskId = await taskFor(s)
    const first = await s.made({ ...two, taskId }, PLANNER)
    const second = await s.made({ title: '둘째', items: [ITEM], taskId }, PLANNER)
    const foreignTask = await taskFor(s, 'o-president', s.other.councilId)
    const foreignResponse = await s.api.post(
      `/api/organizations/${s.other.councilId}/purchase-requests`,
      { title: '남의 요청', items: [ITEM], taskId: foreignTask },
      'o-planningMember',
    )
    assert.equal(foreignResponse.status, 201)
    const foreign = await detailOf(foreignResponse)
    for (const item of [...first.items, ...second.items]) await s.decide(item.id, 'approved')
    await pay(
      s,
      first.items.map(item => item.id),
    )
    assert.equal(await statusOf(s, taskId), 'in_progress')
    await pay(
      s,
      second.items.map(item => item.id),
    )
    assert.equal(await statusOf(s, taskId), 'done')
    assert.equal(await statusOf(s, foreignTask), 'in_progress')
    assert.equal(foreign.items.length, 1)
  }),
)
