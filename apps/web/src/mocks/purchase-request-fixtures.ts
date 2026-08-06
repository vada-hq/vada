import type {
  PurchaseRequestDetailView,
  PurchaseRequestOwnList,
} from "@vada/api-client";

/**
 * 승인 계약 픽스처의 값을 그대로 옮긴 화면용 예제다.
 * 실제 API 연결 전까지 테스트와 브라우저 모킹이 같은 값을 사용한다.
 *
 * 출처:
 * - contracts/fixtures/CB-FIN-001/R1.json#own-request-list
 * - contracts/fixtures/CB-FIN-001/R2.json#purchase-request-detail-view
 */

export const sampleEventId = "event-001";

export const ownListExample: PurchaseRequestOwnList = {
  items: [
    {
      requestId: "request-001",
      title: "가을 축제 운영 물품",
      status: "review_pending",
      estimatedTotal: 390000,
      overBudget: false,
      createdAt: "2026-08-03T10:05:00Z",
    },
    {
      requestId: "request-000",
      title: "여름 행사 준비 물품",
      status: "review_pending",
      estimatedTotal: 100000,
      overBudget: true,
      createdAt: "2026-08-02T09:00:00Z",
    },
  ],
};

export const detailViewExample: PurchaseRequestDetailView = {
  record: {
    requestId: "request-001",
    organizationId: "org-001",
    eventId: sampleEventId,
    requesterUserId: "user-001",
    requestDepartmentId: "department-001",
    status: "review_pending",
    content: {
      title: "가을 축제 운영 물품",
      neededDate: "2026-09-15",
      purpose: "가을 축제 부스 운영",
      priority: "urgent",
      items: [
        {
          name: "명찰 케이스",
          category: "행사용품",
          budgetItem: "행사운영비",
          purchaseType: "general",
          quantity: 2,
          unit: "세트",
          estimatedUnitPrice: 15000,
          priceEvidence: [
            {
              type: "product_url",
              url: "https://vendor.example/products/name-badge",
            },
          ],
          details: {
            vendor: "예시문구",
            productUrl: "https://vendor.example/products/name-badge",
            options: "투명 세로형",
          },
        },
        {
          name: "행사 음향 운영",
          category: "용역",
          budgetItem: "행사운영비",
          purchaseType: "service",
          quantity: 1,
          unit: "건",
          estimatedUnitPrice: 360000,
          priceEvidence: [
            { type: "vendor_quote", note: "2026년 가을 축제 음향 운영 견적" },
          ],
          details: {
            provider: "예시사운드",
            location: "학생회관 앞 광장",
            startDate: "2026-09-20",
            endDate: "2026-09-20",
            scope: "음향 장비 설치 및 운영",
          },
        },
      ],
    },
    itemResults: [
      { itemId: "item-001", itemPosition: 0, estimatedAmount: 30000 },
      { itemId: "item-002", itemPosition: 1, estimatedAmount: 360000 },
    ],
    estimatedTotal: 390000,
    overBudget: false,
    createdAt: "2026-08-03T10:05:00Z",
  },
  display: { eventName: "2026 가을 축제", requesterName: "김바다" },
};
