import { queryOptions } from "@tanstack/react-query";
import type { PurchaseRequestDetailView } from "@vada/api-client";

/**
 * 승인 계약 API:purchase_request.get_detail@R2의 실패 응답을 화면 상태로 좁힌 결과다.
 * 찾을 수 없음과 일시 장애는 재시도 가능 여부가 다르므로 반드시 구분한다.
 */
export type DetailFailure =
  | "unauthenticated"
  | "not_found"
  | "unavailable_temporarily";

export class DetailError extends Error {
  readonly failure: DetailFailure;

  constructor(failure: DetailFailure) {
    super(failure);
    this.name = "DetailError";
    this.failure = failure;
  }
}

export function classifyDetailStatus(status: number): DetailFailure {
  if (status === 401) return "unauthenticated";
  if (status === 503) return "unavailable_temporarily";
  return "not_found";
}

export function detailQueryOptions(eventId: string, requestId: string) {
  return queryOptions({
    queryKey: ["purchase-requests", "detail", eventId, requestId] as const,
    retry: false,
    // 직접 진입과 새로고침마다 서버 기록을 다시 읽는다.
    staleTime: 0,
    queryFn: async ({ signal }): Promise<PurchaseRequestDetailView> => {
      const response = await fetch(
        `/events/${encodeURIComponent(eventId)}/purchase-requests/${encodeURIComponent(requestId)}`,
        { signal, headers: { accept: "application/json" } },
      );

      if (!response.ok) {
        throw new DetailError(classifyDetailStatus(response.status));
      }

      return (await response.json()) as PurchaseRequestDetailView;
    },
  });
}
