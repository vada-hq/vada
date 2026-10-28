import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createTestDb, type TestPg } from '../db/test-db.js'
import type { Tx } from '../db/types.js'
import { clockNow, createRecord, updateRecords, type AnyRecordChange } from './records.js'

const versionsOf = async (pg: TestPg, id: string) =>
  (await pg.query('SELECT version_no FROM record_version WHERE record_id = $1', [id])).rows

// 학생회 둘. 첫 학생회에는 운영진 둘, 둘째에는 운영진 하나가 있고, 학생회마다 전체방이 하나 있다.
async function seed(tx: Tx) {
  const base = { councilId: null, actor: null } as const
  const member = (name: string) =>
    createRecord(tx, { ...base, kind: 'member', values: { name, email: `${name}@e.test` } })
  const kim = await member('kim')
  const lee = await member('lee')
  const park = await member('park')
  const council = (name: string) =>
    createRecord(tx, {
      ...base,
      kind: 'council',
      values: { name, unit: 'department', schoolName: '학교' },
    })
  const mine = await council('우리 학생회')
  const other = await council('다른 학생회')
  const cohortOf = (councilId: string) =>
    createRecord(tx, {
      kind: 'cohort',
      councilId,
      actor: kim,
      values: { name: '2026', startsOn: '2026-01-01', endsOn: '2026-12-31' },
    })
  const myCohort = await cohortOf(mine)
  const otherCohort = await cohortOf(other)
  for (const [memberId, cohortId, councilId] of [
    [kim, myCohort, mine],
    [lee, myCohort, mine],
    [park, otherCohort, other],
  ] as const)
    await createRecord(tx, {
      kind: 'council_membership',
      councilId,
      actor: kim,
      values: { memberId, cohortId, startsAt: clockNow },
    })
  const room = (councilId: string) =>
    createRecord(tx, { kind: 'chat_room', councilId, actor: kim, values: { type: 'all_members' } })
  return { kim, lee, park, mine, other, myRoom: await room(mine), otherRoom: await room(other) }
}
type Seed = Awaited<ReturnType<typeof seed>>

const messageValues = (roomId: string) => ({ roomId, body: '안녕하세요', sentAt: clockNow })
const fileValues = (key: string, attachedToId: string) => ({
  name: 'a.jpg',
  mediaType: 'image/jpeg',
  sizeBytes: 1,
  storageKey: key,
  attachedToId,
})
const mention = (recipientId: string, recordId: string) => ({
  recipientId,
  recordId,
  type: 'mention',
  notifiedAt: clockNow,
})

// 첫 학생회의 메시지 하나와 그것에 붙은 파일, 부름 알림.
async function makeChat(tx: Tx, s: Seed) {
  const made = { councilId: s.mine, actor: s.kim }
  const message = await createRecord(tx, {
    ...made,
    kind: 'message',
    values: messageValues(s.myRoom),
  })
  const file = await createRecord(tx, {
    ...made,
    kind: 'file',
    values: fileValues('chat/a', message),
  })
  const notification = await createRecord(tx, {
    ...made,
    kind: 'notification',
    values: mention(s.lee, message),
  })
  return { message, file, notification }
}

test('방, 메시지, 파일, 부름 알림은 만들 때 판 1이 남는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const chat = await db.transaction(tx => makeChat(tx, s))
    for (const id of [s.myRoom, chat.message, chat.file, chat.notification])
      assert.deepEqual(await versionsOf(pg, id), [{ version_no: 1 }], id)
  } finally {
    await close()
  }
})

test('다른 학생회와 얽히면 실패하고 아무것도 남지 않는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const chat = await db.transaction(tx => makeChat(tx, s))
    const count = async () => (await pg.query('SELECT count(*)::int AS n FROM record')).rows
    const before = await count()
    const attempts: [string, Promise<unknown>][] = [
      [
        '다른 학생회의 방에 메시지',
        db.transaction(tx =>
          createRecord(tx, {
            kind: 'message',
            councilId: s.mine,
            actor: s.kim,
            values: messageValues(s.otherRoom),
          }),
        ),
      ],
      [
        '다른 학생회 기록에 파일',
        db.transaction(tx =>
          createRecord(tx, {
            kind: 'file',
            councilId: s.other,
            actor: s.park,
            values: fileValues('chat/b', chat.message),
          }),
        ),
      ],
      [
        '다른 학생회 사람에게 알림',
        db.transaction(tx =>
          createRecord(tx, {
            kind: 'notification',
            councilId: s.mine,
            actor: s.kim,
            values: mention(s.park, chat.message),
          }),
        ),
      ],
      [
        '다른 학생회 기록을 가리키는 알림',
        db.transaction(tx =>
          createRecord(tx, {
            kind: 'notification',
            councilId: s.mine,
            actor: s.kim,
            values: mention(s.lee, s.otherRoom),
          }),
        ),
      ],
    ]
    for (const [name, attempt] of attempts) await assert.rejects(attempt, /학생회/, name)
    assert.deepEqual(await count(), before)
  } finally {
    await close()
  }
})

test('메시지의 방, 파일의 붙은 기록과 저장 위치, 알림의 받는 사람과 기록, 방의 종류는 바꾸지 않는다', async () => {
  const { db, pg, close } = await createTestDb()
  try {
    const s = await db.transaction(seed)
    const chat = await db.transaction(tx => makeChat(tx, s))
    const change = (kind: AnyRecordChange['kind'], id: string, changes: object) =>
      ({ kind, id, actor: s.kim, reason: null, changes }) as AnyRecordChange
    const attempts = [
      change('message', chat.message, { roomId: s.otherRoom }),
      change('file', chat.file, { attachedToId: chat.notification }),
      change('file', chat.file, { storageKey: 'chat/x' }),
      change('notification', chat.notification, { recipientId: s.kim }),
      change('notification', chat.notification, { recordId: chat.file }),
      change('chat_room', s.myRoom, { type: 'leadership' }),
      // DB 칸 이름으로 넘겨도 막는다.
      change('message', chat.message, { room_id: s.otherRoom }),
      change('file', chat.file, { storage_key: 'chat/x' }),
    ]
    for (const attempt of attempts)
      await assert.rejects(
        db.transaction(tx => updateRecords(tx, [attempt])),
        /주인 칸/,
        JSON.stringify(attempt.changes),
      )
    // 공지 표시처럼 바뀌는 칸은 새 판을 연다.
    await db.transaction(tx =>
      updateRecords(tx, [change('message', chat.message, { isNotice: true })]),
    )
    assert.equal((await versionsOf(pg, chat.message)).length, 2)
  } finally {
    await close()
  }
})
