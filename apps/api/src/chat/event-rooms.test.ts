import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  EventDetail,
  EventRoomsResponse,
  MessagePageResponse,
  RoomListResponse,
} from '@vada/contracts'
import { actorOf } from '../access/actor.js'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { createEventRoutes } from '../events/routes.js'
import type { PushSender } from '../push/sender.js'
import { createRecord } from '../records/records.js'
import { createSettlementRoutes } from '../settlement/routes.js'
import { createTaskRoutes } from '../tasks/routes.js'
import { createTeamRoutes } from '../team/routes.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createChatPush } from './notify.js'
import { createChatRoutes } from './routes.js'
import { linkSourceMessage } from './source-message.js'

// 행사 방과 보관(022 조각 8, DEC-90): 행사마다 공지방과 부서방, 완료한 행사의 방은 읽기만 된다.

// 한국 시각 2026-10-25 12:00. 기본 기수는 2026-01-01부터 12-31까지다.
const now = new Date('2026-10-25T03:00:00Z')
const MISSING = '019e0000-0000-7000-8000-000000000000'
const endpointOf = (user: string) => `https://fcm.googleapis.com/fcm/send/${user}`
// 끝난 행사(완료할 수 있다)
const PAST = { name: '가을 축제', startsAt: '2026-10-20T10:00', endsAt: '2026-10-20T18:00' }

async function start() {
  const { pg, db, close } = await createTestDb()
  const council = await seedCouncil(db, pg)
  const other = await seedCouncil(db, pg, 'o')
  const calls: Parameters<PushSender>[] = []
  const push = createChatPush(db, async (...args) => {
    calls.push(args)
    return { result: 'sent' }
  })
  const pending: Promise<void>[] = []
  // 알림은 커밋 뒤에 떼어 보낸다. 시험 DB(PGlite)는 연결이 하나라 다음 요청 전에 알림이 끝나기를 기다린다.
  const waiting = {
    seen: push.seen,
    notify: (id: string, at: Date, options?: { except?: string }) => {
      const done = push.notify(id, at, options)
      pending.push(done)
      return done
    },
  }
  const api = caller(
    createApp({
      auth: { handler: async () => new Response() },
      trustedOrigin: ORIGIN,
      events: createEventRoutes(db, testSession, { clock: () => now, push: waiting }),
      chat: createChatRoutes(db, testSession, { clock: () => now, push: waiting }),
      team: createTeamRoutes(db, testSession, () => now),
      settlement: createSettlementRoutes(db, testSession, { clock: () => now }),
      tasks: createTaskRoutes(db, testSession, { clock: () => now }),
    }),
  )
  const base = `/api/organizations/${council.councilId}`
  const person = council.people
  const createEvent = async (body: unknown = PAST, user = 's-president', at = base) => {
    const response = await api.post(`${at}/events`, body, user)
    await Promise.all(pending)
    assert.equal(response.status, 201)
    return ((await response.json()) as { event: EventDetail }).event.id
  }
  // 행사 방: "notice" 또는 부서 이름 → 참여한 운영진 이름(정렬)
  const eventRoomMap = async (eventId: string) => {
    const { rows } = await pg.query<{ room: string; person: string | null }>(
      `SELECT CASE WHEN cr.type = 'all_members' THEN 'notice' ELSE d.name END AS room, m.name AS person
         FROM chat_room cr
         LEFT JOIN department d ON d.id = cr.department_id
         LEFT JOIN room_membership rm ON rm.room_id = cr.id
         LEFT JOIN member m ON m.id = rm.member_id
        WHERE cr.event_id = $1 ORDER BY m.name`,
      [eventId],
    )
    const rooms: Record<string, string[]> = {}
    for (const { room, person: name } of rows) (rooms[room] ??= []).push(...(name ? [name] : []))
    return rooms
  }
  const eventRoomId = async (eventId: string, which: string) =>
    (
      await pg.query<{ id: string }>(
        `SELECT cr.id FROM chat_room cr LEFT JOIN department d ON d.id = cr.department_id
          WHERE cr.event_id = $1 AND CASE WHEN cr.type = 'all_members' THEN 'notice' ELSE d.name END = $2`,
        [eventId, which],
      )
    ).rows[0]!.id
  const councilRoomId = async (which: string) =>
    (
      await pg.query<{ id: string }>(
        `SELECT cr.id FROM chat_room cr JOIN record r ON r.id = cr.id
           LEFT JOIN department d ON d.id = cr.department_id
          WHERE r.council_id = $1 AND cr.event_id IS NULL
            AND CASE WHEN cr.type = 'all_members' THEN 'all' WHEN cr.type = 'department' THEN d.name
                ELSE cr.type END = $2`,
        [council.councilId, which],
      )
    ).rows[0]!.id
  const send = async (roomId: string, body: unknown, user = 's-president') => {
    const response = await api.post(`${base}/rooms/${roomId}/messages`, body, user)
    await Promise.all(pending)
    return response
  }
  const list = async (user = 's-president') => {
    const response = await api.get(`${base}/rooms`, user)
    assert.equal(response.status, 200)
    return (await response.json()) as RoomListResponse
  }
  const eventRooms = async (eventId: string, user = 's-president') => {
    const response = await api.get(`${base}/events/${eventId}/rooms`, user)
    assert.equal(response.status, 200)
    return (await response.json()) as EventRoomsResponse
  }
  const complete = async (eventId: string) =>
    assert.equal(
      (await api.post(`${base}/events/${eventId}/complete`, { reason: null }, 's-president'))
        .status,
      200,
    )
  const cancelCompletion = async (eventId: string) =>
    assert.equal(
      (
        await api.post(
          `${base}/events/${eventId}/cancel-completion`,
          { reason: '다시 열어요' },
          's-president',
        )
      ).status,
      200,
    )
  const assign = async (memberId: string, departmentId: string) =>
    assert.equal(
      (
        await api.post(
          `${base}/members/${memberId}/departments`,
          { departmentId, rank: null },
          's-president',
        )
      ).status,
      200,
    )
  const unassign = async (memberId: string, departmentId: string) =>
    assert.equal(
      (
        await api.post(
          `${base}/members/${memberId}/departments/${departmentId}/remove`,
          {},
          's-president',
        )
      ).status,
      200,
    )
  for (const kit of [council, other])
    for (const someone of Object.values(kit.people))
      await pg.query(
        'INSERT INTO push_device (user_id, endpoint, p256dh, auth) VALUES ($1,$2,$3,$4)',
        [someone.userId, endpointOf(someone.userId), 'p', 'a'],
      )
  return {
    pg,
    db,
    close,
    api,
    base,
    council,
    other,
    person,
    calls,
    createEvent,
    eventRoomMap,
    eventRoomId,
    councilRoomId,
    send,
    list,
    eventRooms,
    complete,
    cancelCompletion,
    assign,
    unassign,
  }
}

type Kit = Awaited<ReturnType<typeof start>>
const run = (body: (t: Kit) => Promise<void>) => async () => {
  const t = await start()
  try {
    await body(t)
  } finally {
    await t.close()
  }
}

// 지금 운영진 이름(내보낸 운영진 빼고), 정렬
const CURRENT = [
  's financeMember',
  's plain',
  's planningHead',
  's planningMember',
  's planningViceHead',
  's president',
  's vicePresident',
]
const PLANNING = ['s planningHead', 's planningMember', 's planningViceHead']

test(
  '행사를 만들면 공지방(모든 지금 운영진)과 운영진이 있는 부서마다 부서방(그 부서 소속)이 생긴다. 회장단방은 없다',
  run(async t => {
    const eventId = await t.createEvent()
    assert.deepEqual(await t.eventRoomMap(eventId), {
      notice: CURRENT,
      재정부: ['s financeMember'],
      기획부: PLANNING,
    })
    // 만들기 글은 우리 학생회 공지방에 오르고 행사 방은 비어 있다(행사 방은 첫 메시지 뒤에 목록에 나온다).
    const posted = await t.pg.query<{ event_id: string | null }>(
      'SELECT cr.event_id FROM message m JOIN chat_room cr ON cr.id = m.room_id',
    )
    assert.deepEqual(posted.rows, [{ event_id: null }])
  }),
)

test(
  '회장이 부서를 겸하면 새 행사의 메시지 탭에 공지방과 그 부서방이 있다',
  run(async t => {
    await t.assign(t.person.president.memberId, t.council.departments.finance)
    const eventId = await t.createEvent()
    assert.deepEqual(
      (await t.eventRooms(eventId, 's-president')).rooms.map(room => [room.type, room.name]),
      [
        ['all_members', null],
        ['department', '재정부'],
      ],
    )
  }),
)

test(
  '이미 있는 행사는 방 목록이나 행사 방을 읽으면 방이 생기고, 두 번 읽어도 하나씩이다. 완료한 행사는 만들지 않는다',
  run(async t => {
    const make = (name: string) =>
      t.db.transaction(tx =>
        createRecord(tx, {
          kind: 'event',
          councilId: t.council.councilId,
          actor: t.person.president.memberId,
          values: { name, startsAt: new Date('2026-10-20T01:00:00Z') },
        }),
      )
    const first = await make('봄 축제')
    const second = await make('체육대회')
    const done = await make('지난 행사')
    await t.db.transaction(tx =>
      createRecord(tx, {
        kind: 'approval',
        councilId: t.council.councilId,
        actor: t.person.president.memberId,
        values: {
          targetId: done,
          targetKind: 'event',
          outcome: 'completed',
          actorId: t.person.president.memberId,
          actorKind: 'member',
          actedAt: new Date('2026-10-21T01:00:00Z'),
        },
      }),
    )
    await t.list()
    await t.list()
    assert.deepEqual((await t.eventRoomMap(first)).notice, CURRENT)
    assert.deepEqual((await t.eventRoomMap(second)).기획부, PLANNING)
    assert.deepEqual(await t.eventRoomMap(done), {})
    const rooms = await t.eventRooms(second)
    assert.deepEqual(
      rooms.rooms.map(room => room.type),
      ['all_members'],
    )
    const count = await t.pg.query('SELECT 1 FROM chat_room WHERE event_id IS NOT NULL')
    assert.equal(count.rows.length, 6)
    // 완료한 행사의 탭은 방이 없어도 읽힌다(보관).
    assert.deepEqual(await t.eventRooms(done), { rooms: [], archived: true })
  }),
)

test(
  '부서를 옮기면 보관되지 않은 행사의 부서방 참여가 바뀌고, 완료한 행사의 방은 그대로다. 학생회 편성 방은 행사 방과 섞이지 않는다',
  run(async t => {
    const open = await t.createEvent({ name: '체육대회' })
    const done = await t.createEvent()
    await t.complete(done)
    const { plain, planningMember } = t.person
    await t.assign(plain.memberId, t.council.departments.finance)
    await t.unassign(planningMember.memberId, t.council.departments.planning)
    assert.deepEqual((await t.eventRoomMap(open)).재정부, ['s financeMember', 's plain'])
    assert.deepEqual((await t.eventRoomMap(open)).기획부, ['s planningHead', 's planningViceHead'])
    assert.deepEqual((await t.eventRoomMap(done)).재정부, ['s financeMember'])
    assert.deepEqual((await t.eventRoomMap(done)).기획부, PLANNING)
    // 학생회 부서방은 하나씩이고 편성을 따른다(isPlanRoom이 행사 방을 잡지 않는다).
    const councilRooms = await t.pg.query<{ name: string; n: string }>(
      `SELECT d.name, count(*)::text AS n FROM chat_room cr JOIN department d ON d.id = cr.department_id
        WHERE cr.event_id IS NULL GROUP BY d.name ORDER BY d.name`,
    )
    assert.deepEqual(
      councilRooms.rows.filter(row => row.n !== '1'),
      [],
    )
    // 완료를 취소하면 다시 열리고 참여가 지금 편성으로 맞는다.
    await t.cancelCompletion(done)
    assert.deepEqual((await t.eventRoomMap(done)).재정부, ['s financeMember', 's plain'])
    assert.equal(
      (await t.send(await t.eventRoomId(done, '재정부'), { body: '다시 준비해요' }, 's-plain'))
        .status,
      201,
    )
  }),
)

test(
  '대화 목록에는 메시지가 있는 행사 방만 행사 번호·이름과 함께 학생회 방 뒤에 있고, 행사 방은 메시지가 없어도 행사 방 읽기에 있다',
  run(async t => {
    const eventId = await t.createEvent({ name: '체육대회' })
    const before = await t.list('s-planningMember')
    assert.ok(before.rooms.every(room => room.eventId === null && room.eventName === null))
    const tab = await t.eventRooms(eventId, 's-planningMember')
    assert.equal(tab.archived, false)
    assert.deepEqual(
      tab.rooms.map(room => [room.type, room.name, room.eventId, room.eventName, room.readOnly]),
      [
        ['all_members', null, eventId, '체육대회', false],
        ['department', '기획부', eventId, '체육대회', false],
      ],
    )
    // 회장단은 부서가 없으면 공지방만이다.
    assert.deepEqual(
      (await t.eventRooms(eventId, 's-president')).rooms.map(room => room.type),
      ['all_members'],
    )
    const room = await t.eventRoomId(eventId, '기획부')
    assert.equal((await t.send(room, { body: '준비물 정리' }, 's-planningHead')).status, 201)
    const after = await t.list('s-planningMember')
    const last = after.rooms.at(-1)!
    assert.deepEqual(
      [last.id, last.eventId, last.eventName, last.unread],
      [room, eventId, '체육대회', 1],
    )
    assert.ok(after.rooms.slice(0, -1).every(item => item.eventId === null))
    assert.equal(after.unreadTotal, before.unreadTotal + 1)
    // 그 방에 들지 않은 사람의 목록에는 없다.
    assert.ok((await t.list('s-financeMember')).rooms.every(item => item.id !== room))
  }),
)

test(
  '행사가 완료되면 보내기는 409 ROOM_ARCHIVED이고 목록·합계·알림에서 빠지며 읽기는 된다. 완료를 취소하면 다시 보낸다',
  run(async t => {
    const eventId = await t.createEvent()
    const room = await t.eventRoomId(eventId, 'notice')
    assert.equal((await t.send(room, { body: '내일 봬요' }, 's-planningHead')).status, 201)
    assert.equal((await t.list()).rooms.filter(item => item.eventId === eventId).length, 1)
    await t.complete(eventId)
    const refused = await t.send(room, { body: '수고했어요' }, 's-planningHead')
    assert.equal(refused.status, 409)
    assert.deepEqual(await refused.json(), { error: 'ROOM_ARCHIVED' })
    const listed = await t.list()
    assert.ok(listed.rooms.every(item => item.eventId !== eventId))
    assert.equal(listed.unreadTotal, 0)
    const tab = await t.eventRooms(eventId)
    assert.equal(tab.archived, true)
    assert.ok(tab.rooms.every(item => item.readOnly))
    const page = await t.api.get(`${t.base}/rooms/${room}/messages`, 's-president')
    assert.equal(page.status, 200)
    assert.deepEqual(
      ((await page.json()) as MessagePageResponse).messages.map(item => item.body),
      ['내일 봬요'],
    )
    // 보관 뒤에는 알림이 없다(보관 전에 보낸 글의 알림이 늦게 가도 빠진다).
    t.calls.length = 0
    const [{ id: lateId }] = (
      await t.pg.query<{ id: string }>('SELECT id FROM message WHERE room_id = $1', [room])
    ).rows as [{ id: string }]
    await createChatPush(t.db, async (...args) => {
      t.calls.push(args)
      return { result: 'sent' }
    }).notify(lateId, now)
    assert.equal(t.calls.length, 0)
    await t.cancelCompletion(eventId)
    assert.equal((await t.send(room, { body: '다시 열었어요' }, 's-planningHead')).status, 201)
    assert.ok(t.calls.length > 0)
    assert.equal((await t.list()).rooms.filter(item => item.eventId === eventId).length, 1)
  }),
)

test(
  '행사 방 알림 제목은 행사 이름을 붙인 방 이름이다',
  run(async t => {
    const eventId = await t.createEvent({ name: '체육대회' })
    t.calls.length = 0
    await t.send(await t.eventRoomId(eventId, 'notice'), { body: '모여요' }, 's-planningHead')
    await t.send(await t.eventRoomId(eventId, '기획부'), { body: '준비해요' }, 's-planningHead')
    assert.deepEqual([...new Set(t.calls.map(call => call[1].title))].sort(), [
      '체육대회 공지방',
      '체육대회 기획부',
    ])
  }),
)

test(
  '행사 공지방에도 들어오기 전 규칙이 맞다: 늦게 들어온 같은 기수는 공지방의 이전 글을 보고, 부서방의 이전 글은 못 본다',
  run(async t => {
    const eventId = await t.createEvent({ name: '체육대회' })
    const notice = await t.eventRoomId(eventId, 'notice')
    const finance = await t.eventRoomId(eventId, '재정부')
    await t.send(notice, { body: '공지: 내일 모임' }, 's-president')
    await t.send(finance, { body: '영수증 모으기' }, 's-financeMember')
    // 기획부원을 재정부에도 넣는다. 재정부방에는 지금 들어온다.
    await t.assign(t.person.planningMember.memberId, t.council.departments.finance)
    await t.pg.query(
      `UPDATE room_membership SET joined_at = now() + interval '1 hour'
        WHERE member_id = $1 AND room_id = ANY($2)`,
      [t.person.planningMember.memberId, [notice, finance]],
    )
    const bodies = async (room: string) =>
      (
        (await (
          await t.api.get(`${t.base}/rooms/${room}/messages`, 's-planningMember')
        ).json()) as MessagePageResponse
      ).messages.map(item => item.body)
    assert.deepEqual(await bodies(notice), ['공지: 내일 모임'])
    assert.deepEqual(await bodies(finance), [])
  }),
)

test(
  '행사 방 메시지를 요청의 근거로 잇는다(완료한 행사의 방 포함). 들지 않은 행사 부서방의 메시지는 409다',
  run(async t => {
    const eventId = await t.createEvent()
    const room = await t.eventRoomId(eventId, '기획부')
    const sent = (await (
      await t.send(room, { body: '마커 사 주세요' }, 's-planningMember')
    ).json()) as {
      id: string
    }
    await t.complete(eventId)
    const link = (user: string) =>
      t.db.transaction(async tx => {
        const actor = (await actorOf(tx, user, t.council.councilId, now))!
        const requestId = await createRecord(tx, {
          kind: 'request',
          councilId: t.council.councilId,
          actor: actor.memberId,
          values: { type: 'purchase', title: '마커', requestedBy: actor.memberId },
        })
        await linkSourceMessage(tx, actor, requestId, sent.id)
      })
    await link('s-planningHead')
    await assert.rejects(link('s-financeMember'), { code: 'MESSAGE_INVALID' })
  }),
)

test(
  '행사에 이은 업무의 공지 만들기는 그 행사 공지방에서만 받는다. 학생회 업무는 학생회 공지방에서만 받는다',
  run(async t => {
    const eventId = await t.createEvent({ name: '체육대회' })
    await t.list()
    const task = (values: Record<string, unknown>) =>
      t.db.transaction(tx =>
        createRecord(tx, {
          kind: 'task',
          councilId: t.council.councilId,
          actor: t.person.president.memberId,
          values: { title: '공지 올리기', departmentId: t.council.departments.planning, ...values },
        }),
      )
    const eventTask = await task({ eventId })
    const councilTask = await task({})
    const eventNotice = await t.eventRoomId(eventId, 'notice')
    const councilNotice = await t.councilRoomId('all')
    const status = async (room: string, taskId: string, user = 's-president') =>
      (await t.send(room, { body: '공지', taskId }, user)).status
    assert.equal(await status(councilNotice, eventTask), 400)
    assert.equal(await status(eventNotice, councilTask), 400)
    assert.equal(
      await status(await t.eventRoomId(eventId, '기획부'), eventTask, 's-planningHead'),
      400,
    )
    assert.equal(await status(eventNotice, eventTask), 201)
    assert.equal(await status(councilNotice, councilTask), 201)
    const linked = await t.pg.query<{ room_id: string }>(
      `SELECT m.room_id FROM task_result tr JOIN message m ON m.id = tr.result_id
        WHERE tr.task_id = $1`,
      [eventTask],
    )
    assert.deepEqual(linked.rows, [{ room_id: eventNotice }])
  }),
)

test(
  '행사 방 읽기: 로그인하지 않으면 401, 다른 학생회 운영진이면 403, 다른 학생회 행사·없는 행사·형식이 틀린 번호는 404',
  run(async t => {
    const mine = await t.createEvent({ name: '체육대회' })
    const theirs = await t.createEvent(
      { name: '체육대회' },
      'o-president',
      `/api/organizations/${t.other.councilId}`,
    )
    const status = async (eventId: string, user?: string) =>
      (await t.api.get(`${t.base}/events/${eventId}/rooms`, user)).status
    assert.equal(await status(mine), 401)
    assert.equal(await status(mine, 'o-president'), 403)
    assert.equal(await status(mine, 's-ended'), 403)
    assert.equal(await status(theirs, 's-president'), 404)
    assert.equal(await status(MISSING, 's-president'), 404)
    assert.equal(await status('not-a-uuid', 's-president'), 404)
    // 다른 학생회의 같은 이름 행사 방은 내 목록에도, 그 학생회 사람의 목록에도 섞이지 않는다.
    await t.send(await t.eventRoomId(mine, 'notice'), { body: '우리 글' })
    const theirList = (await (
      await t.api.get(`/api/organizations/${t.other.councilId}/rooms`, 'o-president')
    ).json()) as RoomListResponse
    assert.ok(theirList.rooms.every(room => room.eventId !== mine))
    assert.deepEqual(
      (await t.eventRoomMap(theirs)).notice?.every(name => name.startsWith('o ')),
      true,
    )
    // 방이 없는 다른 학생회 행사는 내가 방 목록을 읽어도 방이 생기지 않는다(그 학생회 사람이 읽을 때 생긴다).
    const roomless = await t.db.transaction(tx =>
      createRecord(tx, {
        kind: 'event',
        councilId: t.other.councilId,
        actor: t.other.people.president.memberId,
        values: { name: '체육대회' },
      }),
    )
    await t.list()
    await t.eventRooms(mine)
    assert.deepEqual(await t.eventRoomMap(roomless), {})
  }),
)

test(
  '행사가 완료된 열린 업무에는 공지 만들기가 없고, 완료를 취소하면 다시 있다(보내기의 보관 판정과 같은 규칙)',
  run(async t => {
    const eventId = await t.createEvent()
    const taskId = await t.db.transaction(tx =>
      createRecord(tx, {
        kind: 'task',
        councilId: t.council.councilId,
        actor: t.person.president.memberId,
        values: { title: '공지 올리기', departmentId: t.council.departments.planning, eventId },
      }),
    )
    const canMake = async () => {
      const response = await t.api.get(`${t.base}/tasks/${taskId}`, 's-president')
      assert.equal(response.status, 200)
      return ((await response.json()) as { task: { canMake: string[] } }).task.canMake
    }
    assert.ok((await canMake()).includes('message'))
    await t.complete(eventId)
    assert.ok(!(await canMake()).includes('message'))
    await t.cancelCompletion(eventId)
    assert.ok((await canMake()).includes('message'))
  }),
)
