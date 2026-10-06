import { z } from 'zod'
import { token } from './input.js'

export type DeliveryStatus = 'unknown' | 'pending' | 'in_transit' | 'delivered' | 'exception'
// 자릿수로 택배사를 추정하거나 송장번호를 숫자로 변환하지 않는다.
const shipment = {
  carrierId: token(100).regex(/^[a-zA-Z0-9._-]+$/),
  trackingNumber: token(100).regex(/^[a-zA-Z0-9-]+$/),
}
const ids = z.array(token(200)).min(1).max(50)
  .refine(values => new Set(values).size === values.length)
  .transform(values => [...values].sort())

export const DeliveryLookupSchema = z.strictObject(shipment)
export const RegisterShipmentSchema = z.strictObject({ ...shipment, purchaseItemIds: ids, idempotencyKey: token(128) })
export const UnlinkShipmentSchema = z.strictObject({ linkIds: ids })
export type DeliveryLookupRequest = z.infer<typeof DeliveryLookupSchema>
export type RegisterShipmentRequest = z.infer<typeof RegisterShipmentSchema>
export type UnlinkShipmentRequest = z.infer<typeof UnlinkShipmentSchema>
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
