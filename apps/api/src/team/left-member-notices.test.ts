import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  ChatPhotoListResponse,
  EventResponse,
  ExpenseResponse,
  OpenDirectResponse,
  RoomDetailResponse,
  TaskCreateOptionsResponse,
} from '@vada/contracts'
import { createChatPush } from '../chat/notify.js'
import { createPurchasePush } from '../purchases/notify.js'
import type { PushMessage, PushSender } from '../push/sender.js'
import { createRecord } from '../records/records.js'
import { createTaskPush } from '../tasks/notify.js'
import { markLeft } from '../test-support/council.js'
import { withSettlement, type SettlementKit } from '../test-support/settlement.js'

// left-member-names.test.ts가 보지 않는 곳: 휴대폰 알림 글, 사진 목록, 방 참여자, 완료·지출 결재, 업무 만들기 선택지.
// 기획부원(L1)이 먼저, 재정부원(L2)이 나중에 탈퇴했다.
const L1_NAME = '떠난 운영진 1'
const L2_NAME = '떠난 운영진 2'
const NOW = new Date('2026-10-25T03:00:00Z')

const json = async <T>(response: Response): Promise<T> => {
  assert.ok(response.ok, await response.clone().text())
  return (await response.json()) as T
}

// 회장의 휴대폰 하나로 받은 알림 글을 모은다.
async function inbox(t: SettlementKit) {
  await t.pg.query(
    'INSERT INTO push_device (user_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4)',
    ['s-president', 'https://fcm.googleapis.com/fcm/send/s-president', 'p', 'a'],
  )
  const received: PushMessage[] = []
  const send: PushSender = async (_target, message) => {
    received.push(message)
    return { result: 'sent' }
  }
  return { send, received }
}

// L1이 회장과 1:1에서 사진을 보내고, 두 사람이 탈퇴한다.
async function setup(t: SettlementKit) {
  const { president, planningMember: l1, financeMember: l2 } = t.council.people
  const org = `/api/organizations/${t.council.councilId}`
  await json(await t.api.get(`${org}/rooms`, 's-president'))
  const { roomId } = await json<OpenDirectResponse>(
    await t.api.post(`${org}/direct`, { memberId: president.memberId }, 's-planningMember'),
  )
  // 들어온 뒤의 메시지만 보인다(DEC-20). 방에 들어온 시각을 메시지보다 앞으로 둔다.
  await t.pg.query('UPDATE room_membership SET joined_at = $1', ['2026-03-01T00:00:00Z'])
  const messageId = await t.db.transaction(async tx => {
    const id = await createRecord(tx, {
      kind: 'message',
      councilId: t.council.councilId,
      actor: l1.memberId,
      values: { roomId, body: '영수증', sentAt: NOW, isNotice: false },
    })
    await createRecord(tx, {
      kind: 'file',
      councilId: t.council.councilId,
      actor: l1.memberId,
      values: {
        name: 'photo-1.jpg',
        mediaType: 'image/jpeg',
        sizeBytes: 10,
        storageKey: `chat/${crypto.randomUUID()}`,
        attachedToId: id,
      },
    })
    return id
  })
  await markLeft(t.pg, l1.memberId, '2026-10-24T01:00:00Z')
  await markLeft(t.pg, l2.memberId, '2026-10-24T02:00:00Z')
  const get = async <T>(path: string) => json<T>(await t.api.get(`${org}${path}`, 's-president'))
  return { roomId, messageId, get }
}

test(
  '대화: 1:1 알림 제목, 사진 목록의 보낸 사람, 방 참여자가 떠난 운영진 N이다',
  withSettlement(async t => {
    const { roomId, messageId, get } = await setup(t)
    const { send, received } = await inbox(t)
    await createChatPush(t.db, send).notify(messageId, NOW)
    assert.deepEqual(
      received.map(message => message.title),
      [L1_NAME],
    )
    const { photos } = await get<ChatPhotoListResponse>('/chat/photos')
    assert.deepEqual(
      photos.map(photo => [photo.senderName, photo.room.name]),
      [[L1_NAME, L1_NAME]],
    )
    const detail = await get<RoomDetailResponse>(`/rooms/${roomId}`)
    assert.deepEqual(detail.participants.map(item => item.name).sort(), ['s president', L1_NAME])
  }),
)

test(
  '행사 완료 결재와 지출 결재의 결재한 사람이 떠난 운영진 N이다',
  withSettlement(async t => {
    const { get } = await setup(t)
    const { financeMember: l2, planningMember: l1 } = t.council.people
    const eventId = await t.event()
    const expenseId = await t.expense()
    for (const [targetId, targetKind, outcome, actorId] of [
      [eventId, 'event', 'completed', l2.memberId],
      [expenseId, 'expense', 'approved', l1.memberId],
    ] as const)
      await t.make(t.council, 'approval', {
        targetId,
        targetKind,
        outcome,
        actorId,
        actorKind: 'member',
        actedAt: NOW,
      })
    const { event } = await get<EventResponse>(`/events/${eventId}`)
    assert.deepEqual(
      event.approvals.map(item => item.by?.name),
      [L2_NAME],
    )
    const { expense } = await get<ExpenseResponse>(`/expenses/${expenseId}`)
    assert.deepEqual(
      expense.approvals.map(item => item.by?.name),
      [L1_NAME],
    )
  }),
)

test(
  '구매 요청 알림과 업무 알림의 글, 업무 만들기 선택지가 떠난 운영진 N이다',
  withSettlement(async t => {
    const { get } = await setup(t)
    const { president, planningMember: l1, financeMember: l2 } = t.council.people
    // 요청한 사람은 L1, 결재한 사람은 L2다(requestWithItem, approve의 기본값).
    const { request, line } = await t.requestWithItem(null)
    const { send, received } = await inbox(t)
    const purchases = createPurchasePush(t.db, send)
    await purchases.notify({
      requestId: request,
      recipientIds: [president.memberId],
      decidedBy: null,
    })
    await t.approve(line)
    await purchases.notify({
      requestId: request,
      recipientIds: [president.memberId],
      decidedBy: l2.memberId,
    })
    const taskId = await t.make(
      t.council,
      'task',
      { title: '현수막', assigneeId: president.memberId },
      l1.memberId,
    )
    const timers: Promise<void>[] = []
    const tasks = createTaskPush(t.db, send, (_ms, run) => {
      timers.push(run())
      return () => {}
    })
    tasks.notify({
      taskId,
      recipientId: president.memberId,
      assignerId: l1.memberId,
      previous: null,
    })
    await Promise.all(timers)
    assert.deepEqual(
      received.map(message => message.body),
      [`${L1_NAME}: 마커 · 품목 1개`, `${L2_NAME}: 마커`, `${L1_NAME}: 현수막`],
    )
    const options = await get<TaskCreateOptionsResponse>('/tasks/options')
    const names = new Set(
      options.departments.flatMap(item => item.assignees.map(person => person.name)),
    )
    assert.ok(
      names.has(L1_NAME) && names.has(L2_NAME) && names.has('s president'),
      [...names].join(),
    )
  }),
)
