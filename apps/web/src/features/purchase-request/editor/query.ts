import { queryOptions } from "@tanstack/react-query";
import type { PurchaseRequestEditorState } from "@vada/api-client";

import { requestJson } from "../../../shared/api/failure";

export function editorStateQueryOptions(eventId: string) {
  return queryOptions({
    queryKey: ["purchase-requests", "editor-state", eventId] as const,
    retry: false,
    queryFn: ({ signal }) =>
      requestJson<PurchaseRequestEditorState>(
        `/events/${encodeURIComponent(eventId)}/purchase-request-editor`,
        { signal },
      ),
  });
}
