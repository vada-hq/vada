import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { SERVER_ERROR_FROM, statusOf, type ErrorCode } from '@vada/contracts'
import { ApiError } from './errors.js'
import { INTERNAL_SERVER_ERROR } from './status.js'

// HTTPException은 상태만 믿고 기존 오류 코드 이름으로 응답한다. 같은 상태를 가진 코드가 여럿이면 앞의 것이다.
const httpExceptionCodes: ErrorCode[] = [
  'INVALID_INPUT',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'BODY_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
]
const httpExceptionCodeOf = (status: number) =>
  httpExceptionCodes.find(code => statusOf(code) === status) ?? 'REQUEST_FAILED'

// DB 오류는 drizzle이 감싸므로 cause를 몇 단계 따라가 SQLSTATE만 꺼낸다. 숫자가 없는 EPIPE 같은 시스템 오류 코드는 제외한다.
export function sqlState(error: unknown): string | undefined {
  let current = error
  for (let depth = 0; current && typeof current === 'object' && depth < 3; depth++) {
    const code = (current as { code?: unknown }).code
    if (typeof code === 'string' && /^(?=.*\d)[0-9A-Z]{5}$/.test(code)) return code
    current = (current as { cause?: unknown }).cause
  }
  return undefined
}

export type ErrorReporter = (error: Error, fields: Record<string, unknown>) => void
let reporter: ErrorReporter | undefined
// 외부 오류 수집기(Sentry)는 서버 시작 시 연결한다. 테스트와 로컬에서는 연결하지 않는다.
export function setErrorReporter(next: ErrorReporter | undefined) {
  reporter = next
}

// 오류 메시지·요청 본문·경로 값은 비밀이나 개인정보를 담을 수 있어 남기지 않는다. 수집기에도 같은 필드만 넘긴다.
function logFailure(c: Context, error: Error, fields: Record<string, unknown>) {
  const line = Object.fromEntries(
    Object.entries({
      event: 'request_failed',
      method: c.req.method,
      route: c.req.routePath,
      ...fields,
    }).filter(([, value]) => value !== undefined),
  )
  console.error(JSON.stringify(line))
  reporter?.(error, line)
}

// 예상하지 못한 오류는 클래스 이름과 SQLSTATE만 남긴다. 이름도 임의로 바뀔 수 있어 형식이 맞을 때만 쓴다.
export function logUnexpectedError(c: Context, error: Error) {
  logFailure(c, error, {
    error: /^[A-Za-z][A-Za-z0-9]{0,59}$/.test(error.name) ? error.name : 'Error',
    sqlState: sqlState(error),
  })
}

export function handleError(error: Error, c: Context) {
  if (error instanceof ApiError) {
    // 외부 서비스 장애처럼 서버 쪽 실패는 운영에서 보이도록 코드와 상태를 남긴다.
    if (error.status >= SERVER_ERROR_FROM)
      logFailure(c, error, { code: error.code, status: error.status })
    return c.json({ error: error.code }, error.status)
  }
  if (error instanceof HTTPException) {
    if (error.status >= SERVER_ERROR_FROM) logFailure(c, error, { status: error.status })
    return c.json({ error: httpExceptionCodeOf(error.status) }, error.status)
  }
  logUnexpectedError(c, error)
  return c.json({ error: 'Internal server error' }, INTERNAL_SERVER_ERROR)
}
