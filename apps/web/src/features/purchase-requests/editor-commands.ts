import type {
  PurchaseRequestDraft,
  PurchaseRequestDraftContent,
} from "@vada/api-client";

/**
 * 초안 저장·삭제와 제출의 실패를 화면 상태로 좁힌다.
 * 계약 오류마다 사용자가 할 수 있는 일이 다르므로 하나로 합치지 않는다.
 */
export type CommandFailure =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "validation_failed"
  | "conflict"
  | "unavailable_temporarily";

export class CommandError extends Error {
  readonly failure: CommandFailure;

  constructor(failure: CommandFailure) {
    super(failure);
    this.name = "CommandError";
    this.failure = failure;
  }
}

export function classifyCommandStatus(status: number): CommandFailure {
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  if (status === 409) return "conflict";
  if (status === 422) return "validation_failed";
  if (status === 503) return "unavailable_temporarily";
  return "not_found";
}

async function send(path: string, init: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: { accept: "application/json", ...init.headers },
  });

  if (!response.ok) throw new CommandError(classifyCommandStatus(response.status));
  return response;
}

export async function saveDraft(
  eventId: string,
  command: { expectedVersion: number | null; content: PurchaseRequestDraftContent },
): Promise<PurchaseRequestDraft> {
  const response = await send(
    `/events/${encodeURIComponent(eventId)}/purchase-request-draft`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(command),
    },
  );

  return (await response.json()) as PurchaseRequestDraft;
}

export async function deleteDraft(eventId: string): Promise<void> {
  await send(`/events/${encodeURIComponent(eventId)}/purchase-request-draft`, {
    method: "DELETE",
  });
}

export interface SubmitResult {
  requestId: string;
  status: string;
  overBudget: boolean;
}

export async function submitRequest(
  eventId: string,
  content: PurchaseRequestDraftContent,
  idempotencyKey: string,
): Promise<SubmitResult> {
  const response = await send(
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

  return (await response.json()) as SubmitResult;
}

/** 입력이 바뀌면 새 제출로 보고 키를 새로 만든다. */
export function createIdempotencyKey() {
  return crypto.randomUUID();
}
