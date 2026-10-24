import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { TaskDetail } from '@vada/contracts'
import { clockNow, createRecord } from '../records/records.js'
import {
  ITEM,
  MISSING,
  errorOf,
  runPurchases,
  type PurchaseKit,
} from '../test-support/purchases.js'

const PLANNER = 's-planningMember'
const FINANCE = 's-financeMember'
const PRESIDENT = 's-president'

// 부서 없이 담당자만 둔 업무를 회장이 만든다. 담당자는 그 업무의 상태를 바꿀 수 있다.
async function taskFor(s: PurchaseKit, assignee: 'planningMember' | 'financeMember') {
  const response = await s.api.post(
    `/api/organizations/${s.council.councilId}/tasks`,
    { title: '현수막 사기', assigneeId: s.council.people[assignee].memberId },
    PRESIDENT,
  )
  assert.equal(response.status, 201)
  return ((await response.json()) as { task: TaskDetail }).task.id
}
const tasksBase = (s: PurchaseKit) => `/api/organizations/${s.council.councilId}/tasks`
const detailOf = async (s: PurchaseKit, id: string, user = PRESIDENT) =>
  ((await (await s.api.get(`${tasksBase(s)}/${id}`, user)).json()) as { task: TaskDetail }).task
const statusOf = async (s: PurchaseKit, id: string) =>
  (await s.pg.query<{ status: string }>('SELECT status FROM task WHERE id = $1', [id])).rows[0]!
    .status
const setStatus = (s: PurchaseKit, id: string, status: string, user = PRESIDENT) =>
  s.api.post(`${tasksBase(s)}/${id}/status`, { status }, user)
const links = (s: PurchaseKit) => s.count('SELECT count(*) AS n FROM task_result')
const request = (taskId: string, extra: object = {}) => ({
  title: '현수막',
  items: [ITEM],
  taskId,
  ...extra,
})

test(
  '업무를 이어 요청을 내면 연결이 생기고 할 일이던 업무가 바꾼 사람 없이 진행 중이 된다',
  runPurchases(async s => {
    const taskId = await taskFor(s, 'planningMember')
    const made = await s.made(request(taskId), PLANNER)
    assert.equal(await links(s), 1)
    assert.equal(await statusOf(s, taskId), 'in_progress')
    const detail = await detailOf(s, taskId, PLANNER)
    assert.deepEqual(detail.results, [
      { kind: 'request', id: made.id, title: '현수막', stage: 'in_progress' },
    ])
    assert.deepEqual(detail.canMake, ['request'])
    const last = detail.history.at(-1)!
    assert.equal(last.cause, 'request_submitted')
    assert.equal(last.by, null)
    assert.deepEqual(last.changes, [{ field: 'status', from: 'todo', to: 'in_progress' }])
    assert.equal(detail.history[0]!.cause, null)
    const row = await s.pg.query<{ changed_by: string | null; reason: string | null }>(
      'SELECT changed_by, reason FROM record_version WHERE record_id = $1 AND version_no = 2',
      [taskId],
    )
    assert.deepEqual(row.rows[0], { changed_by: null, reason: 'request_submitted' })
  }),
)

test(
  '이미 진행 중인 업무는 판이 늘지 않고, 업무를 주지 않으면 연결도 판도 없다',
  runPurchases(async s => {
    const taskId = await taskFor(s, 'planningMember')
    await s.made(request(taskId), PLANNER)
    const versions = await s.versions(taskId)
    await s.made(request(taskId, { title: '두 번째' }), PLANNER)
    assert.equal(await links(s), 2)
    assert.equal(await s.versions(taskId), versions)
    await s.made({ title: '마커', items: [ITEM] }, PLANNER)
    assert.equal(await links(s), 2)
  }),
)

test(
  '이을 수 없는 업무는 409 TASK_INVALID이고 요청·품목·알림·연결이 없다',
  runPurchases(async s => {
    const mine = await taskFor(s, 'planningMember')
    const foreign = await s.db.transaction(tx =>
      createRecord(tx, {
        kind: 'task',
        councilId: s.other.councilId,
        actor: s.other.people.president.memberId,
        values: { title: '남의 업무' },
      }),
    )
    const cancelled = await taskFor(s, 'planningMember')
    const done = await taskFor(s, 'planningMember')
    assert.equal(
      (await s.api.post(`${tasksBase(s)}/${cancelled}/delete`, {}, PRESIDENT)).status,
      204,
    )
    assert.equal((await setStatus(s, done, 'done')).status, 200)
    const counts = async () =>
      s.count(
        `SELECT (SELECT count(*) FROM request) + (SELECT count(*) FROM line_item)
              + (SELECT count(*) FROM notification) + (SELECT count(*) FROM task_result) AS n`,
      )
    const baseline = await counts()
    const cases: [string, string, string][] = [
      ['다른 학생회 업무', foreign, PLANNER],
      ['없는 번호', MISSING, PLANNER],
      ['취소한 업무', cancelled, PLANNER],
      ['끝난 업무', done, PLANNER],
      ['업무 상태를 바꿀 수 없는 사람', mine, 's-plain'],
    ]
    for (const [name, taskId, user] of cases) {
      const response = await s.create(request(taskId), user)
      assert.equal(response.status, 409, name)
      assert.equal(await errorOf(response), 'TASK_INVALID', name)
      assert.equal(await counts(), baseline, name)
    }
    assert.equal(await statusOf(s, mine), 'todo')
  }),
)

test(
  '요청을 낼 권한이 없으면 업무가 없어도 403이 먼저다',
  runPurchases(async s => {
    const response = await s.create(request(MISSING), 's-ended')
    assert.equal(response.status, 403)
    assert.equal(await links(s), 0)
  }),
)

test(
  '같은 요청을 두 업무에 이을 수 없고(DB UNIQUE) 종류가 다르면 외래 키가 막는다',
  runPurchases(async s => {
    const first = await taskFor(s, 'planningMember')
    const second = await taskFor(s, 'planningMember')
    const made = await s.made(request(first), PLANNER)
    await assert.rejects(
      s.pg.query(
        `INSERT INTO task_result (task_id, result_id, result_kind) VALUES ($1, $2, 'request')`,
        [second, made.id],
      ),
    )
    await assert.rejects(
      s.pg.query(
        `INSERT INTO task_result (task_id, result_id, result_kind) VALUES ($1, $2, 'message')`,
        [second, made.id],
      ),
    )
    assert.equal(await links(s), 1)
  }),
)

test(
  '재정부가 대신 낸 요청도 만든 사람의 권한으로 잇는다',
  runPurchases(async s => {
    const taskId = await taskFor(s, 'financeMember')
    const planner = s.council.people.planningMember.memberId
    const made = await s.made(request(taskId, { requestedBy: planner }), FINANCE)
    assert.equal(made.requestedBy.id, planner)
    assert.equal(await statusOf(s, taskId), 'in_progress')
    assert.equal(await links(s), 1)
  }),
)

test(
  '결과물 종류가 아닌 쓰기(알림, 업무 고치기)는 업무 판을 늘리지 않는다',
  runPurchases(async s => {
    const taskId = await taskFor(s, 'planningMember')
    await s.made(request(taskId), PLANNER)
    const versions = await s.versions(taskId)
    await s.db.transaction(tx =>
      createRecord(tx, {
        kind: 'notification',
        councilId: s.council.councilId,
        actor: null,
        values: {
          recipientId: s.council.people.planningMember.memberId,
          recordId: taskId,
          type: 'assignment',
          notifiedAt: clockNow,
        },
      }),
    )
    assert.equal(await s.versions(taskId), versions)
    const edit = await s.api.post(
      `${tasksBase(s)}/${taskId}`,
      { title: '고침', body: null, dueDate: null },
      PRESIDENT,
    )
    assert.equal(edit.status, 200)
    assert.equal(await s.versions(taskId), versions + 1)
    assert.equal(await statusOf(s, taskId), 'in_progress')
  }),
)

test(
  '요청 취소와 승인은 단계를 올리지 않아 사람이 되돌린 상태를 덮지 않는다',
  runPurchases(async s => {
    const taskId = await taskFor(s, 'planningMember')
    const first = await s.made(request(taskId), PLANNER)
    await setStatus(s, taskId, 'todo')
    await s.decide(first.items[0]!.id, 'approved')
    assert.equal(await statusOf(s, taskId), 'todo')
    const second = await s.made(request(taskId, { title: '다른 요청' }), PLANNER)
    assert.equal(await statusOf(s, taskId), 'in_progress')
    await setStatus(s, taskId, 'todo')
    assert.equal((await s.api.post(`${s.base}/${second.id}/cancel`, {}, PLANNER)).status, 204)
    assert.equal(await statusOf(s, taskId), 'todo')
    const stages = (await detailOf(s, taskId)).results.map(result => result.stage)
    assert.deepEqual(stages, ['in_progress', 'excluded'])
  }),
)

test(
  '품목이 모두 반려되면 끝남이 되고 까닭은 request_finished다. 결과물이 둘이면 둘 다 끝나야 한다',
  runPurchases(async s => {
    const taskId = await taskFor(s, 'planningMember')
    const first = await s.made(request(taskId), PLANNER)
    const second = await s.made(request(taskId, { title: '둘째' }), PLANNER)
    await s.decide(first.items[0]!.id, 'rejected')
    assert.equal(await statusOf(s, taskId), 'in_progress')
    await s.decide(second.items[0]!.id, 'rejected')
    assert.equal(await statusOf(s, taskId), 'done')
    const detail = await detailOf(s, taskId)
    assert.equal(detail.history.at(-1)!.cause, 'request_finished')
    assert.deepEqual(detail.canMake, [])
  }),
)
