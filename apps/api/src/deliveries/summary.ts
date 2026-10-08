import type { DeliverySummary } from '@vada/contracts'
import type { shipments } from '../db/schema.js'

// 송장번호는 재정부에게만 전부 보인다. 다른 구성원에게는 뒤 4자리만 보인다.
export function deliverySummary(row: typeof shipments.$inferSelect, finance: boolean, linkId: string): DeliverySummary {
  return {
    linkId,
    id: row.id, carrierId: row.carrierId,
    trackingNumber: finance ? row.trackingNumber : (row.trackingNumber.length > 4 ? '*'.repeat(row.trackingNumber.length - 4) + row.trackingNumber.slice(-4) : '****'),
    trackingNumberMasked: !finance, status: row.status, lastEventAt: row.lastEventAt?.toISOString() ?? null,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null, lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
    refreshFailed: row.lastErrorCode !== null, trackingActive: row.trackingActive, webhookExpiresAt: row.webhookExpiresAt?.toISOString() ?? null,
  }
}
