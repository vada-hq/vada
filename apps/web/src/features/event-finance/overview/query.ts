import { queryOptions } from "@tanstack/react-query";

import type {
  EventBudgetSummary,
  PurchaseRequestEventItemBoard,
} from "@vada/api-client";

import { requestJson } from "../../../shared/api/failure";

/**
 * 계약 CB-FIN-002@R1의 두 조회다. 모양은 **계약에서 생성된다.**
 *
 * `availableTotal`은 배정에서 예약을 뺀 값이라 배정이 없으면 음수다.
 * `financeStage`는 재정부에게만 내려온다 — 키가 없다는 것이 권한 판정 결과다.
 */
export type { EventBudgetSummary };
export type EventBoardItem = PurchaseRequestEventItemBoard["items"][number];
export type ItemProgressState = EventBoardItem["progressState"];

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
