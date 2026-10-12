import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { EventReportResponse, RecordsResponse } from '@vada/contracts'
import { createApp } from '../app.js'
import { createEventRoutes } from '../events/events.js'
import { ApiError } from '../http/errors.js'
import { origin, setupPurchases } from '../purchases/test-setup.js'
import { refused } from '../registrations/test-setup.js'
import type { GeneratedRetrospective, RetrospectiveGenerator, RetrospectiveInput } from './generation.js'
import { createReportRoutes } from './routes.js'

// 학생회 a: 기획부 p·q, 총무부 f, 회장단 l, 미배정 n. 학생회 b: x. 행사 e(대화 m '테이블 2개')·e2(a), ex(b, 대화 mx).
type Env = Awaited<ReturnType<typeof setupPurchases>>
type View = NonNullable<EventReportResponse['retrospective']>
// 가짜 끼룩이의 기본 답: 근거는 숫자, 첫 업무 줄, 첫 대화. 없으면 행사를 만든 줄이다.
const draftFrom = (input: RetrospectiveInput): GeneratedRetrospective => ({
  wentWell: [{ text: '업무를 모두 끝냈다.', sources: ['fact:tasks'] }],
  shortfalls: [{ text: '현수막이 늦었다.', sources: [input.records.find(record => record.id.startsWith('task:'))?.id ?? 'event:created'] }],
  nextTime: [{ text: '테이블은 2개면 된다.', sources: [input.messages[0]?.id ?? 'event:created'] }],
  questions: [{ text: '참석이 적은 이유가 있었나요?', sources: [] }],
})
// setupPurchases의 앱에는 결과보고서가 없어, 같은 DB로 결과보고서·행사 앱을 따로 만든다. 사용자는 env.as로 같이 바꾼다.
function reportsOf(env: Env) {
  const ai = { inputs: [] as RetrospectiveInput[], reply: (async input => draftFrom(input)) as RetrospectiveGenerator }
  const session = async () => env.state.userId ? { user: { id: env.state.userId } } : null
  const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, events: createEventRoutes(env.db, session),
    reports: createReportRoutes(env.db, session, async input => { ai.inputs.push(input); return ai.reply(input) }) })
  const send = (method: string, path: string, body?: unknown) => app.request(`/api/organizations/a${path}`, body === undefined
    ? { method } : { method, headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { send, ai }
}
// 정산은 settlement 테스트, 완료는 completion 테스트가 본다. 여기서는 정산·완료한 상태만 만든다. at은 완료 시각(SQL 식)이다.
const complete = (env: Env, event = 'e', at = 'now()') => env.pg.exec(`INSERT INTO event_finances(event_id, organization_id, settled_at, settled_by)
  VALUES ('${event}','a', now(), 'f') ON CONFLICT (event_id) DO UPDATE SET settled_at = now(), settled_by = 'f';
  UPDATE events SET completed_at = ${at}, completed_by = 'l', version = version + 1 WHERE id = '${event}'`)
const generatePath = '/events/e/report/retrospective/generate'
const savePath = '/events/e/report/retrospective'
const confirmPath = '/events/e/report/retrospective/confirm'
// 회고 보기를 그대로 저장하는 본문
const bodyOf = (view: View, overrides: Record<string, unknown> = {}) => ({ version: view.version,
  wentWell: view.wentWell.map(({ id, text }) => ({ id, text })), shortfalls: view.shortfalls.map(({ id, text }) => ({ id, text })),
  nextTime: view.nextTime.map(({ id, text }) => ({ id, text })), questions: view.questions.map(({ id, answer }) => ({ id, answer })), ...overrides })

test('결과보고서는 숫자와 준비 과정을 주고, 회고가 없으면 null이다. 다른 학생회·미인증은 막는다', async () => {
  const env = await setupPurchases()
  try {
    const { send } = reportsOf(env)
    await env.pg.exec(`INSERT INTO tasks(id, organization_id, event_id, title, status, department_id, created_by) VALUES ('t1','a','e','현수막','todo','dp','p')`)
    env.as('n')
    const report = await env.ok<EventReportResponse>(send('GET', '/events/e/report'))
    assert.deepEqual([report.event.id, report.retrospective, report.facts.tasks], ['e', null, { total: 1, done: 0, late: 0 }])
    assert.deepEqual(report.timeline.map(entry => entry.id), ['event:created', 'task:t1'])
    await refused(send('GET', '/events/ex/report'), 404, 'NOT_FOUND')
    await refused(send('GET', '/events/nope/report'), 404, 'NOT_FOUND')
    env.as(null)
    assert.equal((await send('GET', '/events/e/report')).status, 401)
    env.as('x')
    await refused(send('GET', '/events/e/report'), 403, 'FORBIDDEN')
  } finally { await env.pg.close() }
})

test('회고 만들기: 부서가 있는 구성원이 완료한 행사에서 만든다. 끼룩이에는 부서만 보내고 사람 이름·신청자 정보는 보내지 않는다', async () => {
  const env = await setupPurchases()
  try {
    const { send, ai } = reportsOf(env)
    await env.pg.exec(`UPDATE events SET owner_department_id = 'dp' WHERE id = 'e';
      INSERT INTO tasks(id, organization_id, event_id, title, status, department_id, due_on, completed_at, created_by)
        VALUES ('t1','a','e','현수막','done','dp','2026-03-01','2026-03-03T10:00+09','p');
      INSERT INTO registration_forms(id, organization_id, event_id, closes_at, created_by) VALUES ('form','a','e','2999-08-19T23:59+09','p');
      INSERT INTO registrations(id, organization_id, form_id, token_hash, name, student_id) VALUES ('r1','a','form','${'a'.repeat(64)}','김학생','20260001');`)
    env.as('p')
    await refused(send('POST', generatePath, { version: 0 }), 409, 'EVENT_NOT_COMPLETED')
    await complete(env)
    for (const user of ['n', 'x']) {
      env.as(user)
      await refused(send('POST', generatePath, { version: 0 }), 403, 'FORBIDDEN', user)
    }
    env.as(null)
    assert.equal((await send('POST', generatePath, { version: 0 })).status, 401)
    assert.equal(ai.inputs.length, 0)
    env.as('p')
    const view = (await env.ok<EventReportResponse>(send('POST', generatePath, { version: 0 }))).retrospective!
    assert.deepEqual([view.version, view.generated.by, view.confirmed, view.stale], [1, { id: 'p', name: '기획' }, null, false])
    assert.deepEqual(view.wentWell.map(item => [item.text, item.sources]),
      [['업무를 모두 끝냈다.', [{ kind: 'fact', id: 'fact:tasks', text: '업무 1건 중 1건 완료 · 지연 1건' }]]])
    assert.deepEqual(view.shortfalls[0]!.sources, [{ kind: 'entry', id: 'task:t1', text: '업무 완료: 현수막', tab: 'tasks' }])
    const [message] = view.nextTime[0]!.sources
    assert.deepEqual(message?.kind === 'message' ? [message.messageId, message.excerpt] : null, ['m', '테이블 2개'])
    assert.deepEqual(view.questions.map(question => [question.text, question.sources, question.answer]), [['참석이 적은 이유가 있었나요?', [], null]])
    const [input] = ai.inputs
    assert.deepEqual(input!.event, { name: '체육대회', startsOn: null, endsOn: null, place: null, department: '기획부' })
    assert.deepEqual(input!.messages.map(item => [item.id, item.department, item.content, item.dDay]), [['message:m', '기획부', '테이블 2개', null]])
    assert.ok(input!.numbers.some(number => number.id === 'fact:registrations'))
    const sent = JSON.stringify(input)
    for (const secret of ['김학생', '20260001', '기획2', '"기획"', '회장"']) assert.ok(!sent.includes(secret), secret)
    // 다시 만들기는 지금 버전으로 한다.
    await refused(send('POST', generatePath, { version: 0 }), 409, 'VERSION_CONFLICT')
    assert.equal((await env.ok<EventReportResponse>(send('POST', generatePath, { version: 1 }))).retrospective?.version, 2)
  } finally { await env.pg.close() }
})

test('끼룩이 실패는 502, 설정 없음은 503이고 회고가 생기지 않는다. 근거가 틀린 문장만 버린다', async () => {
  const env = await setupPurchases()
  try {
    const { send, ai } = reportsOf(env)
    await complete(env)
    env.as('p')
    ai.reply = async () => { throw new Error('provider') }
    await refused(send('POST', generatePath, { version: 0 }), 502, 'GENERATION_FAILED')
    ai.reply = async () => { throw new ApiError('AI_NOT_CONFIGURED', 503) }
    await refused(send('POST', generatePath, { version: 0 }), 503, 'AI_NOT_CONFIGURED')
    assert.equal((await env.ok<EventReportResponse>(send('GET', '/events/e/report'))).retrospective, null)
    ai.reply = async input => ({ ...draftFrom(input), wentWell: [{ text: '남의 대화', sources: ['message:mx'] }, { text: '없는 업무', sources: ['task:nope'] },
      { text: '근거 없음', sources: [] }, { text: '남는 문장', sources: ['message:m', 'fact:finance'] }] })
    const view = (await env.ok<EventReportResponse>(send('POST', generatePath, { version: 0 }))).retrospective!
    assert.deepEqual(view.wentWell.map(item => item.text), ['남는 문장'])
  } finally { await env.pg.close() }
})

test('만드는 동안 누가 회고를 바꾸거나 완료 시각이 바뀌면 결과를 버리고, 한 행사는 한 번에 하나만 만든다', async () => {
  const env = await setupPurchases()
  try {
    const { send, ai } = reportsOf(env)
    await complete(env)
    env.as('p')
    // 처음 만드는 동안 다른 사람이 먼저 만들었다.
    ai.reply = async input => {
      await env.pg.exec(`INSERT INTO event_retrospectives(event_id, organization_id, content, based_on_completed_at, generated_by)
        SELECT id, organization_id, '{"wentWell":[],"shortfalls":[],"nextTime":[],"questions":[]}', completed_at, 'q' FROM events WHERE id = 'e'`)
      return draftFrom(input)
    }
    await refused(send('POST', generatePath, { version: 0 }), 409, 'VERSION_CONFLICT')
    const first = (await env.ok<EventReportResponse>(send('GET', '/events/e/report'))).retrospective!
    assert.deepEqual([first.version, first.generated.by.id, first.wentWell], [1, 'q', []])
    // 다시 만드는 동안 누가 고쳤다.
    ai.reply = async input => { await env.pg.exec('UPDATE event_retrospectives SET version = version + 1'); return draftFrom(input) }
    await refused(send('POST', generatePath, { version: 1 }), 409, 'VERSION_CONFLICT')
    // 다시 만드는 동안 완료를 취소했다가 다시 완료했다.
    ai.reply = async input => { await env.pg.exec(`UPDATE events SET completed_at = completed_at + interval '1 minute' WHERE id = 'e'`); return draftFrom(input) }
    await refused(send('POST', generatePath, { version: 2 }), 409, 'VERSION_CONFLICT')
    // 만드는 중에 같은 행사를 또 만들면 기다리지 않고 거절한다.
    let release!: () => void
    let entered!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const inside = new Promise<void>(resolve => { entered = resolve })
    ai.reply = async input => { entered(); await gate; return draftFrom(input) }
    const slow = send('POST', generatePath, { version: 2 })
    await inside
    await refused(send('POST', generatePath, { version: 2 }), 409, 'GENERATION_IN_PROGRESS')
    release()
    assert.equal((await env.ok<EventReportResponse>(slow)).retrospective?.version, 3)
  } finally { await env.pg.close() }
})

test('고치기·확인: 있던 문장은 근거를 잇고 새 문장은 근거가 없으며, 저장하면 확인이다. 다시 만들면 고친 것과 확인을 지운다', async () => {
  const env = await setupPurchases()
  try {
    const { send } = reportsOf(env)
    await complete(env)
    await complete(env, 'e2')
    env.as('p')
    await refused(send('POST', '/events/e2/report/retrospective', { version: 1, wentWell: [], shortfalls: [], nextTime: [], questions: [] }), 409,
      'INVALID_STATE')
    await refused(send('POST', '/events/e2/report/retrospective/confirm', { version: 1 }), 409, 'INVALID_STATE')
    const first = (await env.ok<EventReportResponse>(send('POST', generatePath, { version: 0 }))).retrospective!
    // 잘된 점을 고치고, 아쉬운 점을 지우고, 다음 행사에서에 한 문장을 더하고, 질문에 답한다.
    const edited = bodyOf(first, { wentWell: [{ id: first.wentWell[0]!.id, text: '업무를 다 끝냈다(고침).' }], shortfalls: [],
      nextTime: [...first.nextTime.map(({ id, text }) => ({ id, text })), { id: null, text: '테이블은 행사 전날 빌린다.' }],
      questions: [{ id: first.questions[0]!.id, answer: '날씨 때문이었다.' }] })
    env.as('q')
    const saved = (await env.ok<EventReportResponse>(send('POST', savePath, edited))).retrospective!
    assert.deepEqual([saved.version, saved.confirmed?.by], [2, { id: 'q', name: '기획2' }])
    assert.deepEqual([saved.wentWell[0]!.id, saved.wentWell[0]!.text, saved.wentWell[0]!.sources],
      [first.wentWell[0]!.id, '업무를 다 끝냈다(고침).', first.wentWell[0]!.sources])
    assert.equal(saved.shortfalls.length, 0)
    assert.deepEqual([saved.nextTime[1]!.text, saved.nextTime[1]!.sources], ['테이블은 행사 전날 빌린다.', []])
    assert.equal(saved.questions[0]!.answer, '날씨 때문이었다.')
    await refused(send('POST', savePath, { ...edited, version: 1 }), 409, 'VERSION_CONFLICT')
    const twice = { id: first.wentWell[0]!.id, text: '가' }
    for (const invalid of [{ wentWell: [{ id: 'nope', text: '가' }] }, { wentWell: [twice, twice] }, { questions: [{ id: 'nope', answer: null }] }]) {
      await refused(send('POST', savePath, { ...edited, version: 2, ...invalid }), 400, 'INVALID_INPUT', JSON.stringify(invalid))
    }
    // 질문을 보내지 않으면 지운다.
    const cleared = (await env.ok<EventReportResponse>(send('POST', savePath, bodyOf(saved, { questions: [] })))).retrospective!
    assert.deepEqual([cleared.version, cleared.questions], [3, []])
    // 확인한 회고는 다시 확인할 수 없다. 다시 만들면 고친 것과 확인이 사라진 새 초안이다.
    await refused(send('POST', confirmPath, { version: 3 }), 409, 'INVALID_STATE')
    const again = (await env.ok<EventReportResponse>(send('POST', generatePath, { version: 3 }))).retrospective!
    assert.deepEqual([again.version, again.confirmed, again.wentWell[0]!.text, again.questions.length, again.generated.by.id],
      [4, null, '업무를 모두 끝냈다.', 1, 'q'])
    await refused(send('POST', confirmPath, { version: 3 }), 409, 'VERSION_CONFLICT')
    env.as('n')
    await refused(send('POST', confirmPath, { version: 4 }), 403, 'FORBIDDEN')
    await refused(send('POST', savePath, bodyOf(again)), 403, 'FORBIDDEN')
    env.as('p')
    const confirmed = (await env.ok<EventReportResponse>(send('POST', confirmPath, { version: 4 }))).retrospective!
    assert.deepEqual([confirmed.version, confirmed.confirmed?.by.id, confirmed.wentWell[0]!.text], [5, 'p', '업무를 모두 끝냈다.'])
    const records = (await env.ok<RecordsResponse>(send('GET', '/records'))).records
    assert.deepEqual(records.map(record => [record.event.id, record.retrospective]).sort(), [['e', 'confirmed'], ['e2', null]])
  } finally { await env.pg.close() }
})

test('완료를 취소해도 회고는 남고 낡은 초안이 된다. 완료 전에는 만들거나 고치거나 확인할 수 없다', async () => {
  const env = await setupPurchases()
  try {
    const { send } = reportsOf(env)
    await complete(env, 'e', `now() - interval '1 hour'`)
    env.as('p')
    const view = (await env.ok<EventReportResponse>(send('POST', generatePath, { version: 0 }))).retrospective!
    env.as('l')
    await env.ok(send('POST', '/events/e/completion/cancel', { version: 2 }))
    const cancelled = await env.ok<EventReportResponse>(send('GET', '/events/e/report'))
    assert.deepEqual([cancelled.event.completedAt, cancelled.retrospective?.stale], [null, true])
    env.as('p')
    await refused(send('POST', savePath, bodyOf(view)), 409, 'EVENT_NOT_COMPLETED')
    await refused(send('POST', confirmPath, { version: 1 }), 409, 'EVENT_NOT_COMPLETED')
    await refused(send('POST', generatePath, { version: 1 }), 409, 'EVENT_NOT_COMPLETED')
    await env.pg.exec(`UPDATE events SET completed_at = now(), completed_by = 'l', version = version + 1 WHERE id = 'e'`)
    assert.equal((await env.ok<EventReportResponse>(send('GET', '/events/e/report'))).retrospective?.stale, true)
    assert.equal((await env.ok<EventReportResponse>(send('POST', confirmPath, { version: 1 }))).retrospective?.confirmed?.by.id, 'p')
  } finally { await env.pg.close() }
})

test('회고 본문: 상한+1·빈 글·공백만·NUL·홀로 쓰인 서러게이트·모르는 키·틀린 버전을 거절하고, 상한 그대로는 저장한다', async () => {
  const env = await setupPurchases()
  try {
    const { send } = reportsOf(env)
    await complete(env)
    env.as('p')
    const view = (await env.ok<EventReportResponse>(send('POST', generatePath, { version: 0 }))).retrospective!
    const body = (overrides: Record<string, unknown>) => bodyOf(view, overrides)
    const line = (text: unknown) => ({ wentWell: [{ id: null, text }] })
    for (const invalid of [{ version: 1 }, body({ nextTime: undefined }), body(line('')), body(line(' \n\t ')), body(line('a'.repeat(201))),
      body(line('😀'.repeat(201))), body(line(`a${String.fromCharCode(0)}b`)), body(line(String.fromCharCode(0xd800))), body({ extra: 1 }),
      body({ version: 0 }), body({ version: 1.5 }), body({ version: '1' }), body({ wentWell: Array.from({ length: 11 }, () => ({ id: null, text: '가' })) }),
      body({ questions: Array.from({ length: 4 }, (_, index) => ({ id: `q${index}`, answer: null })) }),
      body({ questions: [{ id: view.questions[0]!.id, answer: '😀'.repeat(301) }] })]) {
      await refused(send('POST', savePath, invalid), 400, 'INVALID_INPUT', JSON.stringify(invalid).slice(0, 80))
    }
    for (const invalid of [{}, { version: -1 }, { version: 0.5 }, { version: '0' }, { version: 0, extra: true }]) {
      await refused(send('POST', generatePath, invalid), 400, 'INVALID_INPUT', JSON.stringify(invalid))
    }
    for (const invalid of [{}, { version: 0 }, { version: 1.5 }, { version: '1' }, { version: 1, extra: true }]) {
      await refused(send('POST', confirmPath, invalid), 400, 'INVALID_INPUT', JSON.stringify(invalid))
    }
    // 상한 그대로: 섹션마다 10문장 × 200자. 제어 문자는 JSON에서 6바이트라 32KiB를 넘지만 가드 상한(64KiB) 안이다.
    const control = String.fromCharCode(1).repeat(200)
    const full = Array.from({ length: 10 }, () => ({ id: null, text: control }))
    const longest = await send('POST', savePath, body({ wentWell: full, shortfalls: full, nextTime: full,
      questions: [{ id: view.questions[0]!.id, answer: '😀'.repeat(300) }] }))
    assert.equal(longest.status, 200, await longest.clone().text())
  } finally { await env.pg.close() }
})
