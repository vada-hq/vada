/**
 * 계약이 정한 HTTP 실패를 화면 상태로 옮기는 단 한 벌의 규칙이다.
 * 401·403·404·409·422·503의 의미는 모든 화면에서 같으므로 화면마다 다시 정의하지 않는다.
 *
 * 출처: contracts/bundles/CB-FIN-001 의 ERROR 계약
 */
export type ApiFailure =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "validation_failed"
  | "conflict"
  | "unavailable_temporarily";

export class ApiError extends Error {
  readonly failure: ApiFailure;

  constructor(failure: ApiFailure) {
    super(failure);
    this.name = "ApiError";
    this.failure = failure;
  }
}

export function classifyStatus(status: number): ApiFailure {
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  if (status === 409) return "conflict";
  if (status === 422) return "validation_failed";
  if (status === 503) return "unavailable_temporarily";
  return "not_found";
}

/** 실패에서 화면 상태를 읽는다. 재시도는 일시 장애에만 제공한다. */
export function isRetryable(failure: ApiFailure) {
  return failure === "unavailable_temporarily";
}

export function failureOf(error: unknown, fallback: ApiFailure = "not_found") {
  return error instanceof ApiError ? error.failure : fallback;
}

/** 계약 응답을 읽고 실패는 ApiError로 올린다. */
export async function requestJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { accept: "application/json", ...init.headers },
  });

  if (!response.ok) throw new ApiError(classifyStatus(response.status));
  return (await response.json()) as T;
}

export async function requestEmpty(
  path: string,
  init: RequestInit = {},
): Promise<void> {
  const response = await fetch(path, {
    ...init,
    headers: { accept: "application/json", ...init.headers },
  });

  if (!response.ok) throw new ApiError(classifyStatus(response.status));
}
