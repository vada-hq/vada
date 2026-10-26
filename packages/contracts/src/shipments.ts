import { z } from 'zod'
import { text, token } from './input.js'
import { recordIdInput } from './team.js'
import { PURCHASE_ITEMS_MAX, PURCHASE_REASON_MAX, type PurchasePerson } from './purchases.js'
// Delivery Tracker의 택배사 ID(DEC-74). 기본값은 쿠팡 CLS다.
export const SHIPMENT_CARRIERS = [
  'kr.coupangls',
  'kr.cjlogistics',
  'kr.hanjin',
  'kr.lotte',
  'kr.epost',
  'kr.logen',
] as const
export type ShipmentCarrier = (typeof SHIPMENT_CARRIERS)[number]
export const SHIPMENT_CARRIER_LABELS: Record<ShipmentCarrier, string> = {
  'kr.coupangls': '쿠팡 CLS',
  'kr.cjlogistics': 'CJ대한통운',
  'kr.hanjin': '한진',
  'kr.lotte': '롯데',
  'kr.epost': '우체국',
  'kr.logen': '로젠',
}
// 조회 API에 연결하지 못해도 같은 택배사 공개 화면으로 갈 수 있다.
export const SHIPMENT_TRACKING_PAGES: Record<ShipmentCarrier, string> = {
  'kr.coupangls': 'https://www.coupangls.com/',
  'kr.cjlogistics': 'https://www.cjlogistics.com/ko/tool/parcel/tracking',
  'kr.hanjin': 'https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillSch.do?mCode=MN038',
  'kr.lotte': 'https://www.lotteglogis.com/home/reservation/tracking/index',
  'kr.epost': 'https://service.epost.go.kr/iservice/usr/trace/usrtrc001k01.jsp',
  'kr.logen': 'https://www.ilogen.com/web/personal/trace',
}
export const TRACKING_NUMBER_MAX = 50
export const ShipmentSchema = z.strictObject({
  carrierId: z.enum(SHIPMENT_CARRIERS),
  trackingNumber: token(TRACKING_NUMBER_MAX)
    .regex(/^[0-9-]+$/)
    .regex(/[0-9]/),
  lineItemIds: z
    .array(recordIdInput)
    .min(1)
    .max(PURCHASE_ITEMS_MAX)
    .refine(ids => new Set(ids).size === ids.length),
})
export const CancelShipmentSchema = z.strictObject({ reason: text(PURCHASE_REASON_MAX) })
export type ShipmentInput = z.infer<typeof ShipmentSchema>
export type CancelShipment = z.infer<typeof CancelShipmentSchema>

export interface PurchaseShipment {
  id: string
  carrierId: ShipmentCarrier
  trackingNumber: string
  lineItemIds: string[]
  createdBy: PurchasePerson | null
  createdAt: string
  cancelledAt: string | null
  // 요청 단위 맥락 권한과 행사 잠금을 서버가 판단한다.
  editable: boolean
}
export interface ShipmentResponse {
  shipment: PurchaseShipment
}
export interface ShipmentEvent {
  time: string | null
  status: { code: string; name: string | null }
  description: string | null
}
export type TrackingReason =
  'not_configured' | 'provider_failed' | 'timeout' | 'invalid_response' | 'not_found' | 'cancelled'
export type TrackingResult =
  { lastEvent: ShipmentEvent; reason: null } | { lastEvent: null; reason: TrackingReason }
export type ShipmentTrackingResponse = TrackingResult & { trackingUrl: string }
