import { and, eq, isNull, lt } from 'drizzle-orm'
import { koreanDateOf, type ClosingFeePending, type ClosingPendingEvent } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { deposit, event, record, registration, registrationForm } from '../db/schema.js'
import { countAll, sumOf } from '../db/sums.js'
import type { Db } from '../db/types.js'
import { completedEventIdsAmong } from '../events/completion.js'
import { koreanDayRange, type ClosingPeriod } from './period.js'

type Reader = Pick<Db, 'select'>

// 입금 확인일(한국)이 끝일 이하인 취소하지 않은 입금을 행사마다 묶는다. 환불은 입금에서 뺀다(참가비 수입과 같다).
async function depositsByEvent(db: Reader, actor: Actor, period: ClosingPeriod) {
  const { until } = koreanDayRange(period.startsOn, period.endsOn)
  return db
    .select({
      id: event.id,
      name: event.name,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      count: countAll,
      received: sumOf(deposit.amount),
      refunded: sumOf(deposit.refundAmount),
    })
    .from(deposit)
    .innerJoin(registration, eq(registration.id, deposit.registrationId))
    .innerJoin(registrationForm, eq(registrationForm.id, registration.formId))
    .innerJoin(event, eq(event.id, registrationForm.eventId))
    .innerJoin(record, eq(record.id, deposit.id))
    .where(
      and(
        eq(record.councilId, actor.councilId),
        isNull(deposit.cancelledAt),
        lt(deposit.confirmedAt, until),
      ),
    )
    .groupBy(event.id, event.name, event.startsAt, event.endsAt)
}

// 완료하지 않은 행사의 입금(DEC-68). 행사 끝 날짜(끝 시각이 없으면 시작 시각, 한국)가 끝일 이하이거나 날짜 미정이면
// 번 참가비가 아직 수입에 없어 공개를 막고, 뒤 기간이면 선수금이라 막지 않고 정보로만 둔다.
export async function feePendingOf(
  db: Reader,
  actor: Actor,
  period: ClosingPeriod,
): Promise<ClosingFeePending> {
  const rows = await depositsByEvent(db, actor, period)
  const completed = await completedEventIdsAmong(
    db,
    rows.map(row => row.id),
  )
  const blocking: ClosingPendingEvent[] = []
  const next = { eventCount: 0, depositCount: 0, amount: 0 }
  for (const row of rows.filter(row => !completed.has(row.id))) {
    const ended = row.endsAt ?? row.startsAt
    const amount = row.received - row.refunded
    if (!ended || koreanDateOf(ended) <= period.endsOn) {
      blocking.push({ event: { id: row.id, name: row.name }, depositCount: row.count, amount })
    } else {
      next.eventCount += 1
      next.depositCount += row.count
      next.amount += amount
    }
  }
  blocking.sort(
    (a, b) => a.event.name.localeCompare(b.event.name) || a.event.id.localeCompare(b.event.id),
  )
  return { blocking, nextPeriod: next }
}
