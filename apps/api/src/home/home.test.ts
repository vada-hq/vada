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

test('구매: 승인 대기는 행사마다 수와 가장 오래된 제출, 필요한 날 지남은 받지 않은 승인 품목만 센다', async () => {
  const env = await setupPurchases()
  try {
    await env.pg.exec(`
      INSERT INTO purchase_submissions(id, organization_id, event_id, requester_id, submitted_at) VALUES
        ('s1','a','e','p','2026-10-10T09:00+09'), ('s2','a','e','p','2026-10-11T23:30+09'), ('s3','a','e2','p','2026-10-01T09:00+09');
      INSERT INTO purchase_items(id, organization_id, event_id, requester_id, submission_id, status, product_url) VALUES
        ('i1','a','e','p','s1','pending','u1'), ('i2','a','e','p','s2','pending','u2'), ('i3','a','e','p',NULL,'draft','u3');
      INSERT INTO purchase_items(id, organization_id, event_id, requester_id, submission_id, status, product_url, decided_by, decided_at, needed_by,
        purchased_by, purchased_at, received_by, received_at) VALUES
        ('i4','a','e2','p','s3','approved','u4','f',now(),'2026-10-10',NULL,NULL,NULL,NULL),
        ('i5','a','e2','p','s3','approved','u5','f',now(),'2026-10-08','f',now(),NULL,NULL),
        ('i6','a','e2','p','s3','approved','u6','f',now(),'2026-10-12',NULL,NULL,NULL,NULL),
        ('i7','a','e2','p','s3','approved','u7','f',now(),NULL,NULL,NULL,NULL,NULL),
        ('i8','a','e2','p','s3','approved','u8','f',now(),'2026-10-01','f',now(),'f',now());
    `)
    const home = await env.ok<HomeResponse>(homeApp(env)())
    assert.deepEqual(kinds(home, 'purchases_pending'), [{ kind: 'purchases_pending', eventId: 'e', count: 2, since: '2026-10-10T00:00:00.000Z' }])
    assert.deepEqual(kinds(home, 'purchases_late'), [{ kind: 'purchases_late', eventId: 'e2', count: 2, neededBy: '2026-10-08' }])
    assert.deepEqual([home.counts.purchases_pending, home.counts.purchases_late], [2, 2])
    // 정산한 행사의 필요한 날 지남은 세지 않는다.
    await env.pg.exec(`INSERT INTO event_finances(event_id, organization_id, settled_at, settled_by) VALUES ('e2','a', now(), 'f')`)
    assert.deepEqual(kinds(await env.ok<HomeResponse>(homeApp(env)()), 'purchases_late'), [])
  } finally { await env.pg.close() }
})

test('증빙 없는 지출은 재정 탭과 같은 정의로 오래된 결제부터 주고, 상시 운영 지출도 센다', async () => {
  const env = await setupPurchases()
  try {
    await env.pg.exec(`
      INSERT INTO events(id, organization_id, name, created_by, completed_at, completed_by) VALUES ('e4','a','지난 행사','p', now(), 'l');
      INSERT INTO expenses(id, organization_id, event_id, vendor, description, amount, paid_on, method, payer_id, recorded_by) VALUES
        ('x1','a','e','인쇄소','현수막 인쇄',45000,'2026-10-03','council_card','f','f'),
        ('x2','a',NULL,'문구점','사무용품',8000,'2026-10-01','council_card','f','f'),
        ('x3','a','e','마트','간식',20000,'2026-10-02','council_card','f','f'),
        ('x4','a','e','마트','음료',5000,'2026-10-04','council_card','f','f'),
        ('x5','a','e','취소','취소한 지출',1000,'2026-09-30','council_card','f','f'),
        ('x6','a','e4','지난','완료한 행사 지출',1000,'2026-09-01','council_card','f','f');
      UPDATE expenses SET voided_at = now(), voided_by = 'f', void_reason = '잘못 기록' WHERE id = 'x5';
      INSERT INTO expense_receipts(id, organization_id, expense_id, object_key, file_name, content_type, size_bytes, kind, status, uploaded_by, confirmed_at) VALUES
        ('r1','a','x3','k1','a.pdf','application/pdf',10,'receipt','ready','f',now()),
        ('r2','a','x4','k2','b.pdf','application/pdf',10,'receipt','pending','f',NULL);
    `)
    const home = await env.ok<HomeResponse>(homeApp(env)())
    assert.deepEqual(kinds(home, 'expense_no_evidence').map(item => item.kind === 'expense_no_evidence' && [item.eventId, item.expense.id]),
      [[null, 'x2'], ['e', 'x1'], ['e', 'x4']])
    assert.equal(home.counts.expense_no_evidence, 3)
    env.as('f')
    const finance = await env.ok<{ finance: { missingEvidence: number } }>(env.request('GET', '/events/e/finance'))
    assert.equal(finance.finance.missingEvidence, kinds(home, 'expense_no_evidence').filter(item => item.eventId === 'e').length)
  } finally { await env.pg.close() }
})

test('신청: 신청 수·정원·마감·받는 중을 주고, 입금 확인 전은 낼 돈이 있는 미확인 신청만 정산 전 행사에서 센다', async () => {
  const env = await setupPurchases()
  try {
    const hash = (n: number) => String(n).repeat(64).slice(0, 64)
    await env.pg.exec(`
      INSERT INTO registration_forms(id, organization_id, event_id, closes_at, capacity, fee, member_fee, created_by) VALUES
        ('form','a','e2','2026-10-20T23:59+09',60,10000,0,'p');
      INSERT INTO registrations(id, organization_id, form_id, token_hash, name, student_id, dues_member) VALUES
        ('g1','a','form','${hash(1)}','가학생','20260001',false),
        ('g2','a','form','${hash(2)}','나학생','20260002',true),
        ('g5','a','form','${hash(5)}','마학생','20260005',false);
      INSERT INTO registrations(id, organization_id, form_id, token_hash, name, student_id, dues_member, paid_amount, paid_at, paid_by) VALUES
        ('g3','a','form','${hash(3)}','다학생','20260003',false,10000,now(),'f');
      INSERT INTO registrations(id, organization_id, form_id, created_at, cancelled_at, purged_at, dues_member) VALUES
        ('g4','a','form', now(), now(), now(), false);
    `)
    const home = await env.ok<HomeResponse>(homeApp(env)())
    const festival = home.events.find(entry => entry.event.id === 'e2')!
    assert.deepEqual(festival.registration, { registered: 4, capacity: 60, closesAt: '2026-10-20T23:59', accepting: true })
    assert.deepEqual(kinds(home, 'fees_unconfirmed'), [{ kind: 'fees_unconfirmed', eventId: 'e2', count: 2 }])
    assert.equal(home.counts.fees_unconfirmed, 2)
    await env.pg.exec(`INSERT INTO event_finances(event_id, organization_id, settled_at, settled_by) VALUES ('e2','a', now(), 'f')`)
    const settled = await env.ok<HomeResponse>(homeApp(env)())
    assert.deepEqual([kinds(settled, 'fees_unconfirmed'), settled.counts.fees_unconfirmed], [[], 0])
    assert.equal(settled.events.find(entry => entry.event.id === 'e2')!.settled, true)
  } finally { await env.pg.close() }
})

test('끝난 행사: 정산 전이면 막는 수와 함께, 정산했으면 완료 전으로 준다', async () => {
  const env = await setupPurchases()
  try {
    await env.pg.exec(`
      UPDATE events SET starts_at = '2026-10-01T10:00+09', ends_at = '2026-10-01T18:00+09' WHERE id = 'e';
      UPDATE events SET starts_at = '2026-10-11T18:00+09' WHERE id = 'e2';
      INSERT INTO events(id, organization_id, name, created_by, starts_at) VALUES ('e3','a','학술제','p','2026-11-01T10:00+09');
      INSERT INTO purchase_submissions(id, organization_id, event_id, requester_id) VALUES ('s1','a','e','p');
      INSERT INTO purchase_items(id, organization_id, event_id, requester_id, submission_id, status, product_url) VALUES ('i1','a','e','p','s1','pending','u1');
      INSERT INTO expenses(id, organization_id, event_id, vendor, description, amount, paid_on, method, payer_id, recorded_by) VALUES
        ('x1','a','e','인쇄소','현수막 인쇄',45000,'2026-10-03','council_card','f','f');
      INSERT INTO event_finances(event_id, organization_id, settled_at, settled_by) VALUES ('e2','a', now(), 'f');
    `)
    const home = await env.ok<HomeResponse>(homeApp(env)())
    assert.deepEqual(kinds(home, 'settlement_pending'), [{ kind: 'settlement_pending', eventId: 'e', endedOn: '2026-10-01',
      blockers: { missingEvidence: 1, pendingRequests: 1, unrecordedItems: 0, feePeriodMissing: false } }])
    assert.deepEqual(kinds(home, 'completion_pending'), [{ kind: 'completion_pending', eventId: 'e2', endedOn: '2026-10-11' }])
    assert.deepEqual([home.counts.settlement_pending, home.counts.completion_pending], [1, 1])
    assert.deepEqual(home.items.slice(0, 2).map(item => item.kind), ['completion_pending', 'settlement_pending'])
  } finally { await env.pg.close() }
})

test('참가비를 받았는데 회계 기간에 넣지 않은 행사는 정산을 막는다고 알린다(재정 탭의 정산 조건과 같다)', async () => {
  const env = await setupPurchases()
  try {
    await env.pg.exec(`
      UPDATE events SET starts_at = '2026-10-01T10:00+09', ends_at = '2026-10-01T18:00+09' WHERE id = 'e';
      INSERT INTO registration_forms(id, organization_id, event_id, closes_at, fee, created_by) VALUES ('form','a','e','2026-09-30T23:59+09',5000,'p');
      INSERT INTO registrations(id, organization_id, form_id, token_hash, name, student_id, paid_amount, paid_at, paid_by) VALUES
        ('g1','a','form','${'a'.repeat(64)}','가학생','20260001',5000,now(),'f');
    `)
    const blocked = kinds(await env.ok<HomeResponse>(homeApp(env)()), 'settlement_pending')
    assert.deepEqual(blocked.map(item => item.kind === 'settlement_pending' && item.blockers),
      [{ missingEvidence: 0, pendingRequests: 0, unrecordedItems: 0, feePeriodMissing: true }])
    await env.pg.exec(`
      INSERT INTO budget_periods(id, organization_id, name, starts_on, ends_on, created_by) VALUES ('p1','a','2026년 2학기','2026-09-01','2027-02-28','l');
      INSERT INTO budget_lines(id, organization_id, period_id, kind, event_id, position) VALUES ('l1','a','p1','event','e',0);
    `)
    const ready = kinds(await env.ok<HomeResponse>(homeApp(env)()), 'settlement_pending')
    assert.equal(ready[0]!.kind === 'settlement_pending' && ready[0]!.blockers.feePeriodMissing, false)
  } finally { await env.pg.close() }
})
