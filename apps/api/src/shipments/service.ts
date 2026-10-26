import { and, asc, eq, inArray } from 'drizzle-orm'
import type { ShipmentInput, PurchaseShipment, CancelShipment } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { can } from '../access/permissions.js'
import { lineItem, record, shipment } from '../db/schema.js'
import type { Tx } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { lockEventsShared } from '../policy/locks.js'
import { factsOf } from '../purchases/policy.js'
import { shipmentChangeCode } from './policy.js'
import { lastOutcomeOf } from '../purchases/last-outcome.js'
import { lockedRequestRow } from '../purchases/lock.js'
import { clockNow, createRecord, updateRecord } from '../records/records.js'
import { writeShipmentItems } from '../records/shipment-items.js'
import { shipmentRowOf, shipmentsOf } from './queries.js'

type Target = { requestId: string; shipmentId?: string }
async function writableRequest(tx: Tx, actor: Actor, target: Target) {
  const request = await lockedRequestRow(tx, actor, target.requestId)
  if (!can(actor, 'purchase.shipment', { requestedBy: request.requestedBy }))
    throw new ApiError('FORBIDDEN')
  if (target.shipmentId) {
    const row = await shipmentRowOf(tx, actor, {
      requestId: request.id,
      shipmentId: target.shipmentId,
    })
    await tx
      .select({ id: shipment.id })
      .from(shipment)
      .where(eq(shipment.id, row.id))
      .for('no key update')
    if (row.cancelledAt) throw new ApiError('SHIPMENT_CANCELLED')
  }
  await lockEventsShared(tx, [request.eventId])
  const code = shipmentChangeCode(actor, await factsOf(tx, request))
  if (code) throw new ApiError(code)
  return request
}

async function assertApproved(tx: Tx, actor: Actor, requestId: string, ids: string[]) {
  const rows = await tx
    .select({ id: lineItem.id, outcome: lastOutcomeOf(lineItem.id) })
    .from(lineItem)
    .innerJoin(record, eq(record.id, lineItem.id))
    .where(
      and(
        eq(record.councilId, actor.councilId),
        eq(lineItem.requestId, requestId),
        inArray(lineItem.id, ids),
      ),
    )
    .orderBy(asc(lineItem.id))
  if (rows.length !== ids.length) throw new ApiError('NOT_FOUND')
  if (rows.some(row => row.outcome !== 'approved')) throw new ApiError('LINE_ITEM_NOT_SHIPPABLE')
}

// 학생회 행 → 요청 행 → 배송 행 순서다. 결재·품목 취소도 같은 학생회 잠금 아래라 승인 확인 뒤에 끼어들지 못한다.
export async function saveShipment(
  tx: Tx,
  actor: Actor,
  target: Target,
  input: ShipmentInput,
): Promise<PurchaseShipment> {
  const request = await writableRequest(tx, actor, target)
  await assertApproved(tx, actor, request.id, input.lineItemIds)
  const values = { carrierId: input.carrierId, trackingNumber: input.trackingNumber }
  let id = target.shipmentId
  if (id)
    await updateRecord(tx, {
      kind: 'shipment',
      id,
      actor: actor.memberId,
      reason: null,
      changes: values,
    })
  else
    id = await createRecord(tx, {
      kind: 'shipment',
      councilId: actor.councilId,
      actor: actor.memberId,
      values: { ...values, requestId: request.id },
    })
  await writeShipmentItems(tx, id, actor.councilId, input.lineItemIds)
  return (await shipmentsOf(tx, actor, request)).find(row => row.id === id)!
}

export async function cancelShipment(
  tx: Tx,
  actor: Actor,
  target: { requestId: string; shipmentId: string },
  input: CancelShipment,
): Promise<PurchaseShipment> {
  const request = await writableRequest(tx, actor, target)
  const current = (await shipmentsOf(tx, actor, request)).find(row => row.id === target.shipmentId)!
  await updateRecord(tx, {
    kind: 'shipment',
    id: current.id,
    actor: actor.memberId,
    reason: input.reason,
    changes: { cancelledAt: clockNow },
  })
  await writeShipmentItems(tx, current.id, actor.councilId, current.lineItemIds)
  return (await shipmentsOf(tx, actor, request)).find(row => row.id === current.id)!
}
