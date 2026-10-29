import { and, count, eq, inArray, isNull } from 'drizzle-orm'
import { record, registration, registrationForm } from '../db/schema.js'
import type { Actor } from '../access/actor.js'
import type { Db } from '../db/types.js'

type Reader = Pick<Db, 'select'>

export type LaneForm = {
  id: string
  eventId: string
  opensAt: Date | null
  closesAt: Date
  capacity: number | null
  paused: boolean
  // 취소하지 않은 신청 수(공개 양식의 applicantCountOf와 같은 셈)
  count: number
}

// 행사 몇 개의 신청 양식과 양식별 신청 수. 양식마다 따로 세지 않고 한 번에 센다. 학생회로 거른다.
export async function laneFormsOf(
  db: Reader,
  actor: Actor,
  eventIds: string[],
): Promise<LaneForm[]> {
  if (!eventIds.length) return []
  const forms = await db
    .select({
      id: registrationForm.id,
      eventId: registrationForm.eventId,
      opensAt: registrationForm.opensAt,
      closesAt: registrationForm.closesAt,
      capacity: registrationForm.capacity,
      pausedAt: registrationForm.pausedAt,
    })
    .from(registrationForm)
    .innerJoin(record, eq(record.id, registrationForm.id))
    .where(and(eq(record.councilId, actor.councilId), inArray(registrationForm.eventId, eventIds)))
  if (!forms.length) return []
  const counts = await db
    .select({ formId: registration.formId, n: count() })
    .from(registration)
    .where(
      and(
        inArray(
          registration.formId,
          forms.map(form => form.id),
        ),
        isNull(registration.cancelledAt),
      ),
    )
    .groupBy(registration.formId)
  const countOf = new Map(counts.map(row => [row.formId, row.n]))
  return forms.map(({ pausedAt, ...form }) => ({
    ...form,
    paused: pausedAt !== null,
    count: countOf.get(form.id) ?? 0,
  }))
}
