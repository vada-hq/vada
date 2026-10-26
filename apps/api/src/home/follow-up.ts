import { dateFromKorean, type EventSettlementRow, type HomeFollowUp } from '@vada/contracts'
import type { Db } from '../db/types.js'
import { endedDaysOf } from '../events/header.js'
import { taskCountsByEvent } from '../events/queries.js'

// 회장단 후속 정리와 재정부장 책임 행사 줄은 행사 머리·정산 탭과 같은 셈이다(DEC-93·95).
export async function followUpRowsOf(
  db: Pick<Db, 'select'>,
  events: EventSettlementRow[],
  now: Date,
): Promise<HomeFollowUp[]> {
  const counts = await taskCountsByEvent(
    db,
    events.map(row => row.event.id),
  )
  return events.map(({ event, settlement }) => ({
    event: {
      id: event.id,
      name: event.name,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      status: event.status,
    },
    endedDays: endedDaysOf(
      {
        startsAt: event.startsAt ? dateFromKorean(event.startsAt) : null,
        endsAt: event.endsAt ? dateFromKorean(event.endsAt) : null,
      },
      now,
    ),
    remaining: { tasks: counts.get(event.id)?.open ?? 0, settlement: settlement.remaining },
  }))
}
