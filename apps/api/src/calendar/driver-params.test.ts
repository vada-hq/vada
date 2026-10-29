import assert from 'node:assert/strict'
import { test } from 'node:test'
import { drizzle } from 'drizzle-orm/postgres-js'
import type postgres from 'postgres'
import type { Actor } from '../access/actor.js'
import type { Db } from '../db/types.js'
import { upcomingOf } from '../home/upcoming.js'
import { calendarOf } from './aggregate.js'
import { calendarRangeOf } from './range.js'

// 운영 드라이버(postgres.js)에 drizzle은 시각 직렬화를 꺼 두어(transparentParser), 칸 인코더를 거치지 않은 Date는
// 그대로 소켓 쓰기까지 가서 던진다. PGlite는 Date를 받아 주므로 다른 시험으로는 잡히지 않는다.
// 실제 Postgres 없이 drizzle의 postgres-js 경로가 드라이버에 넘기는 매개변수만 붙잡아 Date가 없는지 본다.
function capturingDb() {
  const params: unknown[] = []
  const queries: string[] = []
  const result = Object.assign(Promise.resolve([]), { values: () => Promise.resolve([]) })
  const client = {
    options: { parsers: {}, serializers: {} },
    unsafe: (query: string, values: unknown[] = []) => {
      queries.push(query)
      params.push(...values)
      return result
    },
  } as unknown as postgres.Sql
  return { db: drizzle(client) as unknown as Db, params, queries }
}

const actor: Actor = {
  memberId: '00000000-0000-7000-8000-000000000001',
  councilId: '00000000-0000-7000-8000-000000000002',
  cohortId: '00000000-0000-7000-8000-000000000003',
  membershipId: '00000000-0000-7000-8000-000000000004',
  councilRank: null,
  departments: [],
}

const now = new Date('2026-10-28T13:00:00Z')

test('캘린더 집계와 홈 가까운 일정은 운영 드라이버에 Date를 그대로 넘기지 않는다', async () => {
  const { db, params, queries } = capturingDb()
  const range = calendarRangeOf({ from: '2026-09-27', to: '2026-11-08' })
  for (const feed of [false, true]) await calendarOf(db, actor, range, { now, feed })
  await upcomingOf(db, actor, now, {
    kind: 'council',
    open: [],
    mine: [],
    staffed: [],
    participating: { events: [], total: 0 },
  })
  assert.ok(params.length > 0)
  // 원본마다 범위 조건이 있다. 회의 원본이 빠지면 그 조건이 검사되지 않는다.
  assert.ok(queries.some(query => query.includes('from "meeting"')))
  const unsafe = params.filter(value => value !== null && typeof value === 'object')
  assert.deepEqual(unsafe, [])
})
