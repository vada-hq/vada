import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { ChatMessage, EventDetail, TaskDetail } from '@vada/contracts'
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
const messages = (t: SettlementKit) => count(t, 'SELECT count(*) AS n FROM message')

test(
  '공지방에 taskId를 주어 보내면 보통 메시지가 생기고 업무가 notice_posted로 끝나며 다시 옮기지 않는다',
  withSettlement(async t => {
    const room = await roomOf(t, 'all_members')
    const taskId = await taskFor(t)
    // 회장단이 아닌 담당자도 올린다(공지방에는 모두가 보낸다, DEC-90).
    const response = await send(t, room, { body: '내일 총회', taskId }, PLANNER)
    assert.equal(response.status, 201)
    const sent = (await response.json()) as ChatMessage
    assert.equal(await count(t, `SELECT count(*) AS n FROM message WHERE is_notice`), 0)
    assert.equal(await statusOf(t, taskId), 'done')
    assert.deepEqual(await lastVersion(t, taskId), { changed_by: null, reason: 'notice_posted' })
    assert.deepEqual(await resultsOf(t, taskId), [
      { kind: 'message', title: '내일 총회', stage: 'finished' },
    ])
    // 사람이 할 일로 되돌리면 그대로 둔다(공지에서 빠지는 길은 없고 단계도 그대로다).
    assert.equal((await setStatus(t, taskId, 'todo')).status, 200)
    assert.equal((await send(t, room, { body: '다른 글' })).status, 201)
    assert.equal(await statusOf(t, taskId), 'todo')
    assert.equal((await resultsOf(t, taskId))[0]!.stage, 'finished')
    assert.ok(sent.id)
  }),
)

test(
  '업무 공지는 공지방에서만 받는다: 다른 방이면 400, notice 키는 400, 상태를 바꿀 수 없는 운영진은 409, 다른 학생회는 403, 로그인 전은 401',
  withSettlement(async t => {
    const room = await roomOf(t, 'all_members')
    const taskId = await taskFor(t)
    const baseline = await messages(t)
    const leadership = await roomOf(t, 'leadership')
    const planning = (
      await t.pg.query<{ id: string }>(
        `SELECT cr.id FROM chat_room cr JOIN record r ON r.id = cr.id
          WHERE r.council_id = $1 AND cr.department_id = $2`,
        [t.council.councilId, t.council.departments.planning],
      )
    ).rows[0]!.id
    const leadershipResponse = await send(t, leadership, { body: '공지', taskId })
    assert.equal(leadershipResponse.status, 400)
    assert.equal(await errorOf(leadershipResponse), 'INVALID_INPUT')
    assert.equal((await send(t, planning, { body: '공지', taskId }, PLANNER)).status, 400)
    assert.equal((await send(t, room, { body: '공지', notice: true, taskId })).status, 400)
    assert.equal((await send(t, room, { body: '글', taskId, x: 1 })).status, 400)
    // 담당자도 부장도 아닌 부원은 이 업무의 상태를 바꿀 수 없다.
    const plain = await send(t, room, { body: '공지', taskId }, 's-plain')
    assert.equal(plain.status, 409)
    assert.equal(await errorOf(plain), 'TASK_INVALID')
    assert.equal((await send(t, room, { body: '공지', taskId }, 'o-president')).status, 403)
    const anonymous = await t.api.post(`${councilBase(t)}/rooms/${room}/messages`, {
      body: '공지',
      taskId,
    })
    assert.equal(anonymous.status, 401)
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
      const response = await send(t, room, { body: '공지', taskId })
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
  '업무에서 만든 행사의 책임자는 만든 사람이다: 그 부서 부장이 만들면 부장이 책임자이고, 담당자인 부원은 403이다(DEC-82, DEC-93)',
  withSettlement(async t => {
    const taskId = await taskFor(t, { departmentId: t.council.departments.planning })
    assert.deepEqual((await detailOf(t, taskId, PLANNING_HEAD)).canMake, ['request', 'event'])
    assert.deepEqual((await detailOf(t, taskId, PLANNER)).canMake, ['request'])
    const denied = await t.api.post(
      `${councilBase(t)}/events`,
      { name: '봄 축제', taskId },
      PLANNER,
    )
    assert.equal(denied.status, 403)
    assert.equal(await links(t), 0)
    const response = await t.api.post(
      `${councilBase(t)}/events`,
      { name: '봄 축제', taskId },
      PLANNING_HEAD,
    )
    assert.equal(response.status, 201)
    const { event } = (await response.json()) as { event: EventDetail }
    assert.equal(event.owner?.id, t.council.people.planningHead.memberId)
    assert.equal(await links(t), 1)
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
    assert.equal((await send(t, room, { body: '공지', taskId })).status, 201)
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
    // 담당자는 상태를 바꿀 수 있어 공지방에 올리기는 되지만 행사 권한은 없다.
    assert.deepEqual((await detailOf(t, plain, PLANNER)).canMake, ['request', 'message'])
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
    assert.equal((await send(t, room, { body: '그냥 글' })).status, 201)
    assert.equal((await send(t, room, { body: '또 다른 글' }, PLANNER)).status, 201)
    const versions = `SELECT count(*) AS n FROM record_version WHERE record_id = '${taskId}'`
    assert.equal(await count(t, versions), 1)
  }),
)

test(
  'canMake의 양식은 그 행사의 양식 만들기 권한과 완료 여부를 따른다',
  withSettlement(async t => {
    const eventId = await t.event()
    // 행사 담당 부서도 책임자도 아닌 담당자: 업무에 행사가 있어도 양식 버튼이 없다
    const financeEvent = await taskFor(t, { eventId, departmentId: t.council.departments.finance })
    assert.deepEqual((await detailOf(t, financeEvent, PLANNER)).canMake, ['request', 'message'])
    // 완료한 행사에는 회장도 양식을 만들 수 없다
    const withEvent = await taskFor(t, { eventId })
    assert.ok((await detailOf(t, withEvent)).canMake.includes('registration_form'))
    await t.completion(eventId, 'completed', new Date('2026-10-25T03:00:00Z'))
    assert.ok(!(await detailOf(t, withEvent)).canMake.includes('registration_form'))
  }),
)

test(
  '업무 상세는 볼 수 없는 공지의 첫 줄을 싣지 않는다(다른 기수). 같은 기수면 들어오기 전 것도 싣는다',
  withSettlement(async t => {
    const room = await roomOf(t, 'all_members')
    const taskId = await taskFor(t)
    const sent = (await (
      await send(t, room, { body: '비밀 첫 줄\n둘째 줄', taskId })
    ).json()) as ChatMessage
    assert.equal((await resultsOf(t, taskId))[0]!.title, '비밀 첫 줄')
    // 회장이 이 글 뒤에 들어온 것으로 둔다. 같은 기수의 공지방 글이라 그대로 보인다.
    await t.pg.query(
      `UPDATE room_membership SET joined_at = '2026-10-24T00:00:00Z'
        WHERE room_id = $1 AND member_id = $2`,
      [room, t.council.people.president.memberId],
    )
    await t.pg.query("UPDATE message SET sent_at = '2026-05-01' WHERE id = $1", [sent.id])
    assert.equal((await detailOf(t, taskId)).results[0]!.title, '비밀 첫 줄')
    // 같은 기수여도 그 방의 참여 줄이 없으면 싣지 않는다.
    await t.pg.query(`DELETE FROM room_membership WHERE room_id = $1 AND member_id = $2`, [
      room,
      t.council.people.president.memberId,
    ])
    assert.equal((await detailOf(t, taskId)).results[0]!.title, '')
    // 지난 기수에 보낸 글은 들어오기 전 것이라 보이지 않는다.
    await t.pg.query("UPDATE message SET sent_at = '2020-01-01' WHERE id = $1", [sent.id])
    const [result] = (await detailOf(t, taskId)).results
    assert.equal(result!.kind, 'message')
    assert.equal(result!.title, '')
  }),
)
