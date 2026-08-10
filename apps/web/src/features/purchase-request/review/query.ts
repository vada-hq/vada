import { queryOptions } from "@tanstack/react-query";
import type {
  PurchaseRequestItemDecision,
  PurchaseRequestItemReviewState,
  PurchaseRequestReviewView,
} from "@vada/api-client";

import { requestJson } from "../../../shared/api/failure";

/**
 * 계약 CB-FIN-003@R1의 검토 화면 읽기다. 모양은 **계약에서 생성된다.**
 */
export type { PurchaseRequestReviewView };
export type ItemReviewState = PurchaseRequestItemReviewState;
export type ItemReviewStatus = ItemReviewState["reviewStatus"];
export type ReviewHistoryEntry = PurchaseRequestReviewView["history"][number];

function requestPath(eventId: string, requestId: string) {
  return `/events/${encodeURIComponent(eventId)}/purchase-requests/${encodeURIComponent(requestId)}`;
}

export function reviewQueryKey(eventId: string, requestId: string) {
  return ["purchase-requests", "review", eventId, requestId] as const;
}

export function reviewQueryOptions(eventId: string, requestId: string) {
  return queryOptions({
    queryKey: reviewQueryKey(eventId, requestId),
    retry: false,
    // 여러 재정부원이 같은 요청을 동시에 볼 수 있다. 열 때마다 다시 읽는다.
    staleTime: 0,
    queryFn: ({ signal }) =>
      requestJson<PurchaseRequestReviewView>(
        `${requestPath(eventId, requestId)}/review`,
        { signal },
      ),
  });
}

/** `expectedReviewStatus`는 화면이 본 현재 상태다. 서버와 다르면 409로 거부된다. */
export type ItemDecisionCommand = PurchaseRequestItemDecision;
export type ReviewDecision = ItemDecisionCommand["decision"];

export function decideItem(
  eventId: string,
  requestId: string,
  itemId: string,
  command: ItemDecisionCommand,
) {
  return requestJson<PurchaseRequestReviewView>(
    `${requestPath(eventId, requestId)}/items/${encodeURIComponent(itemId)}/review`,
    {
      method: "PUT",
      body: JSON.stringify(command),
      headers: { "content-type": "application/json" },
    },
  );
}
