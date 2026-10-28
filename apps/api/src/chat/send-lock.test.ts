import assert from 'node:assert/strict'
import { test } from 'node:test'
import { inCouncilChange } from '../access/authorize.js'
import { createTestDb } from '../db/test-db.js'
import { createRecord } from '../records/records.js'
import { seedCouncil } from '../test-support/council.js'
import { syncRooms } from './rooms.js'
import { sendAs } from './send.js'

const now = new Date('2026-10-19T03:00:00Z')

// 업무를 잇는 보내기는 학생회 행 잠금 → 운영진 확인 → 업무 읽기 순서고, 잇지 않는 보내기는 잠그지 않는다.
// 잠금 삼항을 되돌리거나 라우트로 되돌려도 이 시험이 실패한다(라우트를 거치지 않고 서비스를 직접 부른다).
test('sendAs는 taskId가 있을 때만 학생회 행을 잠근 뒤에 운영진을 확인한다', async () => {
  const { pg, db: plain, close, drizzle: drizzleWith } = await createTestDb()
  try {
    const queries: string[] = []
    const db = drizzleWith({ logger: { logQuery: query => void queries.push(query) } })
    const council = await seedCouncil(db, pg)
    const memberId = council.people.president.memberId
    await inCouncilChange(
      plain,
      { userId: 's-president', councilId: council.councilId, action: 'member.manage', now },
      (tx, actor) => syncRooms(tx, actor),
    )
    const roomId = (
      await pg.query<{ id: string }>(
        `SELECT cr.id FROM chat_room cr JOIN record r ON r.id = cr.id
          WHERE r.council_id = $1 AND cr.type = 'all_members'`,
        [council.councilId],
      )
    ).rows[0]!.id
    const taskId = await db.transaction(tx =>
      createRecord(tx, {
        kind: 'task',
        councilId: council.councilId,
        actor: memberId,
        values: { title: '업무', assigneeId: memberId },
      }),
    )
    const request = {
      userId: 's-president',
      councilId: council.councilId,
      action: 'council.view' as const,
      now,
    }
    const input = { roomId, body: '공지', mentions: [], photos: [] }
    const lockOf = () =>
      queries.findIndex(
        query => query.includes('from "council"') && query.endsWith(' for no key update'),
      )

    queries.length = 0
    await db.transaction(tx => sendAs(tx, request, { ...input, taskId }))
    const lock = lockOf()
    assert.ok(lock >= 0, '학생회 행 잠금이 없다')
    const login = queries.findIndex(query => query.includes('"member_login"'))
    assert.ok(login > lock, '운영진 확인이 잠금보다 앞선다')
    const read = queries.findIndex(query => query.includes('from "task"'))
    assert.ok(read > login, '업무 읽기가 운영진 확인보다 앞선다')

    queries.length = 0
    await db.transaction(tx => sendAs(tx, request, input))
    assert.equal(lockOf(), -1, '업무를 잇지 않는 보내기가 학생회 행을 잠근다')
  } finally {
    await close()
  }
})
