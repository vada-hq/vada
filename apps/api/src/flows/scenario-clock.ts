import { sql } from 'drizzle-orm'
import type { Db } from '../db/types.js'
import { CLOCK_OFFSET_SETTING } from '../records/records.js'

// 시나리오 시계(기능 017). 앱 시계는 단계의 시나리오 시각이고, DB 기록 시각은 그 시각과의 간격을 연결 설정으로 더한다.
// 간격만 더하므로 DB 시계는 앞으로만 간다(판의 유효 기간이 겹치지 않는다). 시각을 뒤로 돌리는 일은 던진다.
// connection: 이 연결 전체에 건다(연결이 하나인 PGlite 전용. 연결 풀에서는 다른 연결에 걸릴 수 있다).
// transaction: 바깥 거래 안에서만 건다(거래가 끝나면 사라진다. 운영 DB에 쓰는 시연이 쓴다).
export type ClockScope = 'connection' | 'transaction'

export async function createScenarioClock(db: Db, start: Date, scope: ClockScope) {
  let current = start
  // 요청마다 다시 건다. 간격을 건 때부터 실제 시간이 흐른 만큼 DB 시계가 앞서가는 것을 요청 하나의 길이로 묶어, 앱 시계와 1초 안에서 맞춘다.
  const sync = async () => {
    const offsetMs = Math.round(current.getTime() - Date.now())
    await db.execute(
      sql`select set_config(${CLOCK_OFFSET_SETTING}, ${`${offsetMs} milliseconds`}, ${scope === 'transaction'})`,
    )
  }
  const travelTo = async (at: Date) => {
    if (!(at.getTime() >= current.getTime())) throw new Error('시나리오 시각을 뒤로 돌릴 수 없다')
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
