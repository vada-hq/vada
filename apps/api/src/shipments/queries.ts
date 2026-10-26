import { and, asc, eq } from 'drizzle-orm'
import type { PurchaseShipment, ShipmentCarrier } from '@vada/contracts'
import type { Actor } from '../access/actor.js'
import { shipmentChangeCode } from './policy.js'
import { record, shipment, shipmentItem } from '../db/schema.js'
import type { Db } from '../db/types.js'
import { ApiError } from '../http/errors.js'
import { completedEventIdsAmong } from '../policy/locks.js'
import { memberNamesOf } from '../team/display-name.js'

type Reader = Pick<Db, 'select'>
export async function shipmentRowOf(
  db: Reader,
  actor: Actor,
  target: { requestId: string; shipmentId: string },
) {
  const [row] = await db
    .select()
    .from(shipment)
    .where(
      and(
        eq(shipment.id, target.shipmentId),
        eq(shipment.requestId, target.requestId),
        eq(shipment.councilId, actor.councilId),
      ),
    )
  if (!row) throw new ApiError('NOT_FOUND')
  return row
}

export async function shipmentsOf(
  db: Reader,
  actor: Actor,
  request: {
    id: string
    requestedBy: string
    eventId: string | null
    cancelledAt: Date | null
  },
): Promise<PurchaseShipment[]> {
  const rows = await db
    .select({ row: shipment, createdBy: record.createdBy, createdAt: record.createdAt })
    .from(shipment)
    .innerJoin(record, eq(record.id, shipment.id))
    .where(and(eq(shipment.requestId, request.id), eq(shipment.councilId, actor.councilId)))
    .orderBy(asc(record.createdAt), asc(shipment.id))
  if (!rows.length) return []
  const links = await db
    .select({ shipmentId: shipmentItem.shipmentId, lineItemId: shipmentItem.lineItemId })
    .from(shipmentItem)
    .innerJoin(shipment, eq(shipment.id, shipmentItem.shipmentId))
    .where(and(eq(shipment.requestId, request.id), eq(shipment.councilId, actor.councilId)))
    .orderBy(asc(shipmentItem.lineItemId))
  const names = await memberNamesOf(
    db,
    actor.councilId,
    rows.flatMap(row => (row.createdBy ? [row.createdBy] : [])),
  )
  const completed = request.eventId
    ? (await completedEventIdsAmong(db, [request.eventId])).has(request.eventId)
    : false
  const editable =
    shipmentChangeCode(actor, {
      requestedBy: request.requestedBy,
      requestCancelled: request.cancelledAt !== null,
      eventCompleted: completed,
    }) === null
  return rows.map(({ row, createdBy, createdAt }) => ({
    id: row.id,
    carrierId: row.carrierId as ShipmentCarrier,
    trackingNumber: row.trackingNumber,
    lineItemIds: links.filter(link => link.shipmentId === row.id).map(link => link.lineItemId),
    createdBy: createdBy ? { id: createdBy, name: names.get(createdBy)! } : null,
    createdAt: createdAt.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    editable: editable && !row.cancelledAt,
  }))
}
