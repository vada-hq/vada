import type { PurchaseLineItem, PurchaseRequestSummary } from './purchases.js'

export const PURCHASE_STAGES = ['pending', 'unpaid', 'paid', 'closed'] as const
export type PurchaseStage = (typeof PURCHASE_STAGES)[number]
export type PurchaseProgress = {
  decided: boolean
  paid: boolean
  partlyPaid: boolean
  hasShipment: boolean
}
type Counts = {
  items: number
  pending: number
  approved: number
  paidApproved: number
  hasShipment: boolean
}
type Detail = {
  items: Pick<PurchaseLineItem, 'status' | 'paid'>[]
  shipments: { cancelledAt: string | null }[]
}

// 미결재 품목이나 결제하지 않은 승인 품목이 남으면 완료가 아니다. 서버 집계와 상세 품목에 같은 판단을 쓴다.
export function purchaseProgressOf(source: Counts | Detail): PurchaseProgress {
  const counts = 'pending' in source ? source : countsOf(source)
  const decided = counts.items > 0 && counts.pending === 0
  const paid = decided && counts.approved > 0 && counts.approved === counts.paidApproved
  return {
    decided,
    paid,
    partlyPaid: counts.paidApproved > 0 && !paid,
    hasShipment: counts.hasShipment,
  }
}

function countsOf(source: Detail): Counts {
  const approved = source.items.filter(item => item.status === 'approved')
  return {
    items: source.items.length,
    pending: source.items.filter(item => item.status === 'pending').length,
    approved: approved.length,
    paidApproved: approved.filter(item => item.paid).length,
    hasShipment: source.shipments.some(shipment => !shipment.cancelledAt),
  }
}

export function purchaseStageOf(
  request: Pick<PurchaseRequestSummary, 'status' | 'progress'>,
): PurchaseStage {
  if (request.status === 'rejected' || request.status === 'cancelled') return 'closed'
  if (request.status === 'pending') return 'pending'
  return request.progress?.paid ? 'paid' : 'unpaid'
}
