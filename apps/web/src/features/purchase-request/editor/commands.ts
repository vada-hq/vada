import type {
  PurchaseRequestDraft,
  PurchaseRequestDraftContent,
} from "@vada/api-client";

import { requestEmpty, requestJson } from "../../../shared/api/failure";

function draftPath(eventId: string) {
  return `/events/${encodeURIComponent(eventId)}/purchase-request-draft`;
}

export function saveDraft(
  eventId: string,
  command: { expectedVersion: number | null; content: PurchaseRequestDraftContent },
) {
  return requestJson<PurchaseRequestDraft>(draftPath(eventId), {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(command),
  });
}

export function deleteDraft(eventId: string) {
  return requestEmpty(draftPath(eventId), { method: "DELETE" });
}

export interface SubmitResult {
  requestId: string;
  status: string;
  overBudget: boolean;
}

export function submitRequest(
  eventId: string,
  content: PurchaseRequestDraftContent,
  idempotencyKey: string,
) {
  return requestJson<SubmitResult>(
    `/events/${encodeURIComponent(eventId)}/purchase-requests`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // 계약이 요구하는 멱등성 키다. 같은 입력의 재시도는 같은 키를 쓴다.
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ content }),
    },
  );
}

/** 입력이 바뀌면 새 제출로 보고 키를 새로 만든다. */
export function createIdempotencyKey() {
  return crypto.randomUUID();
}
