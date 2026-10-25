import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  EventResponse,
  ExpenseResponse,
  IncomesResponse,
  MessagePageResponse,
  OpenDirectResponse,
  PurchaseRequestResponse,
  RoomListResponse,
  TaskResponse,
  TeamResponse,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { expenseRowsForExport, incomeRowsForExport } from '../closing/export-rows.js'
import { createApp } from '../app.js'
import { updateRecord } from '../records/records.js'
import { markLeft } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'
import { createTeamRoutes } from './routes.js'

// 기획부원(L1)이 먼저, 재정부원(L2)이 나중에 탈퇴했다. 내보낸 운영진(ended)은 탈퇴가 아니다(DEC-47, DEC-54).
const L1_NAME = '떠난 운영진 1'
const L2_NAME = '떠난 운영진 2'
const JOINED = '2026-03-01T00:00:00Z'

const json = async <T>(response: Response): Promise<T> => {
  assert.ok(response.ok, await response.clone().text())
  return (await response.json()) as T
}

// 두 사람이 탈퇴하기 전에 한 일: 대화, 행사 책임, 업무, 구매 요청과 결재, 지출, 수입.
async function before(t: SettlementKit) {
  const { president, planningMember: l1, financeMember: l2, ended } = t.council.people
  const org = `/api/organizations/${t.council.councilId}`
  const rooms = await json<RoomListResponse>(await t.api.get(`${org}/rooms`, 's-president'))
  await t.pg.query('UPDATE room_membership SET joined_at = $1', [JOINED])
  const all = rooms.rooms.find(room => room.type === 'all_members')!.id
  const { roomId: direct } = await json<OpenDirectResponse>(
    await t.api.post(`${org}/direct`, { memberId: president.memberId }, 's-planningMember'),
  )
  await json(
    await t.api.post(`${org}/rooms/${direct}/messages`, { body: '하나' }, 's-planningMember'),
  )
  await json(await t.api.post(`${org}/rooms/${all}/messages`, { body: '둘' }, 's-financeMember'))
  const eventId = await t.event({ ownerId: l1.memberId })
  await t.db.transaction(tx =>
    updateRecord(tx, {
      kind: 'event',
      id: eventId,
      actor: l2.memberId,
      reason: null,
      changes: { ownerId: l2.memberId },
    }),
  )
  const taskId = await t.make(
    t.council,
    'task',
    { title: '현수막', assigneeId: l2.memberId, departmentId: t.council.departments.planning },
    l1.memberId,
  )
  const { request, line } = await t.requestWithItem(null)
  await t.approve(line)
  const { period } = await t.budgetOf()
  const expenseId = await t.expense({ paidBy: l1.memberId, requestedBy: l2.memberId })
  const keptId = await t.expense({ paidBy: ended.memberId })
  await t.make(
    t.council,
    'income',
    { fiscalPeriodId: period, source: 'fee', amount: '30000', receivedOn: '2026-10-20' },
    l2.memberId,
  )
  return { org, all, direct, eventId, taskId, request, expenseId, keptId, period }
}

// 결산 내보내기의 적은 사람·먼저 낸 사람·요청한 사람과 운영진 목록.
async function exportAndTeam(t: SettlementKit, done: Awaited<ReturnType<typeof before>>) {
  const actor = { councilId: t.council.councilId } as Actor
  const closing = {
    id: done.period,
    name: '2026-2',
    startsOn: '2026-09-01',
    endsOn: '2027-02-28',
    budgetId: null,
    previousPeriodId: null,
  }
  assert.deepEqual(
    (await incomeRowsForExport(t.db, actor, closing)).map(row => row.recorder),
    [L2_NAME],
  )
  const exported = await expenseRowsForExport(t.db, actor, closing)
  const row = exported.find(item => item.id === done.expenseId)!
  assert.deepEqual([row.payer, row.requester, row.recorder], [L1_NAME, L2_NAME, 's president'])

  const team = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      team: createTeamRoutes(t.db, testSession, () => new Date('2026-10-25T03:00:00Z')),
    }),
  )
  const members = (await json<TeamResponse>(await team.get(`${done.org}/members`, 's-president')))
    .members
  assert.equal(
    members.find(item => item.id === t.council.people.planningMember.memberId)?.name,
    L1_NAME,
  )
  assert.equal(members.find(item => item.id === t.council.people.plain.memberId)?.name, 's plain')
}

test(
  '탈퇴한 운영진은 그 학생회의 모든 조회에서 떠난 운영진 N이고, 내보낸 운영진과 남은 사람은 이름 그대로다',
  withSettlement(async t => {
    const done = await before(t)
    const { planningMember: l1, financeMember: l2 } = t.council.people
    await markLeft(t.pg, l1.memberId, '2026-10-24T01:00:00Z')
    await markLeft(t.pg, l2.memberId, '2026-10-24T02:00:00Z')
    const get = async <T>(path: string) =>
      json<T>(await t.api.get(`${done.org}${path}`, 's-president'))

    const rooms = await get<RoomListResponse>('/rooms')
    assert.equal(rooms.rooms.find(room => room.id === done.direct)?.name, L1_NAME)
    // 방 줄 미리보기의 보낸 사람도 같은 이름이다(DEC-90).
    assert.deepEqual(
      [done.direct, done.all].map(
        id => rooms.rooms.find(room => room.id === id)?.lastMessage?.senderName,
      ),
      [L1_NAME, L2_NAME],
    )
    const senders = async (roomId: string) =>
      (await get<MessagePageResponse>(`/rooms/${roomId}/messages`)).messages.map(
        item => item.senderName,
      )
    assert.deepEqual(await senders(done.direct), [L1_NAME])
    assert.deepEqual(await senders(done.all), [L2_NAME])

    const { event } = await get<EventResponse>(`/events/${done.eventId}`)
    assert.equal(event.owner?.name, L2_NAME)
    const ownerChange = event.history[1]!
    assert.equal(ownerChange.by?.name, L2_NAME)
    assert.deepEqual(
      ownerChange.changes.map(item =>
        item.field === 'owner' ? [item.from?.name, item.to?.name] : null,
      ),
      [[L1_NAME, L2_NAME]],
    )

    const { task } = await get<TaskResponse>(`/tasks/${done.taskId}`)
    assert.equal(task.assignee?.name, L2_NAME)
    assert.equal(task.createdBy?.name, L1_NAME)

    const { request } = await get<PurchaseRequestResponse>(`/purchase-requests/${done.request}`)
    assert.equal(request.requestedBy.name, L1_NAME)
    assert.deepEqual(
      request.decisions.map(item => item.by?.name),
      [L2_NAME],
    )

    const { expense } = await get<ExpenseResponse>(`/expenses/${done.expenseId}`)
    assert.equal(expense.paidBy?.name, L1_NAME)
    assert.equal(expense.requestedBy?.name, L2_NAME)
    const kept = await get<ExpenseResponse>(`/expenses/${done.keptId}`)
    assert.equal(kept.expense.paidBy?.name, 's ended')

    const { incomes } = await get<IncomesResponse>(`/incomes?period=${done.period}`)
    assert.deepEqual(
      incomes.map(item => item.createdBy?.name),
      [L2_NAME],
    )

    await exportAndTeam(t, done)
  }),
)

test(
  '다른 학생회의 탈퇴는 이 학생회의 번호에 들지 않는다',
  withSettlement(async t => {
    const done = await before(t)
    // 다른 학생회의 사람이 먼저 탈퇴해도 이 학생회의 L1은 1번이다.
    await markLeft(t.pg, t.other.people.plain.memberId, '2026-10-23T01:00:00Z')
    await markLeft(t.pg, t.council.people.planningMember.memberId, '2026-10-24T01:00:00Z')
    const { event } = await json<EventResponse>(
      await t.api.get(`${done.org}/events/${done.eventId}`, 's-president'),
    )
    assert.deepEqual(
      event.history[1]!.changes.map(item => (item.field === 'owner' ? item.from?.name : null)),
      [L1_NAME],
    )
    assert.equal(event.owner?.name, 's financeMember')
  }),
)
