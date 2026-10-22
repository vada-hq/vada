import type { CancelCompletionRequest, CompleteEventRequest, EventDetail } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import type { Tx } from '../db/types.js'
import { completedEventIdsAmong, lockEventForCompletion } from '../events/completion.js'
import { eventDetailOf, eventRowOf } from '../events/queries.js'
import { eventStatusOf } from '../events/status.js'
import { ApiError } from '../http/errors.js'
import { clockNow, createRecord } from '../records/records.js'
import { cancelFeeIncomes, createFeeIncomes } from './fee-income.js'
import { remainingOf } from './remaining.js'

// 완료와 완료 취소 거래. 학생회 행 잠금과 운영진 확인(inCouncilChange) 뒤에 부르고, 권한 → 행사 읽기 → 행사 행 잠금 → 다시 읽기 순서다(403이 409보다 먼저).
// 행사 행 잠금은 학생회 행을 잠그지 않는 공개 신청·스스로 취소와 만나는 곳이다. 이 잠금을 잡은 채 상태를 읽어야 그 둘이 끝나거나 완료 뒤를 본다(DEC-68).

async function lockedEvent(tx: Tx, actor: Actor, eventId: string) {
  const row = await eventRowOf(tx, actor, eventId)
  await lockEventForCompletion(tx, row.id)
  return { row, completed: (await completedEventIdsAmong(tx, [row.id])).has(row.id) }
}

function recordApproval(
  tx: Tx,
  actor: Actor,
  target: { eventId: string; outcome: 'completed' | 'completion_cancelled'; reason: string | null },
) {
  return createRecord(tx, {
    kind: 'approval',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: {
      targetId: target.eventId,
      targetKind: 'event',
      outcome: target.outcome,
      actorId: actor.memberId,
      actorKind: 'member',
      actedAt: clockNow,
      reason: target.reason,
    },
  })
}

// 완료. 시작한 행사이고 정산이 남지 않았을 때만 되고, 같은 거래에서 참가비 수입이 생긴다. 하나라도 안 되면 던져서 아무것도 남지 않는다.
export async function completeEvent(
  tx: Tx,
  actor: Actor,
  target: { eventId: string; now: Date },
  input: CompleteEventRequest,
): Promise<EventDetail> {
  if (!can(actor, 'event.complete')) throw new ApiError('FORBIDDEN')
  const { row, completed } = await lockedEvent(tx, actor, target.eventId)
  if (completed) throw new ApiError('EVENT_COMPLETED')
  const status = eventStatusOf(row.startsAt, row.endsAt, target.now)
  if (status === 'tbd' || status === 'upcoming') throw new ApiError('EVENT_NOT_STARTED')
  const remaining = await remainingOf(tx, { councilId: actor.councilId, eventId: row.id })
  if (remaining.some(item => item.count > 0)) throw new ApiError('SETTLEMENT_PENDING')
  await createFeeIncomes(tx, actor, { ...row, now: target.now })
  await recordApproval(tx, actor, {
    eventId: row.id,
    outcome: 'completed',
    reason: input.reason,
  })
  return eventDetailOf(tx, actor, row.id, target.now)
}

// 완료 취소. 참가비 수입은 같은 사유로 취소하고(남는다), 다시 완료하면 새 수입이 생긴다.
export async function cancelCompletion(
  tx: Tx,
  actor: Actor,
  target: { eventId: string; now: Date },
  input: CancelCompletionRequest,
): Promise<EventDetail> {
  if (!can(actor, 'event.complete')) throw new ApiError('FORBIDDEN')
  const { row, completed } = await lockedEvent(tx, actor, target.eventId)
  if (!completed) throw new ApiError('EVENT_NOT_COMPLETED')
  await cancelFeeIncomes(tx, actor, row.id, input.reason)
  await recordApproval(tx, actor, {
    eventId: row.id,
    outcome: 'completion_cancelled',
    reason: input.reason,
  })
  return eventDetailOf(tx, actor, row.id, target.now)
}
