import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { EventDetail } from '@vada/contracts'
import { createChatPush } from '../chat/notify.js'
import type { PushSender } from '../push/sender.js'
import { createRecord } from '../records/records.js'
import { startEvents, type EventKit } from '../test-support/events.js'

// 행사의 끼룩이 글(025 조각 4, DEC-90, DEC-93): 행사를 만들거나 이름·일시·장소를 바꾸면 같은 거래에서 공지방에 보낸 사람 없는 글 하나.

const FULL = {
  name: '가을 축제',
  startsAt: '2026-11-05T14:00',
  endsAt: '2026-11-05T18:00',
  place: '대운동장',
}
const endpointOf = (user: string) => `https://fcm.googleapis.com/fcm/send/${user}`

type Kit = EventKit & { calls: Parameters<PushSender>[]; settled: () => Promise<void> }

async function setup(): Promise<Kit> {
  const calls: Parameters<PushSender>[] = []
  const send: PushSender = async (...args) => {
    calls.push(args)
    return { result: 'sent' }
  }
  const pending: Promise<void>[] = []
  let chatPush: ReturnType<typeof createChatPush> | undefined
  const t = await startEvents({
    push: {
      notify: (id: string, at: Date, options?: { except?: string }) => {
        const done = chatPush!.notify(id, at, options)
        pending.push(done)
        return done
      },
    },
  })
  chatPush = createChatPush(t.db, send)
  for (const kit of [t.council, t.other])
    for (const person of Object.values(kit.people))
      await t.pg.query(
        'INSERT INTO push_device (user_id, endpoint, p256dh, auth) VALUES ($1,$2,$3,$4)',
        [person.userId, endpointOf(person.userId), 'p', 'a'],
      )
  const settled = async () => {
    await Promise.all(pending)
  }
  // 알림은 커밋 뒤에 떼어 보낸다. 시험 DB(PGlite)는 연결이 하나라, 다음 요청 전에 알림이 끝나기를 기다린다(chat/notify.test.ts와 같다).
  const after =
    <A extends unknown[]>(call: (...args: A) => Promise<Response> | Response) =>
    async (...args: A) => {
      const response = await call(...args)
      await settled()
      return response
    }
  return {
    ...t,
    post: after(t.post),
    api: { ...t.api, post: after(t.api.post) },
    calls,
    settled,
  }
}

const run = (body: (t: Kit) => Promise<void>) => async () => {
  const t = await setup()
  try {
    await body(t)
  } finally {
    await t.close()
  }
}

type Posted = {
  body: string
  created_by: string | null
  council_id: string
  event_id: string | null
}
// 학생회의 공지방(all_members) 글. 오래된 것부터다.
const noticesOf = async (t: Kit, councilId: string) =>
  (
    await t.pg.query<Posted>(
      `SELECT m.body, r.created_by, r.council_id, cr.event_id FROM message m
         JOIN record r ON r.id = m.id JOIN chat_room cr ON cr.id = m.room_id
        WHERE r.council_id = $1 AND cr.type = 'all_members' ORDER BY m.sent_at, m.id`,
      [councilId],
    )
  ).rows
const messageCount = (t: Kit) => t.count('SELECT count(*) AS n FROM message')

const create = async (t: Kit, body: unknown, user = 's-president') => {
  const response = await t.post('', body, user)
  assert.equal(response.status, 201)
  return ((await response.json()) as { event: EventDetail }).event
}

test(
  '행사를 만들면 우리 학생회 공지방에 보낸 사람 없는 끼룩이 글이 하나 있다',
  run(async t => {
    await create(t, FULL, 's-planningHead')
    // 만든 사람 이름은 정해진 글로 남기지 않는다(탈퇴하면 '떠난 운영진 N'이어야 한다, DEC-54).
    const [notice] = await noticesOf(t, t.council.councilId)
    assert.ok(!notice?.body.includes('planningHead'))
    assert.deepEqual(await noticesOf(t, t.council.councilId), [
      {
        body: '가을 축제가 생겼어요',
        created_by: null,
        council_id: t.council.councilId,
        event_id: null,
      },
    ])
  }),
)

test(
  '장소를 바꾸면 글 하나, 일시와 장소를 함께 바꾸면 글 하나에 두 줄이다',
  run(async t => {
    const event = await create(t, FULL)
    assert.equal((await t.post(`/${event.id}`, { ...FULL, place: '체육관' })).status, 200)
    assert.equal(
      (
        await t.post(`/${event.id}`, {
          ...FULL,
          startsAt: '2026-11-06T14:00',
          endsAt: '2026-11-06T18:00',
          place: '강당',
        })
      ).status,
      200,
    )
    const bodies = (await noticesOf(t, t.council.councilId)).map(row => row.body)
    assert.deepEqual(bodies.slice(1), [
      '가을 축제 장소가 바뀌었어요 · 대운동장 → 체육관',
      [
        '가을 축제 일시가 바뀌었어요 · 11월 5일 (목) 14:00 ~ 18:00 → 11월 6일 (금) 14:00 ~ 18:00',
        '가을 축제 장소가 바뀌었어요 · 체육관 → 강당',
      ].join('\n'),
    ])
  }),
)

test(
  '같은 값으로 저장하면 글이 없다(공백만 다른 이름 포함)',
  run(async t => {
    const event = await create(t, FULL)
    const before = await messageCount(t)
    assert.equal((await t.post(`/${event.id}`, FULL)).status, 200)
    assert.equal((await t.post(`/${event.id}`, { ...FULL, name: '  가을 축제 ' })).status, 200)
    assert.equal(await messageCount(t), before)
  }),
)

test(
  '고치기가 거절되면(403, 다른 학생회 404) 글이 없다',
  run(async t => {
    const event = await create(t, FULL)
    const before = await messageCount(t)
    assert.equal(
      (await t.post(`/${event.id}`, { ...FULL, place: '체육관' }, 's-plain')).status,
      403,
    )
    const theirs = await t.api.post(
      `/api/organizations/${t.other.councilId}/events/${event.id}`,
      { ...FULL, place: '체육관' },
      'o-president',
    )
    assert.equal(theirs.status, 404)
    assert.equal(await messageCount(t), before)
  }),
)

test(
  '글을 쓰다 실패하면 행사 고치기와 만들기도 되돌아간다(같은 거래)',
  run(async t => {
    const event = await create(t, FULL)
    const versions = await t.versions(event.id)
    await t.pg.exec(`
      CREATE FUNCTION refuse_message() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'refused'; END $$ LANGUAGE plpgsql;
      CREATE TRIGGER refuse_message BEFORE INSERT ON message FOR EACH ROW EXECUTE FUNCTION refuse_message();
    `)
    assert.equal((await t.post(`/${event.id}`, { ...FULL, place: '체육관' })).status, 500)
    assert.equal((await t.detail(event.id)).place, '대운동장')
    assert.equal(await t.versions(event.id), versions)
    assert.equal((await t.post('', { name: '뒤풀이' })).status, 500)
    assert.equal(await t.eventCount(), 1)
  }),
)

test(
  '다른 학생회 공지방에는 글이 없고, 그 학생회의 행사 글은 그 학생회 공지방에만 있다',
  run(async t => {
    // 다른 학생회가 먼저 만들어 그쪽 공지방이 먼저 생긴다. 학생회 거르기가 빠지면 우리 글이 그 방으로 간다.
    await t.api.post(`/api/organizations/${t.other.councilId}/events`, FULL, 'o-president')
    const event = await create(t, FULL)
    await t.post(`/${event.id}`, { ...FULL, place: '체육관' })
    assert.deepEqual(
      (await noticesOf(t, t.other.councilId)).map(row => row.body),
      ['가을 축제가 생겼어요'],
    )
    assert.deepEqual(
      (await noticesOf(t, t.council.councilId)).map(row => row.body),
      ['가을 축제가 생겼어요', '가을 축제 장소가 바뀌었어요 · 대운동장 → 체육관'],
    )
  }),
)

test(
  '행사 공지방이 있으면 그 방에 올린다',
  run(async t => {
    // 행사를 만들면 같은 거래에서 행사 방이 생긴다(022 조각 8). 만들기 글은 그 전에 학생회 공지방에 오른다.
    const event = await create(t, FULL)
    const [{ id: roomId }] = (
      await t.pg.query<{ id: string }>(
        "SELECT id FROM chat_room WHERE event_id = $1 AND type = 'all_members'",
        [event.id],
      )
    ).rows as [{ id: string }]
    await t.post(`/${event.id}`, { ...FULL, place: '체육관' })
    const rows = await t.pg.query<{ room_id: string; body: string }>(
      'SELECT room_id, body FROM message ORDER BY sent_at DESC LIMIT 1',
    )
    assert.deepEqual(rows.rows[0], {
      room_id: roomId,
      body: '가을 축제 장소가 바뀌었어요 · 대운동장 → 체육관',
    })
  }),
)

test(
  '공지방 휴대폰 알림이 대화 알림대로 그 방의 지금 운영진 기기마다 가고, 글을 일으킨 사람과 다른 학생회는 받지 않는다',
  run(async t => {
    const event = await create(t, FULL)
    assert.ok(!t.calls.some(call => call[0].endpoint === endpointOf('s-president')))
    t.calls.length = 0
    await t.post(`/${event.id}`, { ...FULL, place: '체육관' })
    const current = Object.entries(t.council.people)
      .filter(([name]) => name !== 'ended' && name !== 'president')
      .map(([, person]) => endpointOf(person.userId))
      .sort()
    assert.deepEqual(t.calls.map(call => call[0].endpoint).sort(), current)
    assert.deepEqual(
      { title: t.calls[0]![1].title, body: t.calls[0]![1].body },
      // 행사 공지방의 글이라 제목 앞에 행사 이름이 붙는다(022 정한 것 1).
      { title: '가을 축제 공지방', body: '가을 축제 장소가 바뀌었어요 · 대운동장 → 체육관' },
    )
  }),
)

test(
  '업무에서 만든 행사도 만들기 글이 있다',
  run(async t => {
    const taskId = await t.db.transaction(tx =>
      createRecord(tx, {
        kind: 'task',
        councilId: t.council.councilId,
        actor: t.council.people.president.memberId,
        values: { title: '축제 준비', departmentId: t.council.departments.planning },
      }),
    )
    await create(t, { ...FULL, taskId })
    assert.deepEqual(
      (await noticesOf(t, t.council.councilId)).map(row => row.body),
      ['가을 축제가 생겼어요'],
    )
  }),
)

// 그 사람의 공지방 안 읽은 글 수(대화의 안 읽은 수와 같은 셈: 읽은 시각 뒤의 남이 보낸 글).
const unreadOf = (t: Kit, memberId: string) =>
  t.count(
    `SELECT count(*) AS n FROM message m
       JOIN record r ON r.id = m.id JOIN chat_room cr ON cr.id = m.room_id
       JOIN room_membership rm ON rm.room_id = m.room_id AND rm.member_id = $1
      WHERE cr.type = 'all_members' AND r.created_by IS DISTINCT FROM $1
        AND m.sent_at > coalesce(rm.last_read_at, '-infinity'::timestamptz)`,
    [memberId],
  )

test(
  '글을 일으킨 사람은 그 글이 안 읽은 수에 들지 않고, 다른 운영진에게는 든다',
  run(async t => {
    const { president, planningHead } = t.council.people
    const event = await create(t, FULL, 's-planningHead')
    assert.equal(await unreadOf(t, planningHead.memberId), 0)
    assert.equal(await unreadOf(t, president.memberId), 1)
    await t.post(`/${event.id}`, { ...FULL, place: '체육관' })
    // 바꾸기 글은 행사 공지방에 올라 회장에게 들지 않는다. 학생회 공지방의 만들기 글은 그대로 안 읽음이다.
    assert.equal(await unreadOf(t, president.memberId), 1)
    assert.equal(await unreadOf(t, planningHead.memberId), 1)
  }),
)
