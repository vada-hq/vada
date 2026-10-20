import type { Context } from 'hono'
import { statusOf, type ErrorCode, type ErrorStatus } from '@vada/contracts'

// 응답에는 code만 나간다. 입력값·외부 응답·키를 담지 않는다. 상태는 contracts의 오류 목록이 정한다.
export class ApiError extends Error {
  readonly status: ErrorStatus
  constructor(readonly code: ErrorCode) {
    super(code)
    this.status = statusOf(code)
  }
}

// 가드, 검증, 로그인 확인처럼 던지지 않고 바로 응답하는 곳이 쓴다. 던진 ApiError와 같은 응답이다.
export const errorResponse = (c: Context, code: ErrorCode) =>
  c.json({ error: code }, statusOf(code))
