import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { HomeResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { origin, setupPurchases } from '../purchases/test-setup.js'
import { refused } from '../registrations/test-setup.js'
import { createHomeRoutes } from './routes.js'

// 학생회 a: 기획부(dp) p·q, 총무부(df, 재정) f, 회장단(dl) l, 미배정 n. 학생회 b: x. 행사 e(체육대회)·e2(축제), ex(b).
// 지금은 한국 2026-10-12 12:00이다.
type Env = Awaited<ReturnType<typeof setupPurchases>>
const NOW = new Date('2026-10-12T03:00:00Z')
function homeApp(env: Env, now = NOW) {
  const session = async () => env.state.userId ? { user: { id: env.state.userId } } : null
  const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, home: createHomeRoutes(env.db, session, { now: () => now }) })
  return (organizationId = 'a') => app.request(`/api/organizations/${organizationId}/home`)
}
const kinds = (home: HomeResponse, kind: string) => home.items.filter(item => item.kind === kind)

test('운영 현황은 구성원 누구나 보고(미배정 포함), 다른 학생회·미인증은 막는다', async () => {
  const env = await setupPurchases()
  try {
    const get = homeApp(env)
    env.as('n')
    const home = await env.ok<HomeResponse>(get())
    assert.equal(home.today, '2026-10-12')
    assert.deepEqual(home.events.map(entry => entry.event.id).sort(), ['e', 'e2'])
    env.as('x')
    await refused(get(), 403, 'FORBIDDEN')
    env.as(null)
    assert.equal((await get()).status, 401)
  } finally { await env.pg.close() }
})

test('완료하지 않은 행사만 시작일 순(미정은 뒤)으로, 단계와 업무 수를 준다', async () => {
  const env = await setupPurchases()
  try {
    await env.pg.exec(`
      UPDATE events SET starts_at = '2026-10-01T10:00+09', ends_at = '2026-10-01T18:00+09' WHERE id = 'e';
      UPDATE events SET starts_at = '2026-10-12T10:00+09' WHERE id = 'e2';
      INSERT INTO events(id, organization_id, name, created_by) VALUES ('e3','a','학술제','p');
      INSERT INTO events(id, organization_id, name, created_by, completed_at, completed_by) VALUES ('e4','a','지난 행사','p', now(), 'l');
      INSERT INTO tasks(id, organization_id, event_id, title, status, department_id, assignee_id, due_on, completed_at, created_by) VALUES
        ('t1','a','e','끝낸 일','done','dp','p','2026-09-30','2026-09-30T10:00+09','p'),
        ('t2','a','e','늦은 일','todo','dp',NULL,'2026-10-11',NULL,'p'),
        ('t3','a','e','오늘 마감','doing','dp','p','2026-10-12',NULL,'p'),
        ('t9','a','e4','완료한 행사 업무','todo','dp',NULL,'2026-10-01',NULL,'p');
    `)
    const home = await env.ok<HomeResponse>(homeApp(env)())
    assert.deepEqual(home.events.map(entry => [entry.event.id, entry.phase]), [['e', 'wrapping'], ['e2', 'ongoing'], ['e3', 'planning']])
    assert.deepEqual(home.events[0]!.tasks, { total: 3, done: 1, overdue: 1, unassigned: 1 })
    assert.deepEqual(home.events[2]!.tasks, { total: 0, done: 0, overdue: 0, unassigned: 0 })
    assert.equal(home.events[0]!.registration, null)
    assert.equal(home.events[0]!.settled, false)
  } finally { await env.pg.close() }
})

test('지연 업무는 마감일 순 줄로, 담당자 없는 업무는 행사 × 담당 부서로 묶고, 부서별 수를 센다', async () => {
  const env = await setupPurchases()
  try {
    await env.pg.exec(`
      UPDATE events SET starts_at = '2026-10-01T10:00+09' WHERE id = 'e';
      INSERT INTO tasks(id, organization_id, event_id, title, status, department_id, assignee_id, due_on, completed_at, created_by) VALUES
        ('t1','a','e','끝낸 일','done','dp','p','2026-09-30','2026-10-01T10:00+09','p'),
        ('t2','a','e','현수막','todo','dp',NULL,'2026-10-11',NULL,'p'),
        ('t3','a','e','오늘 마감','doing','dp','p','2026-10-12',NULL,'p'),
        ('t4','a','e2','장소 섭외','todo',NULL,'q','2026-10-05',NULL,'p'),
        ('t5','a','e2','물품 목록','todo',NULL,NULL,NULL,NULL,'p');
    `)
    const home = await env.ok<HomeResponse>(homeApp(env)())
    assert.deepEqual(kinds(home, 'task_overdue').map(item => item.kind === 'task_overdue' && [item.eventId, item.task.id, item.task.assignee]),
      [['e2', 't4', { membershipId: 'mq', name: '기획2' }], ['e', 't2', null]])
    assert.deepEqual(kinds(home, 'tasks_unassigned'), [
      { kind: 'tasks_unassigned', eventId: 'e', department: { id: 'dp', name: '기획부' }, count: 1 },
      { kind: 'tasks_unassigned', eventId: 'e2', department: null, count: 1 }])
    assert.deepEqual(home.departments.map(department => [department.id, department.tasks]), [
      ['dl', { open: 0, overdue: 0, done: 0 }], ['dp', { open: 2, overdue: 1, done: 1 }], ['df', { open: 0, overdue: 0, done: 0 }]])
    assert.deepEqual(home.unownedTasks, { open: 2, overdue: 1, done: 0 })
    assert.equal(home.counts.task_overdue, 2)
    assert.equal(home.counts.tasks_unassigned, 2)
    assert.equal(home.truncated, false)
  } finally { await env.pg.close() }
})

test('지연 업무 줄은 100개까지 오래된 것부터 주고 잘렸다고 알린다. 수는 전체다', async () => {
  const env = await setupPurchases()
  try {
    await env.pg.exec(`INSERT INTO tasks(id, organization_id, event_id, title, status, due_on, created_by)
      SELECT 'bulk' || g, 'a', 'e', '업무 ' || g, 'todo', DATE '2026-06-01' + g, 'p' FROM generate_series(1, 101) g`)
    const home = await env.ok<HomeResponse>(homeApp(env)())
    const overdue = kinds(home, 'task_overdue')
    assert.equal(overdue.length, 100)
    assert.equal(overdue[0]!.kind === 'task_overdue' && overdue[0]!.task.id, 'bulk1')
    assert.equal(home.counts.task_overdue, 101)
    assert.equal(home.truncated, true)
  } finally { await env.pg.close() }
})
