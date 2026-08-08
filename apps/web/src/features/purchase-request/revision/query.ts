import { queryOptions } from "@tanstack/react-query";

import { requestJson } from "../../../shared/api/failure";
import type { ItemDetails, PurchaseType } from "../shared/item-details";

/**
 * 계약 CB-FIN-004@R1의 두 동작이다.
 * 생성 클라이언트가 이 계약을 포함하면 여기 타입을 그것으로 교체한다.
 */
export interface RevisionItemContent {
  name?: string;
  quantity?: number;
  estimatedUnitPrice?: number;
  /** 구매 유형과 유형별 상세. 작성 화면과 같은 폼을 쓴다(§7). */
  purchaseType?: PurchaseType;
  details?: ItemDetails;
}

export interface RevisionItem {
  itemId: string;
  itemName: string;
  revisionReason: string;
  /** 재정부가 남긴 안내다. 지나도 재제출을 막지 않는다. */
  revisionDueDate?: string;
  content: RevisionItemContent;
}

export interface RevisionOtherItem {
  itemId: string;
  itemName: string;
  reviewStatus: "review_pending" | "approved" | "rejected";
  estimatedTotalPrice: number;
}

export interface RevisionView {
  requestId: string;
  requestTitle: string;
  revisionItems: RevisionItem[];
  otherItems: RevisionOtherItem[];
}

function revisionPath(eventId: string, requestId: string) {
  return `/events/${encodeURIComponent(eventId)}/purchase-requests/${encodeURIComponent(requestId)}`;
}

export function revisionQueryKey(eventId: string, requestId: string) {
  return ["purchase-requests", "revision", eventId, requestId] as const;
}

export function revisionQueryOptions(eventId: string, requestId: string) {
  return queryOptions({
    queryKey: revisionQueryKey(eventId, requestId),
    retry: false,
    // 재정부가 그 사이 재검토를 끝냈을 수 있다. 열 때마다 다시 읽는다.
    staleTime: 0,
    queryFn: ({ signal }) =>
      requestJson<RevisionView>(`${revisionPath(eventId, requestId)}/revision`, {
        signal,
      }),
  });
}

export interface RevisionSubmission {
  itemId: string;
  content: RevisionItemContent;
}

export async function submitRevision(
  eventId: string,
  requestId: string,
  submissions: RevisionSubmission[],
  idempotencyKey: string,
) {
  return requestJson<RevisionView>(`${revisionPath(eventId, requestId)}/revisions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // 재시도가 제출본을 두 벌 쌓지 않게 한다. 같은 재제출은 같은 키를 쓴다.
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      items: submissions.map((submission) => ({
        itemId: submission.itemId,
        expectedReviewStatus: "revision_requested",
        content: submission.content,
      })),
    }),
  });
}
