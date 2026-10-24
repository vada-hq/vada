import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { TaskDetail } from '@vada/contracts'
import { clockNow, createRecord } from '../records/records.js'
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
const finishedVersions = (s: PurchaseKit, taskId: string) =>
  s.count(
    "SELECT count(*) AS n FROM record_version WHERE record_id = $1 AND reason = 'request_finished'",
    [taskId],
  )
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
    // 끝남은 한 번만 남고, 무관한 쓰기가 더 있어도 판이 늘지 않는다.
    const versions = await s.versions(taskId)
    assert.equal(await finishedVersions(s, taskId), 1)
    await s.api.post(
      `${tasksBase(s)}/${taskId}`,
      { title: '현수막 다시 사기', body: null, dueDate: null },
      PRESIDENT,
    )
    assert.equal(await s.versions(taskId), versions + 1)
    assert.equal(await finishedVersions(s, taskId), 1)
  }),
)

test(
  '한 지출이 품목을 모두 결제해도 한 번에 끝나고, 끝남을 되돌린 뒤 증빙 붙이기·감사 결재·지출 고치기·결제 취소는 덮지 않는다',
  runPurchases(async s => {
    const { taskId, ids } = await linked(s)
    for (const id of ids) await s.decide(id, 'approved')
    const expenseId = await pay(s, ids)
    assert.equal(await statusOf(s, taskId), 'done')
    assert.equal(await finishedVersions(s, taskId), 1)
    assert.equal((await setStatus(s, taskId, 'todo')).status, 200)
    const versions = await s.versions(taskId)
    const root = `/api/organizations/${s.council.councilId}/expenses/${expenseId}`
    const upload = await s.api.post(`${root}/uploads`, {}, FINANCE)
    const { key } = (await upload.json()) as { key: string }
    s.store.put(key, 1000, 'image/jpeg')
    assert.equal((await s.api.post(`${root}/evidence`, { key }, FINANCE)).status, 201)
    await s.db.transaction(tx =>
      createRecord(tx, {
        kind: 'approval',
        councilId: s.council.councilId,
        actor: s.council.people.financeMember.memberId,
        values: {
          targetId: expenseId,
          targetKind: 'expense',
          outcome: 'approved',
          actorId: s.council.people.financeMember.memberId,
          actorKind: 'member',
          actedAt: clockNow,
          reason: null,
        },
      }),
    )
    assert.equal((await s.api.post(root, { reason: '고침' }, FINANCE)).status, 200)
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
    assert.equal(await finishedVersions(s, taskId), 2)
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
  '결과물이 둘이면 둘 다 결제해야 끝난다',
  runPurchases(async s => {
    const taskId = await taskFor(s)
    const first = await s.made({ ...two, taskId }, PLANNER)
    const second = await s.made({ title: '둘째', items: [ITEM], taskId }, PLANNER)
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
  }),
)

test(
  '마지막 품목이 반려되어도 끝난다: 반려 직전에는 진행 중이고, 모두 반려해도 끝난다',
  runPurchases(async s => {
    const { taskId, ids } = await linked(s)
    await s.decide(ids[0]!, 'approved')
    await pay(s, [ids[0]!])
    assert.equal(await statusOf(s, taskId), 'in_progress')
    await s.decide(ids[1]!, 'rejected')
    assert.equal(await statusOf(s, taskId), 'done')
    assert.equal(await finishedVersions(s, taskId), 1)
    const all = await linked(s)
    await s.decide(all.ids[0]!, 'rejected')
    assert.equal(await statusOf(s, all.taskId), 'in_progress')
    await s.decide(all.ids[1]!, 'rejected')
    assert.equal(await statusOf(s, all.taskId), 'done')
  }),
)

test(
  '취소한 업무는 마지막 결제가 있어도 바뀌지 않는다',
  runPurchases(async s => {
    const { taskId, ids } = await linked(s)
    for (const id of ids) await s.decide(id, 'approved')
    await pay(s, [ids[0]!])
    assert.equal((await s.api.post(`${tasksBase(s)}/${taskId}/delete`, {}, PRESIDENT)).status, 204)
    const versions = await s.versions(taskId)
    await pay(s, [ids[1]!])
    assert.equal(await s.versions(taskId), versions)
    assert.equal(await statusOf(s, taskId), 'in_progress')
  }),
)

test(
  '다른 학생회의 같은 모양 요청이 결제까지 끝나도 내 업무는 그대로고, 그 반대도 같다',
  runPurchases(async s => {
    const mine = await linked(s)
    const foreignTask = await taskFor(s, 'o-president', s.other.councilId)
    const response = await s.api.post(
      `/api/organizations/${s.other.councilId}/purchase-requests`,
      { ...two, taskId: foreignTask },
      'o-planningMember',
    )
    assert.equal(response.status, 201)
    const foreign = await detailOf(response)
    const approver = s.other.people.financeMember.memberId
    for (const item of foreign.items)
      await s.db.transaction(tx =>
        createRecord(tx, {
          kind: 'approval',
          councilId: s.other.councilId,
          actor: approver,
          values: {
            targetId: item.id,
            targetKind: 'line_item',
            outcome: 'approved',
            actorId: approver,
            actorKind: 'member',
            actedAt: clockNow,
            reason: null,
          },
        }),
      )
    for (const id of mine.ids) await s.decide(id, 'approved')
    const versions = await s.versions(mine.taskId)
    await pay(
      s,
      foreign.items.map(item => item.id),
      s.other.councilId,
    )
    assert.equal(await statusOf(s, foreignTask), 'done')
    assert.equal(await statusOf(s, mine.taskId), 'in_progress')
    assert.equal(await s.versions(mine.taskId), versions)
    await pay(s, mine.ids)
    assert.equal(await statusOf(s, mine.taskId), 'done')
    assert.equal(await finishedVersions(s, foreignTask), 1)
  }),
)
