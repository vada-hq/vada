import type {
  PurchaseRequestDetail,
  PurchaseShipment,
  ShipmentTrackingResponse,
} from '@vada/contracts'

export const shipmentSample: PurchaseShipment = {
  id: '0199d1a0-0000-7000-8000-00000000a004',
  carrierId: 'kr.coupangls',
  trackingNumber: '1234567890123456789012345678901234567890',
  lineItemIds: ['0199d1a0-0000-7000-8000-00000000a002'],
  createdBy: { id: 'm1', name: '김재정' },
  createdAt: '2026-10-26T05:00:00Z',
  cancelledAt: null,
  editable: true,
}
export const shipmentRequestSample: PurchaseRequestDetail = {
  id: '0199d1a0-0000-7000-8000-00000000a001',
  title: '체육대회 준비물',
  status: 'approved',
  requestedBy: { id: 'm2', name: '이기획' },
  body: '안내 부스 준비물이에요.',
  neededBy: '2026-10-30',
  itemCount: 1,
  createdAt: '2026-10-26T04:00:00Z',
  payable: true,
  event: null,
  items: [
    {
      id: '0199d1a0-0000-7000-8000-00000000a002',
      name: '부스 안내판용 네임펜 12색 1세트',
      quantity: 1,
      link: null,
      options: null,
      amount: 9900,
      budgetItem: null,
      status: 'approved',
      paid: false,
      payable: true,
      actions: [],
    },
  ],
  decisions: [],
  expenses: [],
  shipments: [],
  canAddShipment: true,
  history: [],
  actions: [],
}
export const trackingSample: ShipmentTrackingResponse = {
  lastEvent: {
    time: '2026-10-26T05:00:00Z',
    status: { code: 'DELIVERING', name: '배송 중' },
    description: '배송 출발',
  },
  reason: null,
  trackingUrl: 'https://www.coupangls.com/',
}
