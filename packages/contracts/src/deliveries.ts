export type DeliveryStatus = 'unknown' | 'pending' | 'in_transit' | 'delivered' | 'exception'
export interface DeliveryLookupRequest { carrierId: string; trackingNumber: string }
export interface RegisterShipmentRequest extends DeliveryLookupRequest { purchaseItemIds: string[]; idempotencyKey: string }
export interface UnlinkShipmentRequest { linkIds: string[] }
export interface DeliveryLookupResponse {
  status: DeliveryStatus
  providerStatus: string | null
  lastEventAt: string | null
  checkedAt: string
}
export interface DeliveryCarriersResponse { carriers: { id: string; name: string }[]; nextCursor: string | null }
export interface ShipmentRegistrationResponse { shipmentId: string; replayed: boolean }
export interface DeliverySummary {
  linkId: string
  id: string
  carrierId: string
  trackingNumber: string
  trackingNumberMasked: boolean
  status: DeliveryStatus
  lastEventAt: string | null
  lastCheckedAt: string | null
  lastAttemptAt: string | null
  refreshFailed: boolean
  trackingActive: boolean
  // 작업이 저장됐다는 것과 외부 추적 등록 완료는 다르다.
  webhookExpiresAt: string | null
}
export interface EventDeliveriesResponse {
  items: { id: string; requestId: string; productName: string | null; quantity: number | null; shipments: DeliverySummary[] }[]
  nextCursor: string | null
}
