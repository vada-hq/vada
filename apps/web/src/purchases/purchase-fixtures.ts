import type { DeliverySummary, PurchaseItemSummary } from '@vada/contracts'

// 화면 테스트용 품목. 기본은 내 작성 중 품목이고 제출에 필요한 칸이 다 있다.
export function item(overrides: Partial<PurchaseItemSummary> = {}): PurchaseItemSummary {
  return {
    id: 'i1', event: { id: 'e', name: '체육대회' }, requester: { id: 'u', name: '기획 테스터' }, mine: true, departmentName: null,
    status: 'draft', version: 1, submissionId: null, productUrl: 'https://www.coupang.com/vp/products/1', productName: '유성매직 12색',
    selectedOption: '12색', optionRequired: true, quantity: 2, packagingUnit: null, estimatedUnitPrice: 4900, note: '부스 안내판',
    neededBy: null, neededByChanged: false, warnings: [], createdAt: '2026-10-08T05:00:00.000Z', submittedAt: null, decidedAt: null,
    decidedBy: null, decisionReason: null, purchasedAt: null, receivedAt: null, receivedBy: null, shipments: [], ...overrides,
  }
}
export const shipment = (overrides: Partial<DeliverySummary> = {}): DeliverySummary => ({
  linkId: 'l1', id: 's1', carrierId: 'kr.cjlogistics', trackingNumber: '********1234', trackingNumberMasked: true, status: 'in_transit',
  lastEventAt: null, lastCheckedAt: null, lastAttemptAt: null, refreshFailed: false, trackingActive: true, webhookExpiresAt: null, ...overrides,
})
