import { HOME_ENDED_LIMIT, type HomeSettling } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import type { Db } from '../db/types.js'
import { endedOpenEventsOf } from '../events/queries.js'
import { remainingOf } from '../settlement/remaining.js'

type Reader = Pick<Db, 'select'>

// 정산에 남은 것 수는 행사 '돈' 탭의 항목 수 합이다(같은 remainingOf). 끝났고 완료하지 않은 행사에만 센다.
export async function settlementOf(db: Reader, actor: Actor, eventId: string) {
  const remaining = await remainingOf(db, { councilId: actor.councilId, eventId })
  return {
    remaining: remaining.reduce((sum, item) => sum + item.count, 0),
    settled: remaining.every(item => item.count === 0),
  }
}

// 재정부의 정산할 행사: 끝났고 완료하지 않은 행사(행사 카드의 끝난 행사와 같은 조건과 차례).
export async function settlingOf(db: Reader, actor: Actor, now: Date): Promise<HomeSettling> {
  const { events, total } = await endedOpenEventsOf(db, actor, now, HOME_ENDED_LIMIT)
  const rows: HomeSettling['events'] = []
  for (const event of events)
    rows.push({ event, settlement: await settlementOf(db, actor, event.id) })
  return { events: rows, total }
}
