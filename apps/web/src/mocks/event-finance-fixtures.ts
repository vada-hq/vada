/**
 * 행사 재정 개요 화면용 계약 예제다.
 * 실제 API 연결 전까지 테스트와 브라우저 모킹이 같은 값을 사용한다.
 *
 * 계약: contracts/bundles/CB-FIN-002/R1.json
 */

export const sampleEventId = "event-001";

export interface BudgetAllocation {
  budgetItem: string;
  allocatedAmount: number;
  committedAmount: number;
  availableAmount: number;
}

export interface BudgetSummary {
  eventId: string;
  allocations: BudgetAllocation[];
  allocatedTotal: number;
  committedTotal: number;
  availableTotal: number;
}

export type EventRequestStatus =
  | "review_pending"
  | "approved"
  | "partially_approved"
  | "revision_requested"
  | "rejected";

export interface EventListItem {
  requestId: string;
  title: string;
  status: EventRequestStatus;
  estimatedTotal: number;
  overBudget: boolean;
  createdAt: string;
  requestDepartmentName: string;
  priority: "normal" | "urgent";
}

export const budgetSummaryExample: BudgetSummary = {
  eventId: sampleEventId,
  allocations: [
    {
      budgetItem: "행사 운영비",
      allocatedAmount: 1_500_000,
      committedAmount: 900_000,
      availableAmount: 600_000,
    },
    {
      budgetItem: "홍보비",
      allocatedAmount: 1_500_000,
      committedAmount: 200_000,
      availableAmount: 1_300_000,
    },
  ],
  allocatedTotal: 3_000_000,
  committedTotal: 1_100_000,
  availableTotal: 1_900_000,
};

export const eventListExample: { items: EventListItem[] } = {
  items: [
    {
      requestId: "request-001",
      title: "가을 축제 운영 물품",
      status: "review_pending",
      estimatedTotal: 390_000,
      overBudget: false,
      createdAt: "2026-08-03T10:05:00Z",
      requestDepartmentName: "운영부",
      priority: "normal",
    },
    {
      requestId: "request-000",
      title: "여름 행사 준비 물품",
      status: "approved",
      estimatedTotal: 100_000,
      overBudget: true,
      createdAt: "2026-08-02T09:00:00Z",
      requestDepartmentName: "홍보부",
      priority: "urgent",
    },
  ],
};
