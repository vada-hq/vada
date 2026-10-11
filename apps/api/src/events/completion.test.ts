import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { EventCompletionResponse, EventResponse, EventsResponse, TaskResponse } from '@vada/contracts'
import { setupPurchases } from '../purchases/test-setup.js'

// 학생회 a: 기획부 p·q, 총무부(구매 승인) f, 회장단 l, 미배정 n. 학생회 b: x. 행사 e·e2(a), ex(b).
type Env = Awaited<ReturnType<typeof setupPurchases>>
async function refused(pending: Response | Promise<Response>, status: number, error: string) {
  const response = await pending
  assert.equal(response.status, status, error)
  assert.deepEqual(await response.json(), { error })
}
// 정산은 settlement 테스트가 본다. 여기서는 정산한 상태만 만든다.
const settle = (env: Env, event = 'e') =>
  env.pg.query(`INSERT INTO event_finances(event_id, organization_id, settled_at, settled_by) VALUES ($1, 'a', now(), 'f')`, [event])
const complete = (env: Env, version = 1, event = 'e') => env.request('POST', `/events/${event}/completion`, { version })
const cancel = (env: Env, version: number, event = 'e') => env.request('POST', `/events/${event}/completion/cancel`, { version })
const expense = { eventId: 'e', vendor: '쿠팡', description: '물품', amount: 1000, paidOn: '2026-10-09', method: 'council_card',
  payerMembershipId: 'mf', note: null, itemIds: [], budgetLineId: null }

test('회장단은 정산한 행사를 완료하고 완료를 취소한다. 행사 목록이 완료 시각을 준다', async () => {
  const env = await setupPurchases()
  try {
    await settle(env)
    env.as('l')
    const done = (await env.ok<EventResponse>(complete(env))).event
    assert.ok(done.completedAt)
    assert.equal(done.version, 2)
    const list = await env.ok<EventsResponse>(env.request('GET', '/events'))
    assert.equal(list.events.find(event => event.id === 'e')?.completedAt, done.completedAt)
    assert.equal(list.events.find(event => event.id === 'e2')?.completedAt, null)
    const back = (await env.ok<EventResponse>(cancel(env, 2))).event
    assert.equal(back.completedAt, null)
    assert.equal(back.version, 3)
    const { rows } = await env.pg.query<{ completed_by: string | null }>(`SELECT completed_by FROM events WHERE id = 'e'`)
    assert.equal(rows[0]!.completed_by, null)
  } finally { await env.pg.close() }
})

test('정산하지 않은 행사는 완료하지 않고, 버전이 다르거나 이미 그 상태면 거절한다', async () => {
  const env = await setupPurchases()
  try {
    env.as('l')
    await refused(complete(env), 409, 'EVENT_NOT_SETTLED')
    await settle(env)
    await refused(complete(env, 2), 409, 'VERSION_CONFLICT')
    await refused(cancel(env, 1), 409, 'INVALID_STATE')
    await env.ok(complete(env))
    await refused(complete(env, 2), 409, 'INVALID_STATE')
    await refused(cancel(env, 1), 409, 'VERSION_CONFLICT')
  } finally { await env.pg.close() }
})

test('회장단만 완료한다. 미인증·다른 학생회·없는 행사는 거절하고 아무것도 바꾸지 않는다', async () => {
  const env = await setupPurchases()
  try {
    await settle(env)
    for (const user of ['p', 'f', 'n']) {
      env.as(user)
      await refused(complete(env), 403, 'FORBIDDEN')
    }
    env.as('x')
    await refused(complete(env), 403, 'FORBIDDEN')
    env.as(null)
    assert.equal((await complete(env)).status, 401)
    env.as('l')
    await refused(complete(env, 1, 'ex'), 404, 'NOT_FOUND')
    await refused(complete(env, 1, 'nope'), 404, 'NOT_FOUND')
    const list = await env.ok<EventsResponse>(env.request('GET', '/events'))
    assert.deepEqual(list.events.filter(event => event.completedAt).map(event => event.id), [])
  } finally { await env.pg.close() }
})

test('완료 본문은 버전 하나만 받는다', async () => {
  const env = await setupPurchases()
  try {
    await settle(env)
    env.as('l')
    for (const body of [{}, { version: 0 }, { version: 1.5 }, { version: '1' }, { version: 1, extra: true }]) {
      for (const path of ['/events/e/completion', '/events/e/completion/cancel']) await refused(env.request('POST', path, body), 400, 'INVALID_INPUT')
    }
  } finally { await env.pg.close() }
})

test('완료 확인: 정산 여부와 끝나지 않은 업무 수를 구성원 누구나 본다', async () => {
  const env = await setupPurchases()
  try {
    const add = (title: string) => env.request('POST', '/events/e/tasks', { title, description: null, departmentId: null, assigneeMembershipId: null, dueOn: null })
    const first = (await env.ok<TaskResponse>(add('대관'), 201)).task
    await env.ok(add('정산'), 201)
    await env.ok(env.request('POST', `/events/e/tasks/${first.id}/status`, { version: 1, status: 'done' }))
    env.as('n')
    assert.deepEqual(await env.ok<EventCompletionResponse>(env.request('GET', '/events/e/completion')), { settled: false, openTasks: 1 })
    await settle(env)
    assert.deepEqual(await env.ok<EventCompletionResponse>(env.request('GET', '/events/e/completion')), { settled: true, openTasks: 1 })
    await refused(env.request('GET', '/events/ex/completion'), 404, 'NOT_FOUND')
  } finally { await env.pg.close() }
})

test('완료한 행사는 행사 정보를 바꿀 수 없고, 정산 잠금도 완료를 먼저 알린다. 완료를 취소하면 다시 된다', async () => {
  const env = await setupPurchases()
  try {
    await settle(env)
    env.as('l')
    await env.ok(complete(env))
    env.as('p')
    await refused(env.request('PATCH', '/events/e', { version: 2, startsAt: '2999-08-20T10:00', endsAt: null, place: null }), 409, 'EVENT_COMPLETED')
    env.as('f')
    await refused(env.request('POST', '/expenses', expense), 409, 'EVENT_COMPLETED')
    await refused(env.request('POST', '/events/e/finance/reopen', { version: 1, reason: '다시 확인' }), 409, 'EVENT_COMPLETED')
    env.as('l')
    await env.ok(cancel(env, 2))
    env.as('p')
    const updated = (await env.ok<EventResponse>(env.request('PATCH', '/events/e', { version: 3, startsAt: '2999-08-20T10:00', endsAt: null, place: null }))).event
    assert.equal(updated.startsAt, '2999-08-20T10:00')
    env.as('f')
    await refused(env.request('POST', '/expenses', expense), 409, 'EVENT_SETTLED')
  } finally { await env.pg.close() }
})
