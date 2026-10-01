import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray, lte, or, sql } from 'drizzle-orm'
import type { DeliveryLookupResponse } from '@vada/contracts'
import { shipmentJobs, shipments } from '../db/schema.js'
import type { DeliveryDatabase, DeliveryTransaction } from './database.js'
import { refreshedShipment } from './refresh.js'

type Kind = typeof shipmentJobs.$inferSelect.kind
export type ClaimedJob = { job: typeof shipmentJobs.$inferSelect; shipment: typeof shipments.$inferSelect }
type Outcome = { kind: 'refresh'; result: DeliveryLookupResponse } | { kind: 'register'; expiresAt: Date } | { kind: 'skip' } | { kind: 'error' } | { kind: 'unregister' }
const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
const MAX_ATTEMPTS = 5

export async function enqueueDeliveryJob(tx: DeliveryTransaction, shipmentId: string, kind: Kind, runAfter = new Date()) {
  await tx.insert(shipmentJobs).values({ id: randomUUID(), shipmentId, kind, runAfter }).onConflictDoNothing()
}

export function createDeliveryJobs(db: DeliveryDatabase, clock = () => new Date()) {
  return {
    async scheduleRenewals() {
      const now = clock()
      await db.transaction(async tx => {
        const rows = await tx.select().from(shipments).where(and(eq(shipments.trackingActive, true),
          sql`(${shipments.webhookExpiresAt} IS NULL OR ${shipments.webhookExpiresAt} <= ${new Date(now.getTime() + DAY).toISOString()}::timestamptz)`,
          sql`NOT EXISTS (SELECT 1 FROM shipment_jobs j WHERE j.shipment_id = ${shipments.id} AND j.kind = 'register' AND
            (j.status IN ('pending','running') OR (j.status = 'failed' AND j.updated_at > ${new Date(now.getTime() - DAY).toISOString()}::timestamptz)))`,
        )).orderBy(asc(shipments.webhookExpiresAt), asc(shipments.id)).limit(100).for('update', { skipLocked: true })
        for (const row of rows) await enqueueDeliveryJob(tx, row.id, 'register', now)
      })
    },
    async claim(): Promise<ClaimedJob | null> {
      const now = clock()
      return db.transaction(async tx => {
        // 모든 경로는 배송 → 작업 순서로 잠근다. 종류가 달라도 배송당 하나만 실행한다.
        const [shipment] = await tx.select().from(shipments).where(sql`
          EXISTS (SELECT 1 FROM shipment_jobs j WHERE j.shipment_id = ${shipments.id} AND
            ((j.status = 'pending' AND j.run_after <= ${now.toISOString()}::timestamptz) OR (j.status = 'running' AND j.locked_until <= ${now.toISOString()}::timestamptz)))
          AND NOT EXISTS (SELECT 1 FROM shipment_jobs j WHERE j.shipment_id = ${shipments.id} AND j.status = 'running' AND j.locked_until > ${now.toISOString()}::timestamptz)
        `).orderBy(asc(shipments.id)).limit(1).for('update', { skipLocked: true })
        if (!shipment) return null
        const [job] = await tx.select().from(shipmentJobs).where(and(eq(shipmentJobs.shipmentId, shipment.id), or(
          and(eq(shipmentJobs.status, 'running'), lte(shipmentJobs.lockedUntil, now)),
          and(eq(shipmentJobs.status, 'pending'), lte(shipmentJobs.runAfter, now)),
        ))).orderBy(sql`CASE WHEN ${shipmentJobs.status} = 'running' THEN 0 ELSE 1 END`, asc(shipmentJobs.runAfter), asc(shipmentJobs.id)).limit(1).for('update')
        if (!job) return null
        if (job.attempts >= MAX_ATTEMPTS) {
          await tx.update(shipmentJobs).set({ status: 'failed', lockedUntil: null, lastErrorCode: 'DELIVERY_LEASE_EXHAUSTED', updatedAt: now }).where(eq(shipmentJobs.id, job.id))
          await tx.update(shipments).set({ lastErrorCode: 'DELIVERY_LEASE_EXHAUSTED', lastAttemptAt: now }).where(eq(shipments.id, shipment.id))
          return null
        }
        const [claimed] = await tx.update(shipmentJobs).set({ status: 'running', attempts: job.attempts + 1, lockedUntil: new Date(now.getTime() + MINUTE), updatedAt: now }).where(eq(shipmentJobs.id, job.id)).returning()
        return { job: claimed!, shipment }
      })
    },
    async finish(claim: ClaimedJob, outcome: Outcome): Promise<boolean> {
      const now = clock()
      return db.transaction(async tx => {
        const [row] = await tx.select().from(shipments).where(eq(shipments.id, claim.shipment.id)).for('update')
        const [job] = await tx.select().from(shipmentJobs).where(eq(shipmentJobs.id, claim.job.id)).for('update')
        // attempts를 잠금 세대로 사용한다. 회수되었거나 만료된 작업 결과는 거절한다.
        if (!row || !job || job.status !== 'running' || job.attempts !== claim.job.attempts || !job.lockedUntil || job.lockedUntil <= now) return false
        const completed = async () => { await tx.update(shipmentJobs).set({ status: 'completed', lockedUntil: null, lastErrorCode: null, updatedAt: now }).where(eq(shipmentJobs.id, job.id)) }
        if (row.trackingVersion !== claim.shipment.trackingVersion) {
          await completed()
          await enqueueDeliveryJob(tx, row.id, row.trackingActive ? 'register' : 'unregister', now)
          return false
        }
        if (outcome.kind === 'error') {
          const code = job.kind === 'refresh' ? 'DELIVERY_REFRESH_FAILED' : 'DELIVERY_REGISTRATION_FAILED'
          if (row.trackingActive) await tx.update(shipments).set({ lastAttemptAt: now, lastErrorCode: code }).where(eq(shipments.id, row.id))
          // 실행 중 들어온 알림은 같은 재시도에 병합하여 백오프 우회를 막는다.
          await tx.update(shipmentJobs).set({ status: 'completed', updatedAt: now }).where(and(eq(shipmentJobs.shipmentId, row.id), eq(shipmentJobs.kind, job.kind), eq(shipmentJobs.status, 'pending')))
          await tx.update(shipmentJobs).set({ status: job.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending', lockedUntil: null,
            runAfter: new Date(now.getTime() + Math.min(60, 2 ** (job.attempts - 1)) * MINUTE), lastErrorCode: code, updatedAt: now,
          }).where(eq(shipmentJobs.id, job.id))
          return true
        }
        if (outcome.kind === 'refresh' && row.trackingActive) {
          const patch = refreshedShipment(row, outcome.result, now)
          await tx.update(shipments).set(patch).where(eq(shipments.id, row.id))
          if (patch.trackingActive === false) {
            await tx.update(shipmentJobs).set({ status: 'completed', updatedAt: now }).where(and(eq(shipmentJobs.shipmentId, row.id), eq(shipmentJobs.status, 'pending'), inArray(shipmentJobs.kind, ['register', 'refresh'])))
            await enqueueDeliveryJob(tx, row.id, 'unregister', now)
          }
        }
        if (outcome.kind === 'register' && row.trackingActive) {
          await tx.update(shipments).set({ webhookExpiresAt: outcome.expiresAt }).where(eq(shipments.id, row.id))
          // 시작/갱신 중 놓친 알림을 보완한다. 등록만 성공해도 조회 실패 표시는 지우지 않는다.
          await enqueueDeliveryJob(tx, row.id, 'refresh', now)
        }
        if (outcome.kind === 'unregister' && !row.trackingActive) await tx.update(shipments).set({ webhookExpiresAt: null }).where(eq(shipments.id, row.id))
        await completed()
        return true
      })
    },
  }
}
