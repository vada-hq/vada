import type { DeliveryLookupResponse } from '@vada/contracts'
import type { shipments } from '../db/schema.js'

// 조회 시각과 이벤트 시각을 분리하고, 늦게 온 과거 이벤트로 상태를 되돌리지 않는다.
export function refreshedShipment(row: typeof shipments.$inferSelect, result: DeliveryLookupResponse, attemptedAt: Date) {
  const eventAt = result.lastEventAt ? new Date(result.lastEventAt) : null
  const fresh = eventAt !== null && (row.lastEventAt === null || eventAt > row.lastEventAt)
  const status = fresh || row.lastCheckedAt === null ? result.status : row.status
  const checkedAt = new Date(result.checkedAt)
  return {
    ...(fresh || row.lastCheckedAt === null ? { status, providerStatus: result.providerStatus, lastEventAt: eventAt } : {}),
    lastCheckedAt: !row.lastCheckedAt || checkedAt > row.lastCheckedAt ? checkedAt : row.lastCheckedAt,
    lastAttemptAt: attemptedAt, lastErrorCode: null,
    ...(status === 'delivered' ? { trackingActive: false, trackingVersion: row.trackingVersion + 1, webhookExpiresAt: null } : {}),
  }
}
