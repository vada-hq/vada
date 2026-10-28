import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { createRecord } from '../records/records.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { NOON } from '../test-support/events.js'
import { createEventRoutes } from './routes.js'

// 쓰기 거래는 학생회 행 잠금 → 운영진 확인 → 행사 행 읽기 순서다. 잠금을 빼면 이 시험이 실패한다.
test('행사 쓰기 두 길은 학생회 행을 FOR NO KEY UPDATE로 잠근 뒤에 운영진을 확인하고 행사를 읽는다', async () => {
  const { pg, close, drizzle: drizzleWith } = await createTestDb()
  try {
    const queries: string[] = []
    const db = drizzleWith({ logger: { logQuery: query => void queries.push(query) } })
    const council = await seedCouncil(db, pg)
    const eventId = await db.transaction(tx =>
      createRecord(tx, {
        kind: 'event',
        councilId: council.councilId,
        actor: council.people.president.memberId,
        values: { name: '축제', ownerId: council.people.president.memberId },
      }),
    )
    const api = caller(
      createApp({
        auth: { handler: async () => new Response() },
        trustedOrigin: ORIGIN,
        events: createEventRoutes(db, testSession, { clock: () => NOON }),
      }),
    )
    const base = `/api/organizations/${council.councilId}/events`
    const calls: [string, unknown, number][] = [
      [base, { name: '새 행사' }, 201],
      [`${base}/${eventId}`, { name: '고침', startsAt: null, endsAt: null, place: null }, 200],
    ]
    for (const [path, body, status] of calls) {
      queries.length = 0
      assert.equal((await api.post(path, body, 's-president')).status, status, path)
      const lock = queries.findIndex(
        query => query.includes('from "council"') && query.endsWith(' for no key update'),
      )
      assert.ok(lock >= 0, `${path}: 학생회 행 잠금이 없다`)
      const member = queries.findIndex(query => query.includes('"member_login"'))
      assert.ok(member > lock, `${path}: 운영진 확인이 잠금보다 앞선다`)
      const writes = queries.findIndex(
        query => query.includes('from "event"') || query.includes('insert into "record"'),
      )
      assert.ok(writes > member, `${path}: 행사를 읽거나 쓰는 문장이 운영진 확인보다 앞선다`)
    }
  } finally {
    await close()
  }
})
