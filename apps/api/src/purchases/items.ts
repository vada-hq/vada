import { and, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm'
import { alias, type PgDatabase, type PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type { PurchaseItemDetail, PurchaseItemSummary } from '@vada/contracts'
import { departments, events, messages, purchaseItemEvents, purchaseItems as items, purchaseItemSources, purchaseSubmissions as submissions,
  shipmentItems, shipments, users } from '../db/schema.js'
import { deliverySummary } from '../deliveries/summary.js'

type Reader = Pick<PgDatabase<PgQueryResultHKT>, 'select'>
// 보는 사람. 본인 품목 표시와 송장번호 가리기에 쓴다.
export interface Viewer { organizationId: string; userId: string; finance: boolean }

const requesters = alias(users, 'requesters')
const deciders = alias(users, 'deciders')
const receivers = alias(users, 'receivers')
const authors = alias(users, 'authors')
const iso = (value: Date | null) => value?.toISOString() ?? null

// 품목 목록·상세·변경 응답이 같은 칸을 쓴다.
export async function itemSummaries(db: Reader, viewer: Viewer, where: SQL | undefined, order: SQL[], limit = 1000): Promise<PurchaseItemSummary[]> {
  const rows = await db.select({
    item: items,
    eventName: events.name,
    requesterName: requesters.name,
    departmentName: departments.name,
    submittedAt: submissions.submittedAt,
    deciderName: deciders.name,
    receiverName: receivers.name,
    neededByChanged: sql<boolean>`exists (select 1 from ${purchaseItemEvents} where ${purchaseItemEvents.itemId} = ${items.id} and ${purchaseItemEvents.action} = 'needed_by_changed')`,
  }).from(items)
    .innerJoin(events, and(eq(events.id, items.eventId), eq(events.organizationId, items.organizationId)))
    .innerJoin(requesters, eq(requesters.id, items.requesterId))
    .leftJoin(submissions, and(eq(submissions.id, items.submissionId), eq(submissions.organizationId, items.organizationId)))
    .leftJoin(departments, and(eq(departments.id, submissions.departmentId), eq(departments.organizationId, submissions.organizationId)))
    .leftJoin(deciders, eq(deciders.id, items.decidedBy))
    .leftJoin(receivers, eq(receivers.id, items.receivedBy))
    .where(and(eq(items.organizationId, viewer.organizationId), where)).orderBy(...order).limit(limit)
  const ids = rows.map(row => row.item.id)
  const links = ids.length ? await db.select({ linkId: shipmentItems.id, itemId: shipmentItems.purchaseItemId, shipment: shipments }).from(shipmentItems)
    .innerJoin(shipments, and(eq(shipments.id, shipmentItems.shipmentId), eq(shipments.organizationId, shipmentItems.organizationId)))
    .where(and(eq(shipmentItems.organizationId, viewer.organizationId), inArray(shipmentItems.purchaseItemId, ids), isNull(shipmentItems.unlinkedAt)))
    .orderBy(shipments.createdAt, shipments.id) : []
  return rows.map(({ item, ...row }) => ({
    id: item.id, event: { id: item.eventId, name: row.eventName }, requester: { id: item.requesterId, name: row.requesterName },
    mine: item.requesterId === viewer.userId, departmentName: row.departmentName, status: item.status, version: item.version,
    submissionId: item.submissionId, productUrl: item.productUrl, productName: item.productName, selectedOption: item.selectedOption,
    optionRequired: item.optionRequired, quantity: item.quantity, packagingUnit: item.packagingUnit, estimatedUnitPrice: item.estimatedUnitPrice,
    note: item.note, neededBy: item.neededBy, neededByChanged: row.neededByChanged,
    warnings: Array.isArray(item.warnings) ? item.warnings.filter((value): value is string => typeof value === 'string') : [],
    createdAt: item.createdAt.toISOString(), submittedAt: iso(row.submittedAt), decidedAt: iso(item.decidedAt),
    decidedBy: item.decidedBy && row.deciderName !== null ? { id: item.decidedBy, name: row.deciderName } : null,
    decisionReason: item.decisionReason, purchasedAt: iso(item.purchasedAt), receivedAt: iso(item.receivedAt),
    receivedBy: item.receivedBy && row.receiverName !== null ? { id: item.receivedBy, name: row.receiverName } : null,
    shipments: links.filter(link => link.itemId === item.id).map(link => deliverySummary(link.shipment, viewer.finance, link.linkId)),
  }))
}

export async function itemDetail(db: Reader, viewer: Viewer, summary: PurchaseItemSummary): Promise<PurchaseItemDetail> {
  const sources = await db.select({ id: messages.id, content: messages.content, authorName: authors.name, createdAt: messages.createdAt })
    .from(purchaseItemSources).innerJoin(messages, eq(messages.id, purchaseItemSources.messageId)).innerJoin(authors, eq(authors.id, messages.authorId))
    .where(eq(purchaseItemSources.itemId, summary.id)).orderBy(messages.createdAt, messages.id)
  const history = await db.select({ id: purchaseItemEvents.id, action: purchaseItemEvents.action, actorId: purchaseItemEvents.actorId,
    actorName: users.name, reason: purchaseItemEvents.reason, changes: purchaseItemEvents.changes, createdAt: purchaseItemEvents.createdAt })
    .from(purchaseItemEvents).innerJoin(users, eq(users.id, purchaseItemEvents.actorId))
    .where(and(eq(purchaseItemEvents.organizationId, viewer.organizationId), eq(purchaseItemEvents.itemId, summary.id)))
    .orderBy(purchaseItemEvents.createdAt, purchaseItemEvents.id)
  return {
    ...summary,
    sources: sources.map(source => ({ ...source, createdAt: source.createdAt.toISOString() })),
    history: history.map(({ actorId, actorName, ...entry }) => ({ ...entry, actor: { id: actorId, name: actorName }, createdAt: entry.createdAt.toISOString() })),
  }
}

// 품목들의 행사. 품목의 행사는 바뀌지 않으므로 잠그지 않고 읽은 뒤 행사 행부터 잠근다(잠금 순서: 행사 → 품목, M5a).
export async function eventIdsOfItems(db: Reader, organizationId: string, itemIds: string[]) {
  if (!itemIds.length) return []
  const rows = await db.select({ eventId: items.eventId }).from(items)
    .where(and(eq(items.organizationId, organizationId), inArray(items.id, itemIds)))
  return [...new Set(rows.map(row => row.eventId))]
}
