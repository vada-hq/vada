import { queryOptions } from "@tanstack/react-query";
import type { PurchaseRequestDetailView } from "@vada/api-client";

import { requestJson } from "../../../shared/api/failure";

export function detailQueryOptions(eventId: string, requestId: string) {
  return queryOptions({
    queryKey: ["purchase-requests", "detail", eventId, requestId] as const,
    retry: false,
    // 직접 진입과 새로고침마다 서버 기록을 다시 읽는다.
    staleTime: 0,
    queryFn: ({ signal }) =>
      requestJson<PurchaseRequestDetailView>(
        `/events/${encodeURIComponent(eventId)}/purchase-requests/${encodeURIComponent(requestId)}`,
        { signal },
      ),
  });
}
