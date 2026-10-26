import type { EventSettlementRow, EventStatus, EventSummary, HomeSettling } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import type { Db } from '../db/types.js'
import { endedOpenEventsOf } from '../events/queries.js'
import { isSettled, remainingOf } from './remaining.js'

type Reader = Pick<Db, 'select'>

// 정산에 남은 것 수는 행사 '돈' 탭의 항목 수 합이다(같은 remainingOf).
// 홈 '후속 정리 중인 행사'·'정산할 행사'와 재정 '행사 정산' 탭이 이것 하나로 세어 같은 행사에 같은 수가 나온다.
async function settlementSummaryOf(
  db: Reader,
  actor: Actor,
  event: { id: string; status: EventStatus },
) {
  const remaining = await remainingOf(db, { councilId: actor.councilId, eventId: event.id })
  return {
    remaining: remaining.reduce((sum, item) => sum + item.count, 0),
    settled: isSettled(event.status, remaining),
  }
}

export async function withSettlements(
  db: Reader,
  actor: Actor,
  events: EventSummary[],
): Promise<EventSettlementRow[]> {
  const rows: EventSettlementRow[] = []
  for (const event of events)
    rows.push({ event, settlement: await settlementSummaryOf(db, actor, event) })
  return rows
}

// 정산할 행사: 끝났고 완료하지 않은 행사(행사 카드의 끝난 행사와 같은 조건과 차례), limit개까지와 전체 수.
// 홈(재정부)과 재정 '행사 정산' 탭이 이것으로 읽는다.
export async function settlingOf(
  db: Reader,
  actor: Actor,
  now: Date,
  limit: number,
): Promise<HomeSettling> {
  const { events, total } = await endedOpenEventsOf(db, actor, now, limit)
  return { events: await withSettlements(db, actor, events), total }
}
