import { queryOptions } from "@tanstack/react-query";

import { requestJson } from "../../../shared/api/failure";
import type {
  BudgetSummary,
  EventListItem,
} from "../../../mocks/event-finance-fixtures";

/**
 * 계약 CB-FIN-002의 두 조회다.
 * 생성 클라이언트가 이 계약을 포함하면 여기 타입을 그것으로 교체한다.
 */
export function budgetSummaryQueryOptions(eventId: string) {
  return queryOptions({
    queryKey: ["event-finance", "budget-summary", eventId] as const,
    retry: false,
    queryFn: ({ signal }) =>
      requestJson<BudgetSummary>(
        `/events/${encodeURIComponent(eventId)}/budget-summary`,
        { signal },
      ),
  });
}

export function eventRequestListQueryOptions(eventId: string) {
  return queryOptions({
    queryKey: ["event-finance", "request-list", eventId] as const,
    retry: false,
    queryFn: ({ signal }) =>
      requestJson<{ items: EventListItem[] }>(
        `/events/${encodeURIComponent(eventId)}/purchase-requests`,
        { signal },
      ),
  });
}
