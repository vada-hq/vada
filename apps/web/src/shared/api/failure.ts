/**
 * 계약이 정한 HTTP 실패를 화면 상태로 옮기는 단 한 벌의 규칙이다.
 * 401·403·404·409·422·503의 의미는 모든 화면에서 같으므로 화면마다 다시 정의하지 않는다.
 *
 * 출처: contracts/bundles/CB-FIN-001 의 ERROR 계약
 */
import { accessTokenForRequests } from "../../auth/session";
import { apiPath } from "./base";

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

/**
 * 서버가 요청자를 알아보는 유일한 통로다.
 *
 * 화면마다 붙이지 않는다. 화면 하나가 잊으면 그 화면만 401을 받고, 그것은
 * 데이터가 없는 것과 구별되지 않아 한참 뒤에 발견된다.
 *
 * 로컬 개발에는 Cognito가 없어 토큰이 없다. 그때는 헤더를 붙이지 않고,
 * 서버 쪽 로컬 미들웨어가 신원을 흉내낸다.
 */
function headersFor(init: RequestInit): HeadersInit {
  const token = accessTokenForRequests();

  return {
    accept: "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...init.headers,
  };
}

/**
 * 계약 응답을 읽고 실패는 ApiError로 올린다.
 *
 * 호출부는 계약이 정의한 경로 그대로 넘긴다. 화면 주소와 겹치지 않게 붙이는
 * 기본 경로는 여기서 한 번만 얹는다.
 */
export async function requestJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(apiPath(path), {
    ...init,
    headers: headersFor(init),
  });

  if (!response.ok) throw new ApiError(classifyStatus(response.status));
  return (await response.json()) as T;
}

export async function requestEmpty(
  path: string,
  init: RequestInit = {},
): Promise<void> {
  const response = await fetch(apiPath(path), {
    ...init,
    headers: headersFor(init),
  });

  if (!response.ok) throw new ApiError(classifyStatus(response.status));
}
