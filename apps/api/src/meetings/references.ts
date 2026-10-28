import { MEETING_ATTENDEE_LIMIT } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { lockCurrentMembers } from '../chat/current-members.js'
import type { Tx } from '../db/types.js'
import { assertEventOpen } from '../events/completion.js'
import { ApiError } from '../http/errors.js'
import { assertScheduleReferences } from '../records/same-council.js'

// 같은 참조 모양인 기존 도우미로 종류와 학생회를 확인한다.
export const assertReferences = (
  tx: Tx,
  actor: Actor,
  values: { eventId: string | null; hostDepartmentId: string | null },
) =>
  assertScheduleReferences(tx, actor.councilId, {
    eventId: values.eventId,
    departmentId: values.hostDepartmentId,
  })

// 지금 운영진인지는 새로 더하는 사람만 본다(RULE-50). 이미 참가자인 사람은 그 뒤 떠났어도 명단에 남는다.
export async function attendeeIdsOf(
  tx: Tx,
  actor: Actor,
  ids: string[],
  { now, kept = [] }: { now: Date; kept?: readonly string[] },
) {
  const wanted = [...new Set(ids)]
  if (wanted.length > MEETING_ATTENDEE_LIMIT) throw new ApiError('INVALID_INPUT')
  const added = wanted.filter(id => !kept.includes(id))
  if (!added.length) return wanted
  const current = await lockCurrentMembers(tx, actor.councilId, added, now)
  if (added.some(id => !current.has(id))) throw new ApiError('NOT_FOUND')
  return wanted
}

// 완료 행사의 업무처럼 이미 이어진 회의는 고친다. 새로 잇는 경우에만 완료 여부를 본다.
export async function assertNewEventOpen(tx: Tx, eventId: string | null, before: string | null) {
  if (eventId !== before) await assertEventOpen(tx, eventId)
}
