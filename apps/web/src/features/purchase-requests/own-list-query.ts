import { queryOptions } from "@tanstack/react-query";
import type { PurchaseRequestOwnList } from "@vada/api-client";

/**
 * 승인 계약 API:purchase_request.list_own@R1의 실패 응답을 화면 상태로 좁힌 결과다.
 * 안정 오류 코드 대신 HTTP 상태만 사용해 화면이 계약 밖 의미를 만들지 않는다.
 */
export type OwnListFailure =
  | "unauthenticated"
  | "unavailable_permanently"
  | "unavailable_temporarily";

export class OwnListError extends Error {
  readonly failure: OwnListFailure;

  constructor(failure: OwnListFailure) {
    super(failure);
    this.name = "OwnListError";
    this.failure = failure;
  }
}

export function classifyOwnListStatus(status: number): OwnListFailure {
  if (status === 401) return "unauthenticated";
  if (status === 503) return "unavailable_temporarily";
  return "unavailable_permanently";
}

export function ownListQueryOptions(eventId: string) {
  return queryOptions({
    queryKey: ["purchase-requests", "own-list", eventId] as const,
    retry: false,
    queryFn: async ({ signal }): Promise<PurchaseRequestOwnList> => {
      const response = await fetch(
        `/events/${encodeURIComponent(eventId)}/purchase-requests/mine`,
        { signal, headers: { accept: "application/json" } },
      );

      if (!response.ok) {
        throw new OwnListError(classifyOwnListStatus(response.status));
      }

      return (await response.json()) as PurchaseRequestOwnList;
    },
  });
}
