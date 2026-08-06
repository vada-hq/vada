import { queryOptions } from "@tanstack/react-query";
import type { PurchaseRequestEditorState } from "@vada/api-client";

/**
 * 승인 계약 API:purchase_request.get_editor_state@R1의 실패 응답을 화면 상태로 좁힌다.
 * 권한 없음과 찾을 수 없음은 안내가 다르고, 재시도는 일시 장애에만 준다.
 */
export type EditorFailure =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "unavailable_temporarily";

export class EditorError extends Error {
  readonly failure: EditorFailure;

  constructor(failure: EditorFailure) {
    super(failure);
    this.name = "EditorError";
    this.failure = failure;
  }
}

export function classifyEditorStatus(status: number): EditorFailure {
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  if (status === 503) return "unavailable_temporarily";
  return "not_found";
}

export function editorStateQueryOptions(eventId: string) {
  return queryOptions({
    queryKey: ["purchase-requests", "editor-state", eventId] as const,
    retry: false,
    queryFn: async ({ signal }): Promise<PurchaseRequestEditorState> => {
      const response = await fetch(
        `/events/${encodeURIComponent(eventId)}/purchase-request-editor`,
        { signal, headers: { accept: "application/json" } },
      );

      if (!response.ok) {
        throw new EditorError(classifyEditorStatus(response.status));
      }

      return (await response.json()) as PurchaseRequestEditorState;
    },
  });
}
