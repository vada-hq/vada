import { queryOptions } from "@tanstack/react-query";

import type { PurchaseRequestRevisionView } from "@vada/api-client";

import { requestJson } from "../../../shared/api/failure";
import type { ItemDetails, PurchaseType } from "../shared/item-details";

/**
 * 계약 CB-FIN-004@R1의 두 동작이다. 서버가 주는 모양은 **계약에서 생성된다.**
 *
 * 다만 `content`는 계약이 `object`로만 정한다 — 품목 입력의 모양은 작성 화면이
 * 소유하기 때문이다. 그래서 아래 `RevisionItemContent`는 계약의 사본이 아니라
 * **화면 쪽 좁힘**이다. 계약에서 생성할 수 있는 것이 아니다.
 */
export interface RevisionItemContent {
  name?: string;
  quantity?: number;
  estimatedUnitPrice?: number;
  /** 구매 유형과 유형별 상세. 작성 화면과 같은 폼을 쓴다(§7). */
  purchaseType?: PurchaseType;
  details?: ItemDetails;
}

/** 계약이 열어 둔 `content` 자리만 화면 쪽 모양으로 좁힌다. 나머지는 계약 그대로다. */
export type RevisionItem = Omit<
  PurchaseRequestRevisionView["revisionItems"][number],
  "content"
> & { content: RevisionItemContent };

export type RevisionOtherItem =
  PurchaseRequestRevisionView["otherItems"][number];

export type RevisionView = Omit<
  PurchaseRequestRevisionView,
  "revisionItems"
> & { revisionItems: RevisionItem[] };

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
