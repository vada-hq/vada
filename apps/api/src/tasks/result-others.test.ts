import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ChatMessage, TaskDetail } from '@vada/contracts'
import { createRecord } from '../records/records.js'
import { MISSING, withSettlement, type SettlementKit } from '../test-support/settlement.js'

const PRESIDENT = 's-president'
const PLANNER = 's-planningMember'
const PLANNING_HEAD = 's-planningHead'
const FORM = { name: '신청', closesAt: '2026-11-01T18:00', collectsPhone: false }

const councilBase = (t: SettlementKit) => `/api/organizations/${t.council.councilId}`
const tasksBase = (t: SettlementKit) => `${councilBase(t)}/tasks`
const errorOf = async (response: Response) => ((await response.json()) as { error: string }).error
async function taskFor(t: SettlementKit, extra: object = {}) {
  const response = await t.api.post(
    tasksBase(t),
    { title: '홍보', assigneeId: t.council.people.planningMember.memberId, ...extra },
    PRESIDENT,
  )
  assert.equal(response.status, 201)
  return ((await response.json()) as { task: TaskDetail }).task.id
}
const statusOf = async (t: SettlementKit, id: string) =>
  (await t.pg.query<{ status: string }>('SELECT status FROM task WHERE id = $1', [id])).rows[0]!
    .status
const detailOf = async (t: SettlementKit, id: string, user = PRESIDENT) =>
  ((await (await t.api.get(`${tasksBase(t)}/${id}`, user)).json()) as { task: TaskDetail }).task
const setStatus = (t: SettlementKit, id: string, status: string) =>
  t.api.post(`${tasksBase(t)}/${id}/status`, { status }, PRESIDENT)
const count = async (t: SettlementKit, sql: string) =>
  Number(((await t.pg.query(sql)).rows[0] as { n: string }).n)
const links = (t: SettlementKit) => count(t, 'SELECT count(*) AS n FROM task_result')
const makeForm = (t: SettlementKit, eventId: string, body: object, user = PRESIDENT) =>
  t.api.post(`${councilBase(t)}/events/${eventId}/registration-forms`, { ...FORM, ...body }, user)
const makeEvent = (t: SettlementKit, body: object) =>
  t.api.post(`${councilBase(t)}/events`, { name: '봄 축제', ...body }, PRESIDENT)
const eventIdOf = async (response: Response) =>
  ((await response.json()) as { event: { id: string } }).event.id
const lastVersion = async (t: SettlementKit, id: string) =>
  (
    await t.pg.query<{ changed_by: string | null; reason: string | null }>(
      'SELECT changed_by, reason FROM record_version WHERE record_id = $1 ORDER BY version_no DESC LIMIT 1',
      [id],
    )
  ).rows[0]!
const resultsOf = async (t: SettlementKit, id: string) =>
  (await detailOf(t, id)).results.map(({ kind, title, stage }) => ({ kind, title, stage }))

// 이을 수 없는 업무 넷(다른 학생회, 없는 번호, 취소, 끝남)
async function unlinkable(t: SettlementKit) {
  const foreign = await t.make(t.other, 'task', { title: '남의 업무' })
  const cancelled = await taskFor(t)
  assert.equal((await t.api.post(`${tasksBase(t)}/${cancelled}/delete`, {}, PRESIDENT)).status, 204)
  const done = await taskFor(t)
  assert.equal((await setStatus(t, done, 'done')).status, 200)
  return [
    ['다른 학생회 업무', foreign],
    ['없는 번호', MISSING],
    ['취소한 업무', cancelled],
    ['끝난 업무', done],
  ] as const
}

test(
  '양식 만들기에 taskId를 주면 연결이 생기고 업무가 바꾼 사람 없이 form_created로 끝난다',
  withSettlement(async t => {
    const eventId = await t.event()
    const taskId = await taskFor(t)
    const response = await makeForm(t, eventId, { taskId })
    assert.equal(response.status, 201)
    assert.equal(await links(t), 1)
    assert.equal(await statusOf(t, taskId), 'done')
    assert.deepEqual(await lastVersion(t, taskId), { changed_by: null, reason: 'form_created' })
    assert.deepEqual(await resultsOf(t, taskId), [
      { kind: 'registration_form', title: '신청', stage: 'finished' },
    ])
    assert.equal((await detailOf(t, taskId)).history.at(-1)!.cause, 'form_created')
    // taskId가 없으면 연결도 업무 변화도 없다
    const other = await taskFor(t)
    assert.equal((await makeForm(t, eventId, {})).status, 201)
    assert.equal((await makeForm(t, eventId, { taskId: null })).status, 201)
    assert.equal(await links(t), 1)
    assert.equal(await statusOf(t, other), 'todo')
  }),
)

test(
  '양식에 이을 수 없는 업무는 409 TASK_INVALID이고 양식과 연결이 생기지 않는다',
  withSettlement(async t => {
    const eventId = await t.event()
    const cases = [...(await unlinkable(t))]
    // 이 행사 담당 부서인 부장은 양식을 만들 수 있지만 재정부 업무의 상태는 바꾸지 못한다.
    await taskFor(t, { eventId, departmentId: t.council.departments.planning })
    const financeTask = await taskFor(t, {
      departmentId: t.council.departments.finance,
      assigneeId: null,
    })
    const forms = () => count(t, 'SELECT count(*) AS n FROM registration_form')
    const baseline = await forms()
    for (const [name, taskId] of cases) {
      const response = await makeForm(t, eventId, { taskId })
      assert.equal(response.status, 409, name)
      assert.equal(await errorOf(response), 'TASK_INVALID', name)
    }
    const noStatus = await makeForm(t, eventId, { taskId: financeTask }, PLANNING_HEAD)
    assert.equal(noStatus.status, 409)
    assert.equal(await errorOf(noStatus), 'TASK_INVALID')
    assert.equal(await forms(), baseline)
    assert.equal(await links(t), 0)
    // 양식 자체의 권한(403)이 먼저다
    assert.equal((await makeForm(t, eventId, { taskId: MISSING }, 's-plain')).status, 403)
  }),
)

test(
  '기록 모듈은 다른 학생회 업무에 결과물을 잇지 않는다(서비스 확인과 별개)',
  withSettlement(async t => {
    const foreign = await t.make(t.other, 'task', { title: '남의 업무' })
    const eventId = await t.event()
    const kinds = [
      [
        'registration_form',
        { eventId, name: '신청', closesAt: new Date(), publicCode: 'ZZZZZZZZ' },
      ],
      ['event', { name: '행사' }],
    ] as const
    for (const [kind, values] of kinds) {
      await assert.rejects(
        t.db.transaction(tx =>
          createRecord(tx, {
            kind,
            councilId: t.council.councilId,
            actor: t.council.people.president.memberId,
            taskId: foreign,
            values,
          }),
        ),
        { code: 'TASK_INVALID' },
      )
    }
    assert.equal(await links(t), 0)
    assert.equal(await statusOf(t, foreign), 'todo')
  }),
)

async function roomOf(t: SettlementKit, type: string) {
  await t.api.get(`${councilBase(t)}/rooms`, PRESIDENT)
  const rows = await t.pg.query<{ id: string }>(
    `SELECT cr.id FROM chat_room cr JOIN record r ON r.id = cr.id
      WHERE r.council_id = $1 AND cr.type = $2`,
    [t.council.councilId, type],
  )
  return rows.rows[0]!.id
}
const send = (t: SettlementKit, room: string, body: object, user = PRESIDENT) =>
  t.api.post(`${councilBase(t)}/rooms/${room}/messages`, body, user)
const mark = (t: SettlementKit, id: string, isNotice: boolean) =>
  t.api.post(`${councilBase(t)}/messages/${id}/notice`, { isNotice }, PRESIDENT)
const messages = (t: SettlementKit) => count(t, 'SELECT count(*) AS n FROM message')

test(
  '전체방 공지에 taskId를 주면 업무가 notice_posted로 끝나고 공지를 떼면 결과물이 빠진다',
  withSettlement(async t => {
    const room = await roomOf(t, 'all_members')
    const taskId = await taskFor(t)
    const response = await send(t, room, { body: '내일 총회', notice: true, taskId })
    assert.equal(response.status, 201)
    const sent = (await response.json()) as ChatMessage
    assert.equal(sent.isNotice, true)
    assert.equal(await statusOf(t, taskId), 'done')
    assert.deepEqual(await lastVersion(t, taskId), { changed_by: null, reason: 'notice_posted' })
    assert.deepEqual(await resultsOf(t, taskId), [
      { kind: 'message', title: '내일 총회', stage: 'finished' },
    ])
    // 공지를 떼도 업무는 뒤로 가지 않고 결과물은 빠진다
    assert.equal((await mark(t, sent.id, false)).status, 200)
    assert.equal(await statusOf(t, taskId), 'done')
    assert.equal((await resultsOf(t, taskId))[0]!.stage, 'excluded')
    // 사람이 할 일로 되돌린 뒤 다시 붙이면 다시 끝남이 된다
    assert.equal((await setStatus(t, taskId, 'todo')).status, 200)
    assert.equal((await mark(t, sent.id, true)).status, 200)
    assert.equal(await statusOf(t, taskId), 'done')
    assert.deepEqual(await lastVersion(t, taskId), { changed_by: null, reason: 'notice_posted' })
    // 이미 붙어 있는 공지를 같은 값으로 다시 붙이면 사람이 바꾼 상태를 덮지 않는다
    assert.equal((await setStatus(t, taskId, 'todo')).status, 200)
    assert.equal((await mark(t, sent.id, true)).status, 200)
    assert.equal(await statusOf(t, taskId), 'todo')
  }),
)

test(
  '공지 권한은 그대로다: chat.notice가 없거나 전체방이 아니면 403, notice 없는 taskId는 400',
  withSettlement(async t => {
    const room = await roomOf(t, 'all_members')
    const taskId = await taskFor(t)
    const plain = await send(t, room, { body: '안녕' }, PLANNER)
    assert.equal(plain.status, 201)
    assert.equal(((await plain.json()) as ChatMessage).isNotice, false)
    const baseline = await messages(t)
    assert.equal((await send(t, room, { body: '공지', notice: true }, PLANNER)).status, 403)
    assert.equal((await send(t, room, { body: '공지', notice: true, taskId }, PLANNER)).status, 403)
    const leadership = await roomOf(t, 'leadership')
    assert.equal((await send(t, leadership, { body: '공지', notice: true, taskId })).status, 403)
    assert.equal((await send(t, room, { body: '글', taskId })).status, 400)
    assert.equal((await send(t, room, { body: '글', notice: true, taskId, x: 1 })).status, 400)
    assert.equal(await messages(t), baseline)
    assert.equal(await links(t), 0)
    assert.equal(await statusOf(t, taskId), 'todo')
  }),
)

test(
  '공지에 이을 수 없는 업무는 409 TASK_INVALID이고 메시지와 연결이 생기지 않는다',
  withSettlement(async t => {
    const room = await roomOf(t, 'all_members')
    const cases = await unlinkable(t)
    const baseline = await messages(t)
    for (const [name, taskId] of cases) {
      const response = await send(t, room, { body: '공지', notice: true, taskId })
      assert.equal(response.status, 409, name)
      assert.equal(await errorOf(response), 'TASK_INVALID', name)
    }
    assert.equal(await messages(t), baseline)
    assert.equal(await links(t), 0)
  }),
)

test(
  '행사 만들기에 taskId를 주면 이어지되 업무는 그대로이고, 완료에서 event_completed로 끝난다',
  withSettlement(async t => {
    const taskId = await taskFor(t)
    const response = await makeEvent(t, { taskId })
    assert.equal(response.status, 201)
    const eventId = await eventIdOf(response)
    assert.equal(await links(t), 1)
    assert.equal(await statusOf(t, taskId), 'todo')
    assert.equal((await resultsOf(t, taskId))[0]!.stage, 'none')
    await t.completion(eventId, 'completed', new Date('2026-10-25T03:00:00Z'))
    assert.equal(await statusOf(t, taskId), 'done')
    assert.deepEqual(await lastVersion(t, taskId), { changed_by: null, reason: 'event_completed' })
    // 완료 취소는 뒤로 가지 않는다. 사람이 되돌린 뒤 다시 완료하면 다시 끝남이 된다.
    await t.completion(eventId, 'completion_cancelled', new Date('2026-10-25T04:00:00Z'), '실수')
    assert.equal(await statusOf(t, taskId), 'done')
    assert.equal((await resultsOf(t, taskId))[0]!.stage, 'none')
    assert.equal((await setStatus(t, taskId, 'todo')).status, 200)
    await t.completion(eventId, 'completed', new Date('2026-10-25T05:00:00Z'))
    assert.equal(await statusOf(t, taskId), 'done')
    // 이어지지 않은 행사의 완료는 아무 업무도 건드리지 않는다
    const free = await t.event({ name: '다른 행사' })
    const untouched = await taskFor(t)
    await t.completion(free, 'completed', new Date('2026-10-25T06:00:00Z'))
    assert.equal(await statusOf(t, untouched), 'todo')
  }),
)

test(
  '행사에 이을 수 없는 업무는 409 TASK_INVALID이고 행사와 연결이 생기지 않는다',
  withSettlement(async t => {
    const cases = await unlinkable(t)
    const events = () => count(t, 'SELECT count(*) AS n FROM event')
    const baseline = await events()
    for (const [name, taskId] of cases) {
      const response = await makeEvent(t, { taskId })
      assert.equal(response.status, 409, name)
      assert.equal(await errorOf(response), 'TASK_INVALID', name)
    }
    assert.equal(await events(), baseline)
    assert.equal(await links(t), 0)
  }),
)

test(
  '결과물이 여럿이면 빠지지 않은 것이 모두 끝나야 끝남이다',
  withSettlement(async t => {
    const room = await roomOf(t, 'all_members')
    const taskId = await taskFor(t)
    const eventId = await eventIdOf(await makeEvent(t, { taskId }))
    assert.equal((await send(t, room, { body: '공지', notice: true, taskId })).status, 201)
    // 공지는 끝났지만 행사가 아직이라 업무는 그대로다
    assert.equal(await statusOf(t, taskId), 'todo')
    await t.completion(eventId, 'completed', new Date('2026-10-25T03:00:00Z'))
    assert.equal(await statusOf(t, taskId), 'done')
    assert.equal((await detailOf(t, taskId)).history.at(-1)!.cause, 'event_completed')
  }),
)

test(
  '업무 상세의 canMake는 서버가 정한다: 양식은 업무에 행사가 있을 때만, 끝난 업무는 비어 있다',
  withSettlement(async t => {
    const eventId = await t.event()
    const plain = await taskFor(t)
    const withEvent = await taskFor(t, { eventId })
    assert.deepEqual((await detailOf(t, plain)).canMake, ['request', 'message', 'event'])
    assert.deepEqual((await detailOf(t, withEvent)).canMake, [
      'request',
      'registration_form',
      'message',
      'event',
    ])
    // 담당자는 상태를 바꿀 수 있어도 공지·행사 권한이 없다.
    assert.deepEqual((await detailOf(t, plain, PLANNER)).canMake, ['request'])
    assert.equal((await setStatus(t, plain, 'done')).status, 200)
    assert.deepEqual((await detailOf(t, plain)).canMake, [])
  }),
)

test(
  '결과물에 닿지 않는 쓰기는 업무 판을 늘리지 않는다',
  withSettlement(async t => {
    const room = await roomOf(t, 'all_members')
    const taskId = await taskFor(t)
    await makeForm(t, await t.event(), {})
    assert.equal((await send(t, room, { body: '그냥 글', notice: false })).status, 201)
    const other = await send(t, room, { body: '공지', notice: true })
    await mark(t, ((await other.json()) as ChatMessage).id, false)
    const versions = `SELECT count(*) AS n FROM record_version WHERE record_id = '${taskId}'`
    assert.equal(await count(t, versions), 1)
  }),
)
