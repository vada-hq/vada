import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { EventReportResponse, RecordsResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createEventRoutes } from '../events/events.js'
import { link, origin, setupPurchases } from '../purchases/test-setup.js'
import { createRegistrationRoutes } from '../registrations/routes.js'
import { refused } from '../registrations/test-setup.js'
import { createSettlementRoutes } from '../settlement/routes.js'
import { createTaskRoutes } from '../tasks/routes.js'
import { createReportRoutes } from './routes.js'

// 학생회 a: 기획부 p·q, 총무부(구매 승인) f, 회장단 l, 미배정 n. 학생회 b: x. 행사 e·e2(a), ex(b).
type Env = Awaited<ReturnType<typeof setupPurchases>>
// setupPurchases의 앱에는 결과보고서가 없어 같은 DB로 결과보고서·행사 앱을 따로 만든다. 사용자는 env.as로 같이 바꾼다.
function reportsOf(env: Env) {
  const session = async () => env.state.userId ? { user: { id: env.state.userId } } : null
  const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, reports: createReportRoutes(env.db, session),
    events: createEventRoutes(env.db, session), settlement: createSettlementRoutes(env.db, session, origin),
    registrations: createRegistrationRoutes(env.db, session), tasks: createTaskRoutes(env.db, session) })
  return (method: string, path: string, body?: unknown) => app.request(`/api/organizations/a${path}`, body === undefined
    ? { method } : { method, headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}
// 정산은 settlement 테스트, 완료는 completion 테스트가 본다. 여기서는 정산·완료한 상태만 만든다.
const complete = (env: Env, event = 'e') => env.pg.exec(`INSERT INTO event_finances(event_id, organization_id, settled_at, settled_by)
  VALUES ('${event}','a', now(), 'f') ON CONFLICT (event_id) DO UPDATE SET settled_at = now(), settled_by = 'f';
  UPDATE events SET completed_at = now(), completed_by = 'l', version = version + 1 WHERE id = '${event}'`)

test('결과보고서 수치: 신청·참석, 예산·집행, 업무 완료·지연, 구매 요청·승인을 행사 기록에서 센다', async () => {
  const env = await setupPurchases()
  try {
    const send = reportsOf(env)
    // 신청 셋(하나 취소, 하나는 보관 기간이 지나 정보를 지움), 참석 하나
    await env.pg.exec(`
      INSERT INTO registration_forms(id, organization_id, event_id, closes_at, created_by) VALUES ('form','a','e','2999-08-19T23:59+09','p');
      INSERT INTO registrations(id, organization_id, form_id, token_hash, name, student_id, checked_in_at, checked_in_by)
        VALUES ('r1','a','form','${'a'.repeat(64)}','김학생','20260001', now(), 'p');
      INSERT INTO registrations(id, organization_id, form_id, purged_at) VALUES ('r2','a','form', now());
      INSERT INTO registrations(id, organization_id, form_id, purged_at, cancelled_at) VALUES ('r3','a','form', now(), now());
    `)
    // 예산 10만 원, 지출 둘(하나 취소)
    await env.pg.exec(`
      INSERT INTO event_finances(event_id, organization_id, budget) VALUES ('e','a',100000);
      INSERT INTO expenses(id, organization_id, event_id, vendor, description, amount, paid_on, method, payer_id, recorded_by)
        VALUES ('x1','a','e','쿠팡','물품',46000,'2026-10-01','council_card','f','f'),('x2','a','e','쿠팡','물품',9000,'2026-10-01','council_card','f','f');
      UPDATE expenses SET voided_at = now(), voided_by = 'f', void_reason = '잘못 기록' WHERE id = 'x2';
    `)
    // 업무 넷: 마감일 당일에 끝냄(지연 아님), 다음 날 끝냄, 마감 지나고 안 끝냄, 마감 전(먼 미래)이고 안 끝냄
    await env.pg.exec(`
      INSERT INTO tasks(id, organization_id, event_id, title, status, due_on, completed_at, created_by) VALUES
        ('t1','a','e','대관','done','2026-09-01','2026-09-01T23:00+09','p'),
        ('t2','a','e','현수막','done','2026-09-01','2026-09-02T00:30+09','p'),
        ('t3','a','e','정산','todo','2000-01-01',NULL,'p'),
        ('t4','a','e','후기','doing','2999-01-01',NULL,'p');
    `)
    // 구매: 승인 하나, 대기 하나, 작성 중 하나
    await env.approved([link(1)])
    env.as('p')
    await env.submitted([link(2)])
    await env.drafts([link(3)])
    env.as('n')
    const { report, facts, event } = await env.ok<EventReportResponse>(send('GET', '/events/e/report'))
    assert.equal(report, null)
    assert.equal(event.id, 'e')
    assert.deepEqual(facts, {
      event: { name: '체육대회', startsAt: null, endsAt: null, place: null }, owner: { department: null, person: null },
      registrations: { registered: 2, attended: 1 }, finance: { budget: 100000, spent: 46000 }, tasks: { total: 4, done: 2, late: 2 },
      purchases: { requested: 2, approved: 1 },
    })
    // 참가 신청이 없고 예산도 지출도 없는 행사
    const empty = await env.ok<EventReportResponse>(send('GET', '/events/e2/report'))
    assert.deepEqual([empty.facts.registrations, empty.facts.finance, empty.facts.tasks, empty.facts.purchases],
      [null, { budget: null, spent: 0 }, { total: 0, done: 0, late: 0 }, { requested: 0, approved: 0 }])
    // 다른 학생회 행사, 없는 행사, 미인증, 다른 학생회 사용자
    await refused(send('GET', '/events/ex/report'), 404, 'NOT_FOUND')
    await refused(send('GET', '/events/nope/report'), 404, 'NOT_FOUND')
    env.as(null)
    assert.equal((await send('GET', '/events/e/report')).status, 401)
    env.as('x')
    await refused(send('GET', '/events/e/report'), 403, 'FORBIDDEN')
  } finally { await env.pg.close() }
})

test('기록 목록: 완료한 행사만 최근 완료 순으로, 담당과 수치를 함께 준다', async () => {
  const env = await setupPurchases()
  try {
    const send = reportsOf(env)
    await env.pg.exec(`UPDATE events SET owner_department_id = 'dp', owner_id = 'q' WHERE id = 'e2'`)
    await complete(env, 'e2')
    await complete(env, 'e')
    await env.pg.exec(`UPDATE events SET completed_at = now() - interval '1 day' WHERE id = 'e2'`)
    env.as('n')
    const { records } = await env.ok<RecordsResponse>(send('GET', '/records'))
    assert.deepEqual(records.map(record => record.event.id), ['e', 'e2'])
    assert.deepEqual(records.map(record => record.report), [null, null])
    assert.deepEqual(records[1]!.facts.owner, { department: '기획부', person: '기획2' })
    assert.deepEqual(records[1]!.event.ownerDepartment, { id: 'dp', name: '기획부' })
    // 완료하지 않은 행사와 다른 학생회 행사는 없다.
    await env.pg.exec(`UPDATE events SET completed_at = NULL, completed_by = NULL WHERE id = 'e'`)
    assert.deepEqual((await env.ok<RecordsResponse>(send('GET', '/records'))).records.map(record => record.event.id), ['e2'])
    env.as('x')
    await refused(send('GET', '/records'), 403, 'FORBIDDEN')
    env.as(null)
    assert.equal((await send('GET', '/records')).status, 401)
  } finally { await env.pg.close() }
})
