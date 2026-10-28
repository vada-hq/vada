import assert from 'node:assert/strict'
import { test } from 'node:test'
import { actorOf } from '../access/actor.js'
import { taskResult } from '../db/schema.js'
import { createTestDb } from '../db/test-db.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { seedCouncil } from '../test-support/council.js'
import { taskDetailOf, taskListOf } from './queries.js'

const now = new Date('2026-10-25T03:00:00Z')

async function start() {
  const t = await createTestDb()
  const council = await seedCouncil(t.db, t.pg)
  const other = await seedCouncil(t.db, t.pg, 'o')
  const make = (
    kind: 'task' | 'request' | 'event',
    values: Record<string, unknown>,
    foreign = false,
  ) =>
    t.db.transaction(tx =>
      createRecord(tx, {
        kind,
        councilId: foreign ? other.councilId : council.councilId,
        actor: null,
        values,
      }),
    )
  const link = (taskId: string, resultId: string, resultKind: 'request' | 'event') =>
    t.db.insert(taskResult).values({ taskId, resultId, resultKind })
  const actor = (user = 's-president') => actorOf(t.db, user, council.councilId, now)
  return { ...t, council, other, make, link, actor }
}

test('목록·상세는 최근 결과물의 종류·단계·바뀐 시각과 개수를 주고 취소와 다른 학생회 결과물은 뺀다', async () => {
  const t = await start()
  try {
    const id = await t.make('task', { title: '준비' })
    const empty = await t.make('task', { title: '빈 업무' })
    const event = await t.make('event', { name: '행사' })
    const request = await t.make('request', {
      type: 'purchase',
      title: '구매',
      requestedBy: t.council.people.president.memberId,
    })
    const cancelled = await t.make('request', {
      type: 'purchase',
      title: '취소',
      requestedBy: t.council.people.president.memberId,
      cancelledAt: clockNow,
    })
    const foreign = await t.make('event', { name: '다른 학생회' }, true)
    await t.link(id, event, 'event')
    await t.link(id, request, 'request')
    await t.link(id, cancelled, 'request')
    // 저장된 연결 자체가 잘못됐어도 결과물 기록의 학생회 경계를 지킨다.
    await t.link(id, foreign, 'event')
    const actor = (await t.actor())!
    const list = await taskListOf(t.db, actor, { view: 'all', status: 'open' }, now)
    const row = list.tasks.find(task => task.id === id)!
    assert.equal(row.resultCount, 2)
    const latest = row.latestResult
    assert.ok(latest)
    assert.equal(latest.kind, 'request')
    assert.equal(latest.stage, 'in_progress')
    assert.ok(Number.isFinite(Date.parse(latest.changedAt)))
    assert.equal(list.tasks.find(task => task.id === empty)!.latestResult, null)
    assert.equal(list.tasks.find(task => task.id === empty)!.resultCount, 0)
    assert.deepEqual((await taskDetailOf(t.db, actor, id, now)).latestResult, row.latestResult)
    // 만든 차례가 아니라 마지막으로 바뀐 결과물이 맨 앞이다.
    await t.db.transaction(tx =>
      updateRecord(tx, {
        kind: 'event',
        id: event,
        actor: null,
        reason: null,
        changes: { name: '고친 행사' },
      }),
    )
    const changed = await taskListOf(t.db, actor, { view: 'all', status: 'open' }, now)
    assert.equal(changed.tasks.find(task => task.id === id)!.latestResult?.kind, 'event')
    assert.equal(changed.tasks.find(task => task.id === id)!.latestResult?.stage, 'none')
  } finally {
    await t.close()
  }
})

test('부원·부서장·회장단의 내 업무 읽기는 미완료와 완료 모두 결과물 요약을 준다', async () => {
  const t = await start()
  try {
    for (const name of ['planningMember', 'planningHead', 'president'] as const) {
      for (const status of ['todo', 'done'] as const) {
        const id = await t.make('task', {
          title: name,
          status,
          assigneeId: t.council.people[name].memberId,
        })
        const result = await t.make('event', { name: `${name} 행사` })
        await t.link(id, result, 'event')
      }
      const actor = (await t.actor(`s-${name}`))!
      for (const status of ['open', 'done'] as const) {
        const list = await taskListOf(t.db, actor, { view: 'mine', status }, now)
        assert.equal(list.tasks.length, 1)
        assert.equal(list.tasks[0]!.title, name)
        assert.equal(list.tasks[0]!.resultCount, 1)
      }
    }
  } finally {
    await t.close()
  }
})

test('결과물이 있는 업무 300개도 목록과 요약 쿼리는 업무 수와 무관하게 일정하다', async () => {
  const t = await start()
  try {
    await t.pg.query(
      `INSERT INTO record (id, kind, council_id)
      SELECT uuidv7(), 'task', $1 FROM generate_series(1, 300)`,
      [t.council.councilId],
    )
    await t.pg.exec(
      `INSERT INTO task (id, title) SELECT id, '준비' FROM record WHERE kind = 'task'`,
    )
    await t.pg.query(
      `INSERT INTO record (id, kind, council_id)
      SELECT uuidv7(), 'request', $1 FROM generate_series(1, 300)`,
      [t.council.councilId],
    )
    await t.pg.query(
      `INSERT INTO request (id, type, title, requested_by)
      SELECT id, 'purchase', '구매', $1 FROM record WHERE kind = 'request'`,
      [t.council.people.president.memberId],
    )
    await t.pg.exec(`INSERT INTO task_result (task_id, result_id, result_kind)
      SELECT t.id, r.id, 'request'
      FROM (SELECT id, row_number() OVER (ORDER BY id) n FROM task) t
      JOIN (SELECT id, row_number() OVER (ORDER BY id) n FROM request) r USING (n)`)
    const actor = (await t.actor())!
    const queries: string[] = []
    const db = t.drizzle({
      logger: {
        logQuery: query => {
          queries.push(query)
        },
      },
    })
    const list = await taskListOf(db, actor, { view: 'all', status: 'open' }, now)
    assert.equal(list.tasks.length, 300)
    assert.ok(list.tasks.every(task => task.resultCount === 1))
    const many = queries.length
    assert.ok(many <= 6, `${many} queries`)
    await t.pg.exec(`DELETE FROM task_result WHERE task_id <> (SELECT id FROM task LIMIT 1)`)
    await t.pg.exec(
      `UPDATE task SET cancelled_at = now() WHERE id NOT IN (SELECT task_id FROM task_result)`,
    )
    queries.length = 0
    assert.equal(
      (await taskListOf(db, actor, { view: 'all', status: 'open' }, now)).tasks.length,
      1,
    )
    assert.equal(queries.length, many)
  } finally {
    await t.close()
  }
})
