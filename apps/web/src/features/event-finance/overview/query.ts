import { queryOptions } from "@tanstack/react-query";

import { requestJson } from "../../../shared/api/failure";

/**
 * 계약 CB-FIN-002@R1의 두 조회다.
 * 생성 클라이언트가 이 계약을 포함하면 여기 타입을 그것으로 교체한다.
 */
export interface EventBudgetSummary {
  allocatedTotal: number;
  committedTotal: number;
  /** 배정에서 예약을 뺀 값. 배정이 없으면 음수다. */
  availableTotal: number;
}

export type ItemProgressState = "needs_attention" | "under_review" | "rejected";

export interface EventBoardItem {
  itemId: string;
  requestId: string;
  itemName: string;
  requesterName: string;
  requestDepartmentName: string;
  estimatedTotalPrice: number;
  progressState: ItemProgressState;
  requestedByViewer: boolean;
  /** 재정부에게만 내려온다. 키가 없다는 것이 권한 판정 결과다. */
  financeStage?: "review_pending" | "revision_review_pending";
}

export function eventBudgetSummaryQueryOptions(eventId: string) {
  return queryOptions({
    queryKey: ["event-finance", "budget-summary", eventId] as const,
    retry: false,
    queryFn: ({ signal }) =>
      requestJson<EventBudgetSummary>(
        `/events/${encodeURIComponent(eventId)}/budget-summary`,
        { signal },
      ),
  });
}

export function eventItemBoardQueryOptions(eventId: string) {
  return queryOptions({
    queryKey: ["event-finance", "item-board", eventId] as const,
    // 여러 재정부원이 같은 행사를 동시에 본다. 열 때마다 다시 읽는다.
    staleTime: 0,
    retry: false,
    queryFn: ({ signal }) =>
      requestJson<{ items: EventBoardItem[] }>(
        `/events/${encodeURIComponent(eventId)}/purchase-request-items`,
        { signal },
      ),
  });
}
