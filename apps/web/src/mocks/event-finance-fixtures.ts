import type {
  EventBoardItem,
  EventBudgetSummary,
} from "../features/event-finance/overview/query";

/**
 * 계약 CB-FIN-002@R1의 예제다. 계약 밖 필드를 만들지 않는다.
 *
 * 사람이 브라우저에서 `just qa EVT-FIN-01`의 항목을 실제로 확인할 수 있도록
 * 짰다. 한 화면에서 확인 필요·검토 중·반려, 내 요청과 남의 요청, 같은 요청의
 * 품목 둘(스택)이 모두 나온다.
 */
export const eventBudgetSummaryExample: EventBudgetSummary = {
  allocatedTotal: 0,
  committedTotal: 480_000,
  // 배정을 만드는 흐름이 아직 없어 음수다. 초과가 아니라 미배정이라는 뜻이다.
  availableTotal: -480_000,
};

/** 재정부가 보는 응답. `financeStage`가 있는 것이 권한 판정 결과다. */
export const eventItemBoardFinanceExample: { items: EventBoardItem[] } = {
  items: [
    {
      itemId: "item-001",
      requestId: "request-001",
      itemName: "행사 현수막 (5m)",
      requesterName: "박해랑",
      requestDepartmentName: "기획부",
      estimatedTotalPrice: 180_000,
      progressState: "under_review",
      requestedByViewer: false,
      financeStage: "review_pending",
    },
    {
      itemId: "item-002",
      requestId: "request-001",
      itemName: "포토존 배경 보드",
      requesterName: "박해랑",
      requestDepartmentName: "기획부",
      estimatedTotalPrice: 240_000,
      progressState: "under_review",
      requestedByViewer: false,
      financeStage: "review_pending",
    },
    {
      itemId: "item-003",
      requestId: "request-002",
      itemName: "음향 장비 대여",
      requesterName: "김도윤",
      requestDepartmentName: "운영부",
      estimatedTotalPrice: 360_000,
      progressState: "needs_attention",
      requestedByViewer: true,
    },
    {
      itemId: "item-004",
      requestId: "request-003",
      itemName: "기념품 텀블러 100개",
      requesterName: "이서준",
      requestDepartmentName: "홍보부",
      estimatedTotalPrice: 850_000,
      progressState: "rejected",
      requestedByViewer: false,
    },
  ],
};

/**
 * 일반 구성원이 보는 같은 행사. `financeStage`가 통째로 빠진다. 서버가 역할을
 * 보고 필드를 빼며, 화면은 그 부재로 하위 메뉴를 감춘다.
 */
export const eventItemBoardMemberExample: { items: EventBoardItem[] } = {
  items: eventItemBoardFinanceExample.items.map((item) => {
    const withoutStage = { ...item };
    delete withoutStage.financeStage;
    return withoutStage;
  }),
};
