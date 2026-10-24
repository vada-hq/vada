import { and, eq } from 'drizzle-orm'
import type { CancelLineItem, PurchaseRequestDetail } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { currentMembersAmong } from '../chat/current-members.js'
import { budgetItem, lineItem } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { lockedCompleted } from '../events/completion.js'
import { ApiError } from '../http/errors.js'
import { clockNow, createRecord } from '../records/records.js'
import { lastOutcomeOf } from './last-outcome.js'
import { lockedRequestRow } from './lock.js'
import { decideLineItem, lineItemStatusOf } from './policy.js'
import { isPaid, requestDetailOf } from './queries.js'
import type { PurchaseNotice } from './service.js'

// 이 요청의 품목 하나를 잠그고 판정에 드는 값을 읽는다. 없는 품목과 다른 요청의 품목은 404다.
async function lockedItemFacts(tx: Tx, requestId: string, lineItemId: string) {
  await tx
    .select({ id: lineItem.id })
    .from(lineItem)
    .where(and(eq(lineItem.id, lineItemId), eq(lineItem.requestId, requestId)))
    .for('no key update')
  const [found] = await tx
    .select({
      outcome: lastOutcomeOf(lineItem.id),
      paid: isPaid.mapWith(Boolean),
      budgetEventId: budgetItem.eventId,
    })
    .from(lineItem)
    .leftJoin(budgetItem, eq(budgetItem.id, lineItem.budgetItemId))
    .where(and(eq(lineItem.id, lineItemId), eq(lineItem.requestId, requestId)))
  if (!found) throw new ApiError('NOT_FOUND')
  return found
}

// 취소한 사람이 요청한 사람이 아니고 요청한 사람이 지금도 운영진이면 알림 기록 하나를 남긴다(결재 결과 알림과 같은 길).
async function noticeCancel(
  tx: Tx,
  actor: Actor,
  made: { requestId: string; requestedBy: string; now: Date },
): Promise<PurchaseNotice | null> {
  const { requestId, requestedBy, now } = made
  if (requestedBy === actor.memberId) return null
  const alive = await currentMembersAmong(tx, actor.councilId, [requestedBy], now)
  if (!alive.has(requestedBy)) return null
  await createRecord(tx, {
    kind: 'notification',
    councilId: actor.councilId,
    actor: null,
    values: {
      recipientId: requestedBy,
      recordId: requestId,
      type: 'changed',
      notifiedAt: clockNow,
    },
  })
  return { requestId, recipientIds: [requestedBy], decidedBy: actor.memberId, itemCancelled: true }
}

// 승인했고 결제하지 않은 품목을 사유와 함께 취소한다(DEC-73). 승인 기록은 그대로 두고 취소 결재 한 줄을 더한다.
// 학생회 행 잠금과 운영진 확인 뒤에 부르고, 요청 행 → 품목 행 차례로 잠근다. 결제 가능을 읽는 지출 쓰기도 학생회 행 잠금 아래라 겹치면 하나만 된다.
// 403이 먼저이고, 판정은 읽기의 actions와 같은 decideLineItem이다.
export async function cancelLineItem(
  tx: Tx,
  actor: Actor,
  target: { requestId: string; lineItemId: string },
  command: { input: CancelLineItem; now: Date },
): Promise<{ request: PurchaseRequestDetail; notice: PurchaseNotice | null }> {
  const { requestId, lineItemId } = target
  if (!can(actor, 'purchase.approve')) throw new ApiError('FORBIDDEN')
  const row = await lockedRequestRow(tx, actor, requestId)
  const found = await lockedItemFacts(tx, requestId, lineItemId)
  const eventCompleted = await lockedCompleted(tx, [row.eventId, found.budgetEventId])
  const code = decideLineItem(
    actor,
    {
      status: lineItemStatusOf(found.outcome),
      paid: found.paid,
      requestCancelled: row.cancelledAt !== null,
      eventCompleted,
    },
    'line_item.cancel',
  )
  if (code) throw new ApiError(code)
  await createRecord(tx, {
    kind: 'approval',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: {
      targetId: lineItemId,
      targetKind: 'line_item',
      outcome: 'cancelled',
      actorId: actor.memberId,
      actorKind: 'member',
      actedAt: clockNow,
      reason: command.input.reason,
    },
  })
  const notice = await noticeCancel(tx, actor, {
    requestId,
    requestedBy: row.requestedBy,
    now: command.now,
  })
  return { request: await requestDetailOf(tx, actor, requestId), notice }
}
