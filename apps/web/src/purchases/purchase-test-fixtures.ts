import type { PurchaseDetail } from '@vada/contracts'
export const link = 'https://www.coupang.com/vp/products/1?itemId=2&vendorItemId=3'
export const draft = (): PurchaseDetail => ({ id: 'r', organizationId: 'o', eventId: 'e', requesterId: 'u', departmentId: 'd',
  purpose: '접수용', neededBy: '2026-10-09', estimatedShippingCost: null, status: 'draft', version: 1,
  createdAt: '2026-09-29T00:00:00Z', updatedAt: '2026-09-29T00:00:00Z', estimatedTotal: null,
  warnings: [], sources: [{ id: 'm', content: '테이블 2개 준비', authorId: 'u', createdAt: '2026-09-29T00:00:00Z' }],
  history: [], items: [{ id: 'i', position: 0, productUrl: link, productName: '테이블', selectedOption: '무광화이트',
    optionRequired: true, quantity: 2, packagingUnit: null, estimatedUnitPrice: 11590, productSnapshot: { price: 11590 }, productFetchedAt: '2026-09-29T00:00:00Z' }] })
