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
    // 완료하지 않은 행사와 다른 학생회 행사는 없다. 학생회 b의 행사도 완료해 두고 거르는지 본다.
    await env.pg.exec(`UPDATE events SET completed_at = NULL, completed_by = NULL WHERE id = 'e';
      UPDATE events SET completed_at = now(), completed_by = 'x' WHERE id = 'ex'`)
    assert.deepEqual((await env.ok<RecordsResponse>(send('GET', '/records'))).records.map(record => record.event.id), ['e2'])
    env.as('x')
    await refused(send('GET', '/records'), 403, 'FORBIDDEN')
    env.as(null)
    assert.equal((await send('GET', '/records')).status, 401)
  } finally { await env.pg.close() }
})

const draft = { operations: '10:00 시작, 17:00 정리', wentWell: '조를 미리 정했다', shortfalls: null, improvements: null, handover: null }
const full = { ...draft, shortfalls: '물이 모자랐다 — 원인: 인원 예측', improvements: '물은 1인 1병으로', handover: '대관은 6주 전에' }

test('결과보고서 저장: 부서가 있는 구성원이 완료한 행사에만 쓰고, 버전으로 겹침을 막는다', async () => {
  const env = await setupPurchases()
  try {
    const send = reportsOf(env)
    env.as('p')
    await refused(send('POST', '/events/e/report', { version: 0, ...draft }), 409, 'EVENT_NOT_COMPLETED')
    await complete(env)
    const created = await env.ok<EventReportResponse>(send('POST', '/events/e/report', { version: 0, ...draft }))
    assert.deepEqual([created.report?.status, created.report?.version, created.report?.operations, created.report?.shortfalls, created.report?.created.by,
      created.report?.updated.by, created.report?.published], ['draft', 1, '10:00 시작, 17:00 정리', null, { id: 'p', name: '기획' }, { id: 'p', name: '기획' }, null])
    await refused(send('POST', '/events/e/report', { version: 0, ...draft }), 409, 'VERSION_CONFLICT')
    env.as('q')
    const updated = await env.ok<EventReportResponse>(send('POST', '/events/e/report', { version: 1, ...draft, wentWell: '  앞뒤 공백은 지운다  ' }))
    assert.deepEqual([updated.report?.version, updated.report?.wentWell, updated.report?.created.by.id, updated.report?.updated.by.id],
      [2, '앞뒤 공백은 지운다', 'p', 'q'])
    await refused(send('POST', '/events/e/report', { version: 1, ...draft }), 409, 'VERSION_CONFLICT')
    // 미배정·다른 학생회·미인증, 다른 학생회 행사·없는 행사
    for (const user of ['n', 'x']) {
      env.as(user)
      await refused(send('POST', '/events/e/report', { version: 2, ...draft }), 403, 'FORBIDDEN', user)
    }
    env.as(null)
    assert.equal((await send('POST', '/events/e/report', { version: 2, ...draft })).status, 401)
    env.as('p')
    await refused(send('POST', '/events/ex/report', { version: 0, ...draft }), 404, 'NOT_FOUND')
    await refused(send('POST', '/events/nope/report', { version: 0, ...draft }), 404, 'NOT_FOUND')
    // 이미 있는 보고서를 버전 0으로 저장하면 버전 충돌이다.
    await complete(env, 'e2')
    await env.pg.exec(`INSERT INTO event_reports(event_id, organization_id, operations, created_by, updated_by) VALUES ('e2','a','먼저 씀','q','q')`)
    await refused(send('POST', '/events/e2/report', { version: 0, ...draft }), 409, 'VERSION_CONFLICT')
  } finally { await env.pg.close() }
})

test('처음 쓰는 두 사람이 겹치면 둘째는 500이 아니라 버전 충돌이다', async () => {
  const env = await setupPurchases()
  try {
    const send = reportsOf(env)
    await complete(env)
    // 첫째의 저장을 트리거로 흉내 낸다. 둘째가 보고서가 없는 것을 본 뒤, 넣기 직전에 같은 행사의 보고서가 생긴다.
    await env.pg.exec(`CREATE FUNCTION first_writer() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF pg_trigger_depth() = 1 THEN
          INSERT INTO event_reports(event_id, organization_id, operations, created_by, updated_by) VALUES (NEW.event_id, NEW.organization_id, '먼저 씀', 'q', 'q');
        END IF; RETURN NEW; END $$;
      CREATE TRIGGER first_writer BEFORE INSERT ON event_reports FOR EACH ROW EXECUTE FUNCTION first_writer();`)
    env.as('p')
    await refused(send('POST', '/events/e/report', { version: 0, ...draft }), 409, 'VERSION_CONFLICT')
    await env.pg.exec('DROP TRIGGER first_writer ON event_reports; DROP FUNCTION first_writer();')
    // 실패한 저장은 아무것도 남기지 않는다(흉내 낸 첫째의 행도 같은 거래라 함께 되돌려진다). 그 뒤에는 처음부터 다시 쓴다.
    assert.equal((await env.ok<EventReportResponse>(send('GET', '/events/e/report'))).report, null)
    assert.equal((await env.ok<EventReportResponse>(send('POST', '/events/e/report', { version: 0, ...draft }))).report?.version, 1)
  } finally { await env.pg.close() }
})

test('결과보고서 본문: 칸마다 2000자, 빈 글·공백만·NUL·홀로 쓰인 서러게이트·모르는 키·틀린 버전을 거절한다', async () => {
  const env = await setupPurchases()
  try {
    const send = reportsOf(env)
    await complete(env)
    env.as('p')
    const body = (overrides: Record<string, unknown>) => ({ version: 0, ...draft, ...overrides })
    for (const invalid of [{ version: 0 }, body({ handover: undefined }), body({ operations: '' }), body({ operations: ' \n\t ' }),
      body({ operations: 'a'.repeat(2001) }), body({ operations: '😀'.repeat(2001) }), body({ operations: `a${String.fromCharCode(0)}b` }),
      body({ operations: String.fromCharCode(0xd800) }), body({ extra: 1 }), body({ version: -1 }), body({ version: 1.5 }), body({ version: '0' }),
      body({ wentWell: 1 })]) {
      await refused(send('POST', '/events/e/report', invalid), 400, 'INVALID_INPUT', JSON.stringify(invalid).slice(0, 60))
    }
    // 상한 그대로는 저장한다. 제어 문자로 다섯 칸을 채워도 본문 상한(64KiB) 안이다.
    const control = String.fromCharCode(1).repeat(2000)
    const longest = await send('POST', '/events/e/report', { version: 0, operations: control, wentWell: control, shortfalls: control,
      improvements: control, handover: '😀'.repeat(2000) })
    assert.equal(longest.status, 200, await longest.clone().text())
  } finally { await env.pg.close() }
})

test('발행: 회장단이 다섯 칸을 다 쓴 보고서를 발행하면 수치·이름이 고정되고, 발행 취소하면 다시 센다', async () => {
  const env = await setupPurchases()
  try {
    const send = reportsOf(env)
    await env.pg.exec(`UPDATE events SET owner_department_id = 'dp' WHERE id = 'e'`)
    await complete(env)
    env.as('l')
    await refused(send('POST', '/events/e/report/publish', { version: 1 }), 409, 'REPORT_INCOMPLETE')
    env.as('p')
    await env.ok(send('POST', '/events/e/report', { version: 0, ...draft }))
    env.as('l')
    await refused(send('POST', '/events/e/report/publish', { version: 1 }), 409, 'REPORT_INCOMPLETE')
    await env.ok(send('POST', '/events/e/report', { version: 1, ...full }))
    // 회장단이 아니거나 다른 학생회 사용자면 거절하고, 미인증은 401이다.
    for (const user of ['p', 'n', 'x']) {
      env.as(user)
      await refused(send('POST', '/events/e/report/publish', { version: 2 }), 403, 'FORBIDDEN', user)
    }
    env.as(null)
    assert.equal((await send('POST', '/events/e/report/publish', { version: 2 })).status, 401)
    env.as('l')
    await refused(send('POST', '/events/e/report/publish', { version: 1 }), 409, 'VERSION_CONFLICT')
    await refused(send('POST', '/events/e/report/unpublish', { version: 2 }), 409, 'INVALID_STATE')
    const published = await env.ok<EventReportResponse>(send('POST', '/events/e/report/publish', { version: 2 }))
    assert.deepEqual([published.report?.status, published.report?.version, published.report?.published?.by], ['published', 3, { id: 'l', name: '회장' }])
    assert.equal(published.factsAt, published.report?.published?.at)
    assert.equal(published.facts.owner.department, '기획부')
    await refused(send('POST', '/events/e/report/publish', { version: 3 }), 409, 'INVALID_STATE')
    // 발행한 보고서는 고치지 않는다. 부서 이름을 바꿔도 고정한 이름은 그대로다.
    await refused(send('POST', '/events/e/report', { version: 3, ...full }), 409, 'REPORT_PUBLISHED')
    await env.pg.exec(`UPDATE departments SET name = '새 기획부' WHERE id = 'dp'`)
    assert.equal((await env.ok<EventReportResponse>(send('GET', '/events/e/report'))).facts.owner.department, '기획부')
    const records = (await env.ok<RecordsResponse>(send('GET', '/records'))).records
    assert.deepEqual([records[0]!.facts.owner.department, records[0]!.report?.status], ['기획부', 'published'])
    for (const user of ['p', 'n', 'x']) {
      env.as(user)
      await refused(send('POST', '/events/e/report/unpublish', { version: 3 }), 403, 'FORBIDDEN', user)
    }
    env.as(null)
    assert.equal((await send('POST', '/events/e/report/unpublish', { version: 3 })).status, 401)
    env.as('l')
    const back = await env.ok<EventReportResponse>(send('POST', '/events/e/report/unpublish', { version: 3 }))
    assert.deepEqual([back.report?.status, back.report?.version, back.report?.published, back.report?.handover, back.facts.owner.department],
      ['draft', 4, null, '대관은 6주 전에', '새 기획부'])
    await refused(send('POST', '/events/e/report/unpublish', { version: 4 }), 409, 'INVALID_STATE')
    for (const path of ['/events/e/report/publish', '/events/e/report/unpublish']) {
      for (const invalid of [{}, { version: 0 }, { version: 1.5 }, { version: '4' }, { version: 4, extra: true }]) {
        await refused(send('POST', path, invalid), 400, 'INVALID_INPUT', `${path} ${JSON.stringify(invalid)}`)
      }
    }
  } finally { await env.pg.close() }
})

test('발행한 보고서가 있으면 완료를 취소하지 않는다. 작성 중 보고서는 완료 취소 뒤에도 남는다', async () => {
  const env = await setupPurchases()
  try {
    const send = reportsOf(env)
    await complete(env)
    env.as('p')
    await env.ok(send('POST', '/events/e/report', { version: 0, ...full }))
    env.as('l')
    await env.ok(send('POST', '/events/e/report/publish', { version: 1 }))
    await refused(send('POST', '/events/e/completion/cancel', { version: 2 }), 409, 'REPORT_PUBLISHED')
    await env.ok(send('POST', '/events/e/report/unpublish', { version: 2 }))
    await env.ok(send('POST', '/events/e/completion/cancel', { version: 2 }))
    const kept = await env.ok<EventReportResponse>(send('GET', '/events/e/report'))
    assert.deepEqual([kept.event.completedAt, kept.report?.status, kept.report?.operations], [null, 'draft', full.operations])
    await refused(send('POST', '/events/e/report', { version: 3, ...full }), 409, 'EVENT_NOT_COMPLETED')
    await refused(send('POST', '/events/e/report/publish', { version: 3 }), 409, 'EVENT_NOT_COMPLETED')
  } finally { await env.pg.close() }
})
