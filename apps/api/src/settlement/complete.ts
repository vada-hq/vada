import type {
  CancelCompletionRequest,
  CompleteEventRequest,
  EventAction,
  EventDetail,
} from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { syncEventRooms } from '../chat/rooms.js'
import type { Tx } from '../db/types.js'
import { decide, factsOf, roleAllows } from '../events/policy.js'
import { eventDetailOf } from '../events/detail.js'
import { eventRowOf } from '../events/queries.js'
import { lockEventForCompletion } from '../policy/locks.js'
import { ApiError } from '../http/errors.js'
import { clockNow, createRecord } from '../records/records.js'
import { cancelFeeIncomes, createFeeIncomes } from './fee-income.js'

// 완료와 완료 취소 거래. 학생회 행 잠금과 운영진 확인(inCouncilChange) 뒤에 부르고, 권한 → 행사 읽기 → 행사 행 잠금 → 다시 읽기 순서다(403이 409보다 먼저).
// 행사 행 잠금은 학생회 행을 잠그지 않는 공개 신청·스스로 취소와 만나는 곳이다. 이 잠금을 잡은 채 상태를 읽어야 그 둘이 끝나거나 완료 뒤를 본다(DEC-68).

// 권한(403) → 행사 읽기(404) → 행사 행 잠금 → 잠근 채 사실을 읽어 decide(409). 정책은 events/policy.ts다.
async function decided(
  tx: Tx,
  actor: Actor,
  target: { eventId: string; now: Date },
  action: EventAction,
) {
  if (!roleAllows(actor, action)) throw new ApiError('FORBIDDEN')
  const row = await eventRowOf(tx, actor, target.eventId)
  await lockEventForCompletion(tx, row.id)
  const refused = decide(
    actor,
    await factsOf(tx, actor, row, { now: target.now, actions: [action] }),
    action,
  )
  if (refused) throw new ApiError(refused)
  return row
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

// 완료. 끝난 행사이고 정산이 남지 않았을 때만 되고(RULE-42), 같은 거래에서 참가비 수입이 생긴다. 하나라도 안 되면 던져서 아무것도 남지 않는다.
export async function completeEvent(
  tx: Tx,
  actor: Actor,
  target: { eventId: string; now: Date },
  input: CompleteEventRequest,
): Promise<EventDetail> {
  const row = await decided(tx, actor, target, 'event.complete')
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
  const row = await decided(tx, actor, target, 'event.cancel_completion')
  await cancelFeeIncomes(tx, actor, row.id, input.reason)
  await recordApproval(tx, actor, {
    eventId: row.id,
    outcome: 'completion_cancelled',
    reason: input.reason,
  })
  // 보관이 풀린 행사 방의 참여를 지금 편성으로 맞춘다(보관 동안에는 맞추지 않았다, DEC-90).
  await syncEventRooms(tx, actor, row.id)
  return eventDetailOf(tx, actor, row.id, target.now)
}
