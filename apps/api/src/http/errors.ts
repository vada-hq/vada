export type ErrorStatus = 400 | 403 | 404 | 409 | 413 | 415 | 429 | 502 | 503

// 응답에는 code만 나간다. 입력값·외부 응답·키를 담지 않는다.
export class ApiError extends Error {
  constructor(readonly code: string, readonly status: ErrorStatus = 400) { super(code) }
}
