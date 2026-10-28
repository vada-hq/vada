import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp } from '../app.js'
import { createTestDb } from '../db/test-db.js'
import { createRecord } from '../records/records.js'
import { seedCouncil } from '../test-support/council.js'
import { caller, ORIGIN, testSession } from '../test-support/http.js'
import { createTaskRoutes } from './routes.js'

const noon = new Date('2026-10-25T03:00:00Z')

// 쓰기 거래는 학생회 행 잠금 → 운영진 확인 → 업무 행 읽기 순서다(명세 '(바꿈) 권한 묻기').
// 잠금을 빼거나 잠그지 않는 거래로 바꾸면 이 시험이 실패한다.
test('업무 쓰기 네 길은 학생회 행을 FOR NO KEY UPDATE로 잠근 뒤에 운영진을 확인하고 업무를 읽는다', async () => {
  const { pg, db: plain, close, drizzle: drizzleWith } = await createTestDb()
  try {
    const queries: string[] = []
    const db = drizzleWith({ logger: { logQuery: query => void queries.push(query) } })
    const council = await seedCouncil(db, pg)
    const taskId = await db.transaction(tx =>
      createRecord(tx, {
        kind: 'task',
        councilId: council.councilId,
        actor: council.people.president.memberId,
        values: { title: '업무' },
      }),
    )
    void plain
    const api = caller(
      createApp({
        auth: { handler: async () => new Response() },
        trustedOrigin: ORIGIN,
        tasks: createTaskRoutes(db, testSession, { clock: () => noon }),
      }),
    )
    const base = `/api/organizations/${council.councilId}/tasks`
    const calls: [string, unknown, number][] = [
      [base, { title: '새 업무' }, 201],
      [`${base}/${taskId}`, { title: '고침', body: null, dueDate: null }, 200],
      [`${base}/${taskId}/status`, { status: 'done' }, 200],
      [`${base}/${taskId}/delete`, {}, 204],
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
        query => query.includes('from "task"') || query.includes('insert into "record"'),
      )
      assert.ok(writes > member, `${path}: 업무를 읽거나 쓰는 문장이 운영진 확인보다 앞선다`)
    }
  } finally {
    await close()
  }
})
