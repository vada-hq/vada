import type { CreatePurchaseRequest, PurchaseRequestDetail } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { assertCurrentMembers } from '../chat/current-members.js'
import { linkSourceMessage } from '../chat/source-message.js'
import type { Tx } from '../db/types.js'
import { assertEventOpen } from '../events/completion.js'
import { assertCouncilEvent } from '../events/council-event.js'
import { ApiError } from '../http/errors.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { assertLinkableTask } from '../tasks/link.js'
import { currentFinanceMembers } from './finance-members.js'
import { lockedRequestRow } from './lock.js'
import { decide, factsOf, roleAllows } from './policy.js'
import { requestDetailOf } from './queries.js'

// 휴대폰 알림에 쓰는 값. 알림 기록은 같은 거래에서 이미 남겼고, 휴대폰 알림은 커밋 뒤에 보낸다.
// decidedBy가 없으면 새 요청(재정부에게), 있으면 결재 결과(요청한 사람에게)이고 결재한 사람의 운영진 번호다.
export type PurchaseNotice = {
  requestId: string
  recipientIds: string[]
  decidedBy: string | null
  // 승인한 품목을 취소한 알림이다(결재 결과 알림과 제목이 다르다)
  itemCancelled?: boolean
}

// 쓰기 거래는 학생회 행 잠금 → 운영진 확인(inCouncilChange) → 요청 행 → 품목 행 순서다. 이 함수들은 앞의 둘이 끝난 거래에서 부른다.
const itemValues = (requestId: string, item: CreatePurchaseRequest['items'][number]) => ({
  requestId,
  ...item,
  estimatedUnitPrice: item.estimatedUnitPrice?.toString() ?? null,
  estimatedShippingFee: item.estimatedShippingFee?.toString() ?? null,
})

// 새 요청은 재정부의 지금 부서원(만든 사람과 요청한 사람 제외)마다 알림 기록 하나를 남긴다(T3). 재정부가 없어도 요청은 만들어진다.
async function noticeNewRequest(
  tx: Tx,
  actor: Actor,
  made: { requestId: string; requestedBy: string },
  now: Date,
): Promise<PurchaseNotice | null> {
  const { requestId, requestedBy } = made
  const members = await currentFinanceMembers(tx, actor, now)
  const recipientIds = members.filter(id => id !== actor.memberId && id !== requestedBy)
  for (const recipientId of recipientIds)
    await createRecord(tx, {
      kind: 'notification',
      councilId: actor.councilId,
      actor: null,
      values: { recipientId, recordId: requestId, type: 'created', notifiedAt: clockNow },
    })
  return recipientIds.length ? { requestId, recipientIds, decidedBy: null } : null
}

export async function createPurchaseRequest(
  tx: Tx,
  actor: Actor,
  input: CreatePurchaseRequest,
  now: Date,
): Promise<{ request: PurchaseRequestDetail; notice: PurchaseNotice | null }> {
  // 403이 다른 실패보다 먼저다. 요청한 사람은 기본이 나이고, 남을 대신해 내는 것은 재정부만이다(DEC-40).
  if (!can(actor, 'purchase.request')) throw new ApiError('FORBIDDEN')
  const requestedBy = input.requestedBy ?? actor.memberId
  if (requestedBy !== actor.memberId) {
    if (!can(actor, 'finance.manage')) throw new ApiError('FORBIDDEN')
    await assertCurrentMembers(tx, actor.councilId, [requestedBy], now)
  }
  // 다른 학생회 행사(409 EVENT_INVALID)를 먼저 걸러야 잠금 확인이 그 행사의 완료 여부를 드러내지 않는다.
  await assertCouncilEvent(tx, actor, input.eventId)
  await assertEventOpen(tx, input.eventId)
  // 업무를 이으면 요청 하나와 연결 한 줄이 한 거래에서 생기고, 거절이면 아무것도 생기지 않는다.
  if (input.taskId) await assertLinkableTask(tx, actor, input.taskId, now)
  const requestId = await createRecord(tx, {
    kind: 'request',
    councilId: actor.councilId,
    actor: actor.memberId,
    ...(input.taskId ? { taskId: input.taskId } : {}),
    values: {
      type: 'purchase',
      title: input.title,
      eventId: input.eventId,
      body: input.body,
      requestedBy,
      neededBy: input.neededBy,
    },
  })
  await linkSourceMessage(tx, actor, requestId, input.sourceMessageId)
  for (const item of input.items)
    await createRecord(tx, {
      kind: 'line_item',
      councilId: actor.councilId,
      actor: actor.memberId,
      values: itemValues(requestId, item),
    })
  const notice = await noticeNewRequest(tx, actor, { requestId, requestedBy }, now)
  return { request: await requestDetailOf(tx, actor, requestId), notice }
}

// 취소는 취소한 시각을 채우는 것이다. 판은 남는다. 요청한 사람만 하고(회장단도 403), 결재된 품목이 있거나 이미 취소했으면 409다.
// 결재와 겹치면 하나만 된다: 요청 행을 잠근 뒤에 결재 수를 다시 센다.
export async function cancelPurchaseRequest(tx: Tx, actor: Actor, requestId: string) {
  const row = await lockedRequestRow(tx, actor, requestId)
  // 403은 행사 행을 잠그기 전에 낸다. 완료한 행사와 요청 상태는 잠근 뒤에 읽은 값으로 같은 decide가 본다.
  if (!roleAllows(actor, 'purchase_request.cancel', row.requestedBy))
    throw new ApiError('FORBIDDEN')
  await assertEventOpen(tx, row.eventId)
  const code = decide(actor, await factsOf(tx, row), 'purchase_request.cancel')
  if (code) throw new ApiError(code)
  await updateRecord(tx, {
    kind: 'request',
    id: requestId,
    actor: actor.memberId,
    reason: null,
    changes: { cancelledAt: clockNow },
  })
}
