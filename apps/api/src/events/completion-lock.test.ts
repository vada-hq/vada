import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { RegistrationCreated, RegistrationResponse, TaskResponse } from '@vada/contracts'
import { createApp, type AppOptions } from '../app.js'
import { createAccessRoutes } from '../access/access.js'
import { createBudgetRoutes } from '../budget/routes.js'
import { createChatRoutes } from '../chat/chat.js'
import { createDeliveryRoutes } from '../deliveries/routes.js'
import { createCallbackAddress, createDeliveryWebhook } from '../deliveries/webhook.js'
import { createExpenseRoutes } from '../expenses/routes.js'
import { createFeeRoutes } from '../fees/routes.js'
import { createIncomeRoutes } from '../incomes/routes.js'
import { createOrganizationRoutes } from '../organization/routes.js'
import { createPurchaseRoutes } from '../purchases/purchases.js'
import { fakeStorage, link, origin, setupPurchases } from '../purchases/test-setup.js'
import { createRegistrationRoutes } from '../registrations/routes.js'
import { createSettlementRoutes } from '../settlement/routes.js'
import { createTaskRoutes } from '../tasks/routes.js'
import { createReportRoutes } from '../reports/routes.js'
import { createEventRoutes } from './events.js'

const readOnly = new Set(['GET', 'HEAD', 'OPTIONS'])
const eventRoot = '/api/organizations/:organizationId/events/:eventId'
const isEventWrite = (path: string) => path === eventRoot || path.startsWith(`${eventRoot}/`)
// 완료한 행사에서 하는 일: 완료·완료 취소(M5a)와 결과보고서(M5b). 결과보고서는 반대로 완료한 행사에서만 쓴다(reports.test.ts).
const completedOnly = new Set([`POST ${eventRoot}/completion`, `POST ${eventRoot}/completion/cancel`,
  `POST ${eventRoot}/report`, `POST ${eventRoot}/report/publish`, `POST ${eventRoot}/report/unpublish`])
const taskBody = { title: '정리', description: null, departmentId: null, assigneeMembershipId: null, dueOn: null }
const formFields = { opensAt: null, closesAt: '2999-08-19T23:59', capacity: null, notice: null, collectPhone: false, fee: 0, memberFee: null }
const expenseBody = { eventId: 'e', vendor: '쿠팡', description: '체육대회 물품', amount: 46000, paidOn: '2026-10-09', method: 'council_card',
  payerMembershipId: 'mf', note: null, budgetLineId: null }

// AGENTS.md: 행사 기록을 바꾸는 라우트는 /events/:eventId/ 아래에 두고 거래 맨 앞에서 완료한 행사를 막는다(events/lock.ts).
// 새 라우트가 생기면 아래 표에 본문이 없어 이 테스트가 실패한다. 다른 경로에서 행사 기록을 바꾸면 "그 밖의 경로" 표에 더한다.
test('완료한 행사는 행사 아래 모든 변경 라우트와 행사 기록을 바꾸는 다른 경로에서 막힌다. 완료를 취소하면 다시 된다', async () => {
  const env = await setupPurchases()
  try {
    // 완료 전에 행사 e에 기록을 만든다: 일시, 신청서와 신청 하나, 업무, 작성 중·대기·승인 품목, 지출, 배송.
    await env.ok(env.request('PATCH', '/events/e', { version: 1, startsAt: '2999-08-20T10:00', endsAt: null, place: null, ownerDepartmentId: null, ownerMembershipId: null }))
    const form = (await env.ok<RegistrationResponse>(env.request('POST', '/events/e/registration', formFields), 201)).form!
    const { token } = await env.ok<RegistrationCreated>(env.publicRequest('POST', `/public/registration-forms/${form.code}/entries`,
      { name: '김학생', studentId: '20260001', phone: null, agreed: true }), 201)
    const registrationId = (await env.ok<RegistrationResponse>(env.request('GET', '/events/e/registration'))).registrations[0]!.id
    const taskId = (await env.ok<TaskResponse>(env.request('POST', '/events/e/tasks', taskBody), 201)).task.id
    const [approvedId] = await env.approved([link(1)])
    env.as('p')
    const [pending] = await env.submitted([link(2)])
    const [draft] = await env.drafts([link(3)])
    const candidateId = await env.candidateOf(link(3))
    env.as('f')
    const expenseId = (await env.ok<{ expense: { id: string } }>(env.request('POST', '/expenses', { ...expenseBody, itemIds: [approvedId] }), 201)).expense.id
    await env.pg.exec(`
      INSERT INTO shipments(id, organization_id, carrier_id, tracking_number, created_by) VALUES ('s1','a','kr.cjlogistics','1234567890','f');
      INSERT INTO shipment_items(id, shipment_id, purchase_item_id, organization_id, linked_by) VALUES ('si1','s1','${approvedId}','a','f');
      INSERT INTO event_finances(event_id, organization_id, settled_at, settled_by) VALUES ('e','a', now(), 'f');
      UPDATE events SET completed_at = now(), completed_by = 'l' WHERE id = 'e';
    `)

    // 모든 모듈로 앱을 만들고 회장단(l)으로 보낸다. 회장단은 행사·구매 승인·조직 권한이 모두 있다.
    const session = async () => ({ user: { id: 'l' } })
    const db = env.db
    const modules = {
      access: createAccessRoutes(db, session), organization: createOrganizationRoutes(db, session), events: createEventRoutes(db, session),
      chat: createChatRoutes(db, session),
      purchases: createPurchaseRoutes(db, session, async () => { throw new Error('완료한 행사에서는 끼룩이를 부르지 않는다') }),
      // 배송 조회기는 부르지 않아야 한다. 부르면 {}에서 터져 500이 된다.
      deliveries: createDeliveryRoutes(db, session, {} as never),
      expenses: createExpenseRoutes(db, session, fakeStorage().storage),
      settlement: createSettlementRoutes(db, session, origin), budget: createBudgetRoutes(db, session, origin), incomes: createIncomeRoutes(db, session),
      registrations: createRegistrationRoutes(db, session), fees: createFeeRoutes(db, session), tasks: createTaskRoutes(db, session),
      reports: createReportRoutes(db, session),
      webhook: createDeliveryWebhook(db, createCallbackAddress('https://vada.test', 'k'.repeat(32))),
    } satisfies Required<Omit<AppOptions, 'auth' | 'trustedOrigin'>>
    const app = createApp({ auth: { handler: async () => new Response() }, trustedOrigin: origin, ...modules })
    const send = (method: string, path: string, body: unknown) => app.request(path, { method,
      headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const at = (path = '') => `/api/organizations/a/events/e${path}`

    // 행사 아래 변경 라우트마다 본문을 둔다. 잠금이 먼저라 대상 ID·버전은 상관없다.
    const probes: Record<string, [path: string, body: unknown]> = {
      [`PATCH ${eventRoot}`]: [at(), { version: 2, startsAt: '2999-08-20T10:00', endsAt: null, place: '체육관', ownerDepartmentId: null,
        ownerMembershipId: null }],
      [`POST ${eventRoot}/finance/budget`]: [at('/finance/budget'), { version: 1, budget: 1000 }],
      [`POST ${eventRoot}/finance/reopen`]: [at('/finance/reopen'), { version: 1, reason: '다시 확인' }],
      [`POST ${eventRoot}/finance/settle`]: [at('/finance/settle'), { version: 1, feeIncomeLineId: null }],
      [`POST ${eventRoot}/messages`]: [at('/messages'), { content: '고마워요' }],
      [`POST ${eventRoot}/purchase-candidates/:candidateId/hidden`]: [at(`/purchase-candidates/${candidateId}/hidden`), { hidden: true }],
      [`PATCH ${eventRoot}/purchase-items/:itemId`]: [at(`/purchase-items/${draft!.id}`), { version: 1, note: '바꿈' }],
      [`POST ${eventRoot}/purchase-items/:itemId/cancel`]: [at(`/purchase-items/${pending!.id}/cancel`), { version: 1 }],
      [`POST ${eventRoot}/purchase-items/:itemId/delete`]: [at(`/purchase-items/${draft!.id}/delete`), { version: 1 }],
      [`POST ${eventRoot}/purchase-items/:itemId/re-add`]: [at(`/purchase-items/${pending!.id}/re-add`), { version: 1 }],
      [`POST ${eventRoot}/purchase-items/:itemId/received`]: [at(`/purchase-items/${approvedId}/received`), { version: 1, received: true }],
      [`POST ${eventRoot}/purchase-items/drafts`]: [at('/purchase-items/drafts'), { idempotencyKey: 'probe-key', candidateIds: [candidateId] }],
      [`POST ${eventRoot}/purchase-items/needed-by`]: [at('/purchase-items/needed-by'), { items: [{ id: draft!.id, version: 1 }], neededBy: null }],
      [`POST ${eventRoot}/purchase-items/submit`]: [at('/purchase-items/submit'), { items: [{ id: draft!.id, version: 1 }] }],
      [`POST ${eventRoot}/registration`]: [at('/registration'), formFields],
      [`PATCH ${eventRoot}/registration`]: [at('/registration'), { version: 1, accepting: false, ...formFields }],
      [`POST ${eventRoot}/registration/check-in`]: [at('/registration/check-in'), { code: 'a'.repeat(64) }],
      [`POST ${eventRoot}/registration/entries/:registrationId/cancel`]: [at(`/registration/entries/${registrationId}/cancel`), {}],
      [`POST ${eventRoot}/registration/entries/:registrationId/check-in`]: [at(`/registration/entries/${registrationId}/check-in`), {}],
      [`POST ${eventRoot}/registration/entries/:registrationId/check-in/cancel`]: [at(`/registration/entries/${registrationId}/check-in/cancel`), {}],
      [`POST ${eventRoot}/registration/entries/:registrationId/dues`]: [at(`/registration/entries/${registrationId}/dues`), { duesMember: true }],
      [`POST ${eventRoot}/registration/entries/:registrationId/payment`]: [at(`/registration/entries/${registrationId}/payment`), {}],
      [`POST ${eventRoot}/registration/entries/:registrationId/payment/cancel`]: [at(`/registration/entries/${registrationId}/payment/cancel`), {}],
      [`POST ${eventRoot}/tasks`]: [at('/tasks'), taskBody],
      [`PATCH ${eventRoot}/tasks/:taskId`]: [at(`/tasks/${taskId}`), { version: 1, ...taskBody }],
      [`POST ${eventRoot}/tasks/:taskId/status`]: [at(`/tasks/${taskId}/status`), { version: 1, status: 'done' }],
      [`POST ${eventRoot}/tasks/:taskId/delete`]: [at(`/tasks/${taskId}/delete`), { version: 1 }],
    }
    const writes = [...new Set(app.routes.filter(route => !readOnly.has(route.method) && isEventWrite(route.path))
      .map(route => `${route.method} ${route.path}`))].filter(key => !completedOnly.has(key))
    assert.deepEqual(writes.sort(), Object.keys(probes).sort(), '행사 아래 변경 라우트는 모두 이 표에 본문을 두고 완료 잠금을 확인한다')
    for (const [key, [path, body]] of Object.entries(probes)) {
      const response = await send(key.slice(0, key.indexOf(' ')), path, body)
      assert.equal(response.status, 409, `${key}: ${await response.clone().text()}`)
      assert.deepEqual(await response.json(), { error: 'EVENT_COMPLETED' }, key)
    }

    // 행사 아래가 아닌 경로에서 행사 기록을 바꾸는 것. 학생에게는 "완료" 대신 지금 쓰는 마감 이유를 준다.
    const others: [method: string, path: string, body: unknown, error: string][] = [
      ['POST', '/api/organizations/a/expenses', { ...expenseBody, itemIds: [] }, 'EVENT_COMPLETED'],
      ['PATCH', `/api/organizations/a/expenses/${expenseId}`, { version: 1, ...expenseBody, itemIds: [approvedId] }, 'EVENT_COMPLETED'],
      ['POST', `/api/organizations/a/expenses/${expenseId}/void`, { version: 1, reason: '잘못 기록' }, 'EVENT_COMPLETED'],
      ['POST', '/api/organizations/a/purchase-review/decisions', { decisions: [{ id: pending!.id, version: 1, decision: 'approved' }] }, 'EVENT_COMPLETED'],
      ['POST', `/api/organizations/a/purchase-review/${approvedId}/revoke`, { version: 1 }, 'EVENT_COMPLETED'],
      ['POST', `/api/organizations/a/purchase-review/${approvedId}/purchased`, { version: 1, purchased: false }, 'EVENT_COMPLETED'],
      ['POST', '/api/organizations/a/shipments', { carrierId: 'kr.cjlogistics', trackingNumber: '9876543210', purchaseItemIds: [approvedId],
        idempotencyKey: 'probe-shipment' }, 'EVENT_COMPLETED'],
      ['POST', '/api/organizations/a/shipments/s1/unlink', { linkIds: ['si1'] }, 'EVENT_COMPLETED'],
      ['POST', `/api/public/registration-forms/${form.code}/entries`, { name: '박학생', studentId: '20260002', phone: null, agreed: true }, 'REGISTRATION_NOT_OPEN'],
      ['POST', '/api/public/registrations/cancel', { token }, 'CANCEL_CLOSED'],
    ]
    for (const [method, path, body, error] of others) {
      const response = await send(method, path, body)
      assert.equal(response.status, 409, `${method} ${path}: ${await response.clone().text()}`)
      assert.deepEqual(await response.json(), { error }, `${method} ${path}`)
    }

    // 완료한 행사에서도 결과보고서는 쓴다.
    assert.equal((await send('POST', at('/report'), { version: 0, operations: '진행', wentWell: null, shortfalls: null, improvements: null,
      handover: null })).status, 200)

    // 완료를 취소하면 같은 쓰기가 다시 된다.
    assert.equal((await send('POST', at('/completion/cancel'), { version: 2 })).status, 200)
    assert.equal((await send('POST', at('/messages'), { content: '고마워요' })).status, 201)
  } finally { await env.pg.close() }
})
