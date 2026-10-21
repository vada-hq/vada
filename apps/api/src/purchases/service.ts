import type { CreatePurchaseRequest, PurchaseRequestDetail } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { currentFinanceMembers } from './finance-members.js'
import { lockedRequestRow } from './lock.js'
import { decidedCountOf, requestDetailOf } from './queries.js'
import { canCancel, requestStatusOf } from './status.js'

// 휴대폰 알림에 쓰는 값. 알림 기록은 같은 거래에서 이미 남겼고, 휴대폰 알림은 커밋 뒤에 보낸다.
// decidedBy가 없으면 새 요청(재정부에게), 있으면 결재 결과(요청한 사람에게)이고 결재한 사람의 운영진 번호다.
export type PurchaseNotice = {
  requestId: string
  recipientIds: string[]
  decidedBy: string | null
}

// 쓰기 거래는 학생회 행 잠금 → 운영진 확인(inCouncilChange) → 요청 행 → 품목 행 순서다. 이 함수들은 앞의 둘이 끝난 거래에서 부른다.

// 새 요청은 재정부의 지금 부서원(요청한 사람 제외)마다 알림 기록 하나를 남긴다(T3). 재정부가 없어도 요청은 만들어진다.
async function noticeNewRequest(
  tx: Tx,
  actor: Actor,
  requestId: string,
  now: Date,
): Promise<PurchaseNotice | null> {
  const members = await currentFinanceMembers(tx, actor, now)
  const recipientIds = members.filter(id => id !== actor.memberId)
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
  // 403이 다른 실패보다 먼저다. 요청한 사람은 늘 나다(DEC-40의 대신 내기는 미뤘다).
  if (!can(actor, 'purchase.request')) throw new ApiError('FORBIDDEN')
  const requestId = await createRecord(tx, {
    kind: 'request',
    councilId: actor.councilId,
    actor: actor.memberId,
    values: {
      type: 'purchase',
      title: input.title,
      body: input.body,
      requestedBy: actor.memberId,
      neededBy: input.neededBy,
    },
  })
  for (const item of input.items)
    await createRecord(tx, {
      kind: 'line_item',
      councilId: actor.councilId,
      actor: actor.memberId,
      values: { requestId, ...item },
    })
  const notice = await noticeNewRequest(tx, actor, requestId, now)
  return { request: await requestDetailOf(tx, actor, requestId), notice }
}

// 취소는 취소한 시각을 채우는 것이다. 판은 남는다. 요청한 사람만 하고(회장단도 403), 결재된 품목이 있거나 이미 취소했으면 409다.
// 결재와 겹치면 하나만 된다: 요청 행을 잠근 뒤에 결재 수를 다시 센다.
export async function cancelPurchaseRequest(tx: Tx, actor: Actor, requestId: string) {
  const row = await lockedRequestRow(tx, actor, requestId)
  const facts = {
    requestedBy: row.requestedBy,
    status: requestStatusOf(row.cancelledAt !== null, row),
    decided: await decidedCountOf(tx, requestId),
  }
  if (!can(actor, 'purchase.cancel', { requestedBy: row.requestedBy }))
    throw new ApiError('FORBIDDEN')
  if (!canCancel(actor, facts)) throw new ApiError('REQUEST_CLOSED')
  await updateRecord(tx, {
    kind: 'request',
    id: requestId,
    actor: actor.memberId,
    reason: null,
    changes: { cancelledAt: clockNow },
  })
}
