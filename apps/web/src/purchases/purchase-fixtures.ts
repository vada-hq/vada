import type { DeliverySummary, PurchaseCandidate, PurchaseItemSummary } from '@vada/contracts'

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

// 화면 테스트용 후보. 기본은 조회가 끝난, 옵션을 아는 후보다.
export function candidate(overrides: Partial<PurchaseCandidate> = {}): PurchaseCandidate {
  return {
    id: 'c1', url: 'https://www.coupang.com/vp/products/1?itemId=2&vendorItemId=3', productId: '1', itemId: '2', vendorItemId: '3',
    lookup: 'ready', fetchedAt: '2026-10-09T05:00:00.000Z', optionKnown: true,
    product: { name: '모닝글로리 유성매직 12색', price: 9800, listPrice: null, discountPercent: null, inStock: true,
      deliveryEta: '내일(금) 도착 예정', imageUrl: 'https://thumbnail.coupangcdn.com/a.jpg' },
    warning: null, shareCount: 1, shares: [{ messageId: 'm1', author: { id: 'u', name: '기획 테스터' }, sharedAt: '2026-10-09T05:12:00.000Z' }],
    hidden: null, requests: [], draftedByMe: false, ...overrides,
  }
}
