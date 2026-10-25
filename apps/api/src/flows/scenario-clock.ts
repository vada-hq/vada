import { PGlite } from '@electric-sql/pglite'
import { sql } from 'drizzle-orm'
import { PgTransaction } from 'drizzle-orm/pg-core'
import type { Db } from '../db/types.js'
import { CLOCK_OFFSET_SETTING } from '../records/records.js'

// 시나리오 시계(기능 017). 앱 시계는 단계의 시나리오 시각이고, DB 기록 시각은 그 시각과의 간격을 연결 설정으로 더한다.
// 간격은 줄지 않는다(max). 그래서 DB 시계는 앞으로만 가고, 같은 시나리오 시각의 요청이 여럿이어도 기록 시각이 뒤로 가지 않는다(판·소속 기간 CHECK).
// 시각을 뒤로 돌리는 일은 던진다.
// connection: 이 연결 전체에 건다. 연결이 하나인 PGlite만 받는다(풀에서는 다른 연결에 걸리거나 풀러를 거쳐 다른 클라이언트에 샌다).
// transaction: 바깥 거래 안에서만 건다(거래가 끝나면 사라진다. 운영 DB에 쓰는 시연이 쓴다). 거래 핸들만 받고,
// 시나리오 시각은 실제 시각을 넘지 못한다(미래로 커밋된 시연이 실제 운영진의 뒤 쓰기를 CHECK로 막지 않게).
export type ClockScope = 'connection' | 'transaction'

function assertScopeFits(db: Db, scope: ClockScope) {
  const isPglite = (db as { $client?: unknown }).$client instanceof PGlite
  if (scope === 'connection' && !isPglite) throw new Error('connection 범위는 PGlite에만 건다')
  if (scope === 'transaction' && !(db instanceof PgTransaction))
    throw new Error('transaction 범위는 거래 핸들에만 건다')
}

// base는 DB 시계가 따라가는 실제 시각이다. 직접 읽지 않고 받아서, 시각 읽기가 한 곳(흐름 서버)에만 있게 한다.
export async function createScenarioClock(
  db: Db,
  start: Date,
  scope: ClockScope,
  base: () => Date,
) {
  assertScopeFits(db, scope)
  const assertNotFuture = (at: Date) => {
    if (scope === 'transaction' && at.getTime() > base().getTime())
      throw new Error('거래 범위의 시나리오 시각은 실제 시각을 넘을 수 없다')
  }
  assertNotFuture(start)
  let current = start
  let offsetMs = Number.NEGATIVE_INFINITY
  // 요청마다 다시 건다. 실제 시간이 흐른 만큼 DB 시계가 앞서가는 것을 요청 하나의 길이로 묶어, 앱 시계와 1초 안에서 맞춘다.
  const sync = async () => {
    offsetMs = Math.max(offsetMs, Math.round(current.getTime() - base().getTime()))
    await db.execute(
      sql`select set_config(${CLOCK_OFFSET_SETTING}, ${`${offsetMs} milliseconds`}, ${scope === 'transaction'})`,
    )
  }
  const travelTo = async (at: Date) => {
    if (!(at.getTime() >= current.getTime())) throw new Error('시나리오 시각을 뒤로 돌릴 수 없다')
    assertNotFuture(at)
    current = at
    await sync()
  }
  await sync()
  return {
    now: () => current,
    sync,
    travelTo,
    advanceBy: (ms: number) => travelTo(new Date(current.getTime() + ms)),
  }
}
export type ScenarioClock = Awaited<ReturnType<typeof createScenarioClock>>
