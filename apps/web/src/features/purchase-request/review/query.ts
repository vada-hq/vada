import { queryOptions } from "@tanstack/react-query";
import type { PurchaseRequestDetailView } from "@vada/api-client";

import { requestJson } from "../../../shared/api/failure";

/**
 * 계약 CB-FIN-003@R1의 검토 화면 읽기다.
 * 생성 클라이언트가 이 계약을 포함하면 여기 타입을 그것으로 교체한다.
 */
export type ItemReviewStatus =
  | "review_pending"
  | "approved"
  | "revision_requested"
  | "rejected";

export interface ItemReviewState {
  itemId: string;
  reviewStatus: ItemReviewStatus;
  revisionReason?: string;
  revisionDueDate?: string;
  rejectionReason?: string;
}

export interface ReviewHistoryEntry {
  recordedAt: string;
  actorName: string;
  summary: string;
  itemId?: string;
}

export interface PurchaseRequestReviewView {
  detail: PurchaseRequestDetailView;
  itemReviewStates: ItemReviewState[];
  history: ReviewHistoryEntry[];
}

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

export type ReviewDecision = "approve" | "request_revision" | "reject";

export interface ItemDecisionCommand {
  decision: ReviewDecision;
  /** 화면이 본 현재 상태. 서버 상태와 다르면 409로 거부된다. */
  expectedReviewStatus: ItemReviewStatus;
  revisionReason?: string;
  revisionDueDate?: string;
  rejectionReason?: string;
}

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
