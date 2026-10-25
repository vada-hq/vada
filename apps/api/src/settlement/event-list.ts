import { EVENT_SETTLEMENTS_LIMIT, type EventSettlementsResponse } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { currentPeriodOf } from '../budget/queries.js'
import { koreanDayRange } from '../closing/period.js'
import type { Db } from '../db/types.js'
import { periodEventsOf } from '../events/queries.js'
import { settlingOf, withSettlements } from './settling.js'

type Reader = Pick<Db, 'select'>

// 재정 '행사 정산' 탭(DEC-38, DEC-92). 끝났고 완료하지 않은 행사가 먼저 자리를 잡고(홈 '정산할 행사'와 같은 읽기),
// 남은 자리에 지금 회계 기간의 끝나지 않은 행사와 완료한 행사가 온다. 끝났고 완료하지 않은 행사는 지난 기간 것이어도
// 정산이 남은 일이라 거르지 않는다(결산 점검도 끝일 이하의 완료하지 않은 행사를 그 기간의 것으로 본다).
export async function eventSettlementsOf(
  db: Reader,
  actor: Actor,
  now: Date,
): Promise<EventSettlementsResponse> {
  const period = await currentPeriodOf(db, actor, now)
  const ended = await settlingOf(db, actor, now, EVENT_SETTLEMENTS_LIMIT)
  const others = await periodEventsOf(db, actor, now, {
    range: period ? koreanDayRange(period.startsOn, period.endsOn) : null,
    limit: EVENT_SETTLEMENTS_LIMIT - ended.events.length,
  })
  return {
    period: period ? { id: period.id, name: period.name } : null,
    events: [...ended.events, ...(await withSettlements(db, actor, others.events))],
    truncated: ended.total > ended.events.length || others.truncated,
  }
}
