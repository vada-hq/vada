import { queryOptions } from "@tanstack/react-query";
import type { PurchaseRequestOwnList } from "@vada/api-client";

import { requestJson } from "../../../shared/api/failure";

export function ownListQueryOptions(eventId: string) {
  return queryOptions({
    queryKey: ["purchase-requests", "own-list", eventId] as const,
    retry: false,
    queryFn: ({ signal }) =>
      requestJson<PurchaseRequestOwnList>(
        `/events/${encodeURIComponent(eventId)}/purchase-requests/mine`,
        { signal },
      ),
  });
}
