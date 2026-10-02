import { createHash, randomUUID } from 'node:crypto'
import { and, asc, eq, gt, inArray, isNull, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type { DeliveryLookupRequest, DeliveryLookupResponse, DeliverySummary, EventDeliveriesResponse, RegisterShipmentRequest } from '@vada/contracts'
import { departments, events, memberships, purchaseItems, purchaseRequests, shipments, shipmentItems, shipmentJobs, shipmentRegistrations } from '../db/schema.js'
import type { DeliveryProvider } from './provider.js'
import { DeliveryError } from './validation.js'
import type { DeliveryDatabase } from './database.js'
import { enqueueDeliveryJob as queue } from './job-repository.js'
export type { DeliveryDatabase } from './database.js'

type Db = PgDatabase<PgQueryResultHKT>
type Reader = Pick<Db, 'select'>
export interface DeliveryScope { userId: string; organizationId: string }

// 짧은 저장 트랜잭션에서 권한 변경을 잠그고 다시 확인한다.
async function access(db: Reader, scope: DeliveryScope, finance = false, lock = false) {
  const query = db.select({ finance: departments.handlesFinance }).from(memberships)
    .innerJoin(departments, and(eq(memberships.departmentId, departments.id), eq(memberships.organizationId, departments.organizationId)))
    .where(and(eq(memberships.organizationId, scope.organizationId), eq(memberships.userId, scope.userId)))
  const [member] = await (lock ? query.for('share') : query)
  if (!member || (finance && !member.finance)) throw new DeliveryError('FORBIDDEN', 403)
  return member
}
async function selectedItems(db: Reader, scope: DeliveryScope, ids: string[], lock = false) {
  const query = db.select({ id: purchaseItems.id, requestId: purchaseItems.requestId, status: purchaseRequests.status })
    .from(purchaseItems).innerJoin(purchaseRequests, eq(purchaseItems.requestId, purchaseRequests.id))
    .where(and(inArray(purchaseItems.id, ids), eq(purchaseRequests.organizationId, scope.organizationId))).orderBy(asc(purchaseItems.id))
  const rows = await (lock ? query.for('share') : query)
  if (rows.length !== ids.length) throw new DeliveryError('NOT_FOUND', 404)
  if (rows.some(row => row.status !== 'approved')) throw new DeliveryError('PURCHASE_NOT_APPROVED', 409)
  if (new Set(rows.map(row => row.requestId)).size !== 1) throw new DeliveryError('ONE_REQUEST_REQUIRED')
  return rows
}
const hashInput = (input: RegisterShipmentRequest) => createHash('sha256').update(JSON.stringify({ carrierId: input.carrierId, trackingNumber: input.trackingNumber, purchaseItemIds: [...input.purchaseItemIds].sort() })).digest('hex')
async function receipt(db: Reader, scope: DeliveryScope, input: RegisterShipmentRequest) {
  const [row] = await db.select().from(shipmentRegistrations).where(and(eq(shipmentRegistrations.organizationId, scope.organizationId), eq(shipmentRegistrations.actorId, scope.userId), eq(shipmentRegistrations.idempotencyKey, input.idempotencyKey)))
  if (row && row.inputHash !== hashInput(input)) throw new DeliveryError('IDEMPOTENCY_CONFLICT', 409)
  return row
}
function summary(row: typeof shipments.$inferSelect, finance: boolean, linkId: string): DeliverySummary {
  return {
    linkId,
    id: row.id, carrierId: row.carrierId,
    trackingNumber: finance ? row.trackingNumber : (row.trackingNumber.length > 4 ? '*'.repeat(row.trackingNumber.length - 4) + row.trackingNumber.slice(-4) : '****'),
    trackingNumberMasked: !finance, status: row.status, lastEventAt: row.lastEventAt?.toISOString() ?? null,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null, lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
    refreshFailed: row.lastErrorCode !== null, trackingActive: row.trackingActive, webhookExpiresAt: row.webhookExpiresAt?.toISOString() ?? null,
  }
}
export function createDeliveryService(db: DeliveryDatabase, provider: DeliveryProvider) {
  // 단일 M1 인스턴스에서 사용자별 외부 호출 동시성·연속 호출을 제한한다.
  // 다중 인스턴스 운영 전 공유 rate limiter로 교체한다.
  const active = new Set<string>()
  const recent = new Map<string, { started: number; count: number }>()
  async function external<T>(scope: DeliveryScope, action: () => Promise<T>): Promise<T> {
    const now = Date.now()
    for (const [key, value] of recent) if (now - value.started >= 60_000) recent.delete(key)
    const usage = recent.get(scope.userId) ?? { started: now, count: 0 }
    if (active.has(scope.userId) || usage.count >= 20) throw new DeliveryError('DELIVERY_RATE_LIMITED', 429)
    usage.count++; recent.set(scope.userId, usage); active.add(scope.userId)
    try { return await action() }
    catch (error) { if (error instanceof DeliveryError) throw error; throw new DeliveryError('DELIVERY_PROVIDER_FAILED', 502) }
    finally { active.delete(scope.userId) }
  }
  return {
    async carriers(userId: string, after?: string, search?: string) {
      return external({ userId, organizationId: '' }, () => provider.carriers(after, search))
    },
    async lookup(scope: DeliveryScope, input: DeliveryLookupRequest) {
      await access(db, scope, true)
      const result = await external(scope, () => provider.lookup(input))
      await access(db, scope, true)
      return result
    },
    async register(scope: DeliveryScope, input: RegisterShipmentRequest) {
      await access(db, scope, true)
      const existing = await receipt(db, scope, input)
      if (existing) return { shipmentId: existing.shipmentId, replayed: true }
      await selectedItems(db, scope, input.purchaseItemIds)
      const snapshot: DeliveryLookupResponse = await external(scope, () => provider.lookup(input))
      return db.transaction(async tx => {
        // 같은 사용자·학생회의 멱등키 등록을 직렬화한다. 외부 조회 중에는 잠그지 않는다.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([scope.organizationId, scope.userId])}, 0))`)
        await access(tx, scope, true, true)
        const replay = await receipt(tx, scope, input)
        if (replay) return { shipmentId: replay.shipmentId, replayed: true }
        const items = await selectedItems(tx, scope, input.purchaseItemIds, true)
        await tx.insert(shipments).values({ id: randomUUID(), organizationId: scope.organizationId, carrierId: input.carrierId, trackingNumber: input.trackingNumber, createdBy: scope.userId }).onConflictDoNothing()
        const [row] = await tx.select().from(shipments).where(and(eq(shipments.organizationId, scope.organizationId), eq(shipments.carrierId, input.carrierId), eq(shipments.trackingNumber, input.trackingNumber))).for('update')
        if (!row) throw new Error('Missing shipment')
        const time = snapshot.lastEventAt ? new Date(snapshot.lastEventAt) : null
        const fresh = time !== null && (row.lastEventAt === null || time > row.lastEventAt)
        const status = fresh || row.lastCheckedAt === null ? snapshot.status : row.status
        const checked = new Date(snapshot.checkedAt)
        const laterCheck = !row.lastCheckedAt || checked > row.lastCheckedAt
        await tx.update(shipments).set({
          ...(fresh || row.lastCheckedAt === null ? { status, providerStatus: snapshot.providerStatus, lastEventAt: time } : {}),
          ...(laterCheck ? { lastCheckedAt: checked, lastAttemptAt: checked, lastErrorCode: null } : {}),
          trackingActive: status !== 'delivered',
          trackingVersion: row.trackingVersion + 1, webhookExpiresAt: null,
        }).where(eq(shipments.id, row.id))
        for (const item of items) await tx.insert(shipmentItems).values({ id: randomUUID(), shipmentId: row.id, purchaseItemId: item.id, requestId: item.requestId, organizationId: scope.organizationId, linkedBy: scope.userId }).onConflictDoNothing()
        // 상충하는 대기 작업은 취소한다. 실행 중 작업은 worker가 현재 trackingActive를 재검증해야 한다.
        const kind = status === 'delivered' ? 'unregister' : 'register'
        await tx.update(shipmentJobs).set({ status: 'completed' }).where(and(eq(shipmentJobs.shipmentId, row.id), eq(shipmentJobs.status, 'pending'), inArray(shipmentJobs.kind, kind === 'register' ? ['unregister'] : ['register', 'refresh'])))
        await queue(tx, row.id, kind)
        await tx.insert(shipmentRegistrations).values({ id: randomUUID(), organizationId: scope.organizationId, actorId: scope.userId, idempotencyKey: input.idempotencyKey, inputHash: hashInput(input), shipmentId: row.id })
        return { shipmentId: row.id, replayed: false }
      })
    },
    async list(scope: DeliveryScope, eventId: string, after?: string): Promise<EventDeliveriesResponse> {
      return db.transaction(async tx => {
        const member = await access(tx, scope, false, true)
        const [event] = await tx.select({ id: events.id }).from(events).where(and(eq(events.id, eventId), eq(events.organizationId, scope.organizationId)))
        if (!event) throw new DeliveryError('NOT_FOUND', 404)
        const rows = await tx.select({ id: purchaseItems.id, requestId: purchaseItems.requestId, productName: purchaseItems.productName, quantity: purchaseItems.quantity }).from(purchaseItems)
          .innerJoin(purchaseRequests, eq(purchaseItems.requestId, purchaseRequests.id))
          .where(and(eq(purchaseRequests.organizationId, scope.organizationId), eq(purchaseRequests.eventId, eventId), eq(purchaseRequests.status, 'approved'), after ? gt(purchaseItems.id, after) : undefined)).orderBy(asc(purchaseItems.id)).limit(51)
        const page = rows.slice(0, 50)
        const links = page.length ? await tx.select({ linkId: shipmentItems.id, itemId: shipmentItems.purchaseItemId, shipment: shipments }).from(shipmentItems)
          .innerJoin(shipments, and(eq(shipments.id, shipmentItems.shipmentId), eq(shipments.organizationId, shipmentItems.organizationId)))
          .where(and(eq(shipmentItems.organizationId, scope.organizationId), inArray(shipmentItems.purchaseItemId, page.map(item => item.id)), isNull(shipmentItems.unlinkedAt)))
          .orderBy(asc(shipments.createdAt), asc(shipments.id)) : []
        return { items: page.map(item => ({ ...item, shipments: links.filter(link => link.itemId === item.id).map(link => summary(link.shipment, member.finance, link.linkId)) })), nextCursor: rows.length > 50 ? page.at(-1)!.id : null }
      })
    },
    async unlink(scope: DeliveryScope, id: string, linkIds: string[]) {
      return db.transaction(async tx => {
        await access(tx, scope, true, true)
        const [row] = await tx.select().from(shipments).where(and(eq(shipments.id, id), eq(shipments.organizationId, scope.organizationId))).for('update')
        if (!row) throw new DeliveryError('NOT_FOUND', 404)
        const links = await tx.select().from(shipmentItems).where(and(eq(shipmentItems.shipmentId, id), eq(shipmentItems.organizationId, scope.organizationId), inArray(shipmentItems.id, linkIds)))
        if (links.length !== linkIds.length) throw new DeliveryError('NOT_FOUND', 404)
        await tx.update(shipmentItems).set({ unlinkedBy: scope.userId, unlinkedAt: sql`GREATEST(now(), ${shipmentItems.linkedAt})` }).where(and(eq(shipmentItems.shipmentId, id), inArray(shipmentItems.id, linkIds), isNull(shipmentItems.unlinkedAt)))
        const [remaining] = await tx.select({ id: shipmentItems.id }).from(shipmentItems).where(and(eq(shipmentItems.shipmentId, id), isNull(shipmentItems.unlinkedAt))).limit(1)
        if (!remaining) {
          await tx.update(shipments).set({ trackingActive: false, trackingVersion: row.trackingVersion + (row.trackingActive ? 1 : 0), webhookExpiresAt: null }).where(eq(shipments.id, id))
          await tx.update(shipmentJobs).set({ status: 'completed' }).where(and(eq(shipmentJobs.shipmentId, id), eq(shipmentJobs.status, 'pending'), inArray(shipmentJobs.kind, ['register','refresh'])))
          await queue(tx, id, 'unregister')
        }
        return { shipmentId: id }
      })
    },
  }
}
